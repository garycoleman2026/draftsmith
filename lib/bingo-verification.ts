import { BingoError, parseJson } from './bingo';
import { reviewBingoClaim } from './bingo-claims';
import { sanitizeBingoTaskRule, type BingoTaskRule, type BingoVerifierType } from './bingo-rules';
import {
  computeVerificationCandidate, matchVerificationSignal,
  sanitizeVerificationSignal as sanitizeVerificationSignalCore,
  shouldAutoAcceptVerification,
  type BingoRuleMatch, type BingoVerificationMatch, type BingoVerificationSignal,
  type VerificationConfidence, type VerificationSource,
} from './bingo-verification-core';
import { getDatabase } from './db';

export { computeVerificationCandidate, matchVerificationSignal, shouldAutoAcceptVerification, VERIFICATION_SOURCES } from './bingo-verification-core';
export type {
  BingoRuleMatch, BingoVerificationMatch, BingoVerificationSignal, VerificationConfidence,
  VerificationMeasurement, VerificationSource,
} from './bingo-verification-core';

export type BingoCandidateSnapshot = {
  id: string;
  taskId: string;
  teamId: string;
  memberId: string | null;
  sourceSummary: string;
  confidence: VerificationConfidence;
  status: 'progress' | 'ready' | 'accepted' | 'dismissed';
  progressValue: number;
  targetValue: number;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

type VerificationEventRow = {
  id: string; event_id: string; team_id: string; member_id: string | null; source: VerificationSource;
  signal_type: BingoVerifierType; payload_json: string; observed_at: string;
};
type TaskRow = {
  id: string; title: string; verification_mode: 'manual' | 'screenshot' | 'stat_delta' | 'hybrid';
  rule_json: string; sort_order: number;
};
type CandidateRow = {
  id: string; event_id: string; task_id: string; team_id: string; member_id: string | null;
  source_summary: string; confidence: VerificationConfidence; status: BingoCandidateSnapshot['status'];
  progress_value: number; target_value: number; summary: string; details_json: string;
  created_at: string; updated_at: string; resolved_at: string | null;
};
export function sanitizeVerificationSignal(value: unknown): BingoVerificationSignal {
  try { return sanitizeVerificationSignalCore(value); }
  catch (error) { throw new BingoError(error instanceof Error ? error.message : 'The verification signal is invalid.'); }
}

export async function dryRunVerificationSignal(input: {
  eventId: string; teamId: string; memberId?: string | null; signal: unknown;
}) {
  const signal = sanitizeVerificationSignal(input.signal);
  const { tasks, rosterSize } = await verificationContext(input.eventId, input.teamId, input.memberId ?? null);
  return {
    signal,
    matches: tasks.flatMap((task) => {
      const rule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
      const match = matchVerificationSignal(rule, signal, rosterSize, input.memberId ?? null, task.id);
      return match ? [{ taskId: task.id, title: task.title, sortOrder: task.sort_order, match }] : [];
    }),
  };
}

export async function ingestVerificationSignal(input: {
  eventId: string; teamId: string; memberId?: string | null; signal: unknown; allowComplete?: boolean;
}) {
  const signal = sanitizeVerificationSignal(input.signal);
  const db = getDatabase();
  const event = await db.prepare(
    'SELECT id, status, requires_review, started_at, ended_at FROM bingo_events WHERE id = ?',
  ).bind(input.eventId).first<{ id: string; status: string; requires_review: number; started_at: string | null; ended_at: string | null }>();
  if (!event) throw new BingoError('That bingo event does not exist.', 404);
  const finalReconciliation = input.allowComplete && event.status === 'complete' && signal.source === 'wise_old_man';
  if (event.status !== 'live' && !finalReconciliation) {
    throw new BingoError('Verification signals are accepted only while the bingo is live.', 409);
  }
  const observedAt = Date.parse(signal.observedAt);
  if (observedAt > Date.now() + 5 * 60_000) throw new BingoError('The verification signal is too far in the future.');
  if (event.started_at && observedAt < Date.parse(event.started_at) - 5 * 60_000) throw new BingoError('The signal predates the event window.');
  if (event.ended_at && observedAt > Date.parse(event.ended_at) + 5 * 60_000) throw new BingoError('The signal falls after the event window.');
  const { tasks, rosterSize } = await verificationContext(input.eventId, input.teamId, input.memberId ?? null);
  const verificationEventId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const inserted = await db.prepare(
    'INSERT INTO bingo_verification_events (id, event_id, team_id, member_id, idempotency_key, source, signal_type, payload_json, observed_at, received_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id, team_id, source, idempotency_key) DO NOTHING',
  ).bind(verificationEventId, input.eventId, input.teamId, input.memberId ?? null, signal.idempotencyKey,
    signal.source, signal.signalType, JSON.stringify(signal), signal.observedAt, receivedAt).run();
  const duplicate = !inserted.meta.changes;
  const stored = duplicate
    ? await db.prepare(
      'SELECT id, event_id, team_id, member_id, source, signal_type, payload_json, observed_at FROM bingo_verification_events ' +
      'WHERE event_id = ? AND team_id = ? AND source = ? AND idempotency_key = ?',
    ).bind(input.eventId, input.teamId, signal.source, signal.idempotencyKey).first<VerificationEventRow>()
    : {
      id: verificationEventId, event_id: input.eventId, team_id: input.teamId, member_id: input.memberId ?? null,
      source: signal.source, signal_type: signal.signalType, payload_json: JSON.stringify(signal), observed_at: signal.observedAt,
    };
  if (!stored) throw new BingoError('The verification signal could not be recovered.', 500);
  const candidates = await autoAcceptVerificationCandidates(
    input.eventId,
    Boolean(event.requires_review),
    await evaluateStoredVerificationEvent(stored, tasks, rosterSize, !duplicate),
  );
  if (!duplicate && candidates.length) {
    await db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?')
      .bind(receivedAt, input.eventId).run();
  }
  return { duplicate, verificationEventId: stored.id, candidates };
}

export async function replayVerificationEvents(eventId: string) {
  const db = getDatabase();
  const eventSettings = await db.prepare('SELECT requires_review FROM bingo_events WHERE id = ?')
    .bind(eventId).first<{ requires_review: number }>();
  if (!eventSettings) throw new BingoError('That bingo event does not exist.', 404);
  const events = await db.prepare(
    'SELECT id, event_id, team_id, member_id, source, signal_type, payload_json, observed_at ' +
    'FROM bingo_verification_events WHERE event_id = ? ORDER BY observed_at LIMIT 5000',
  ).bind(eventId).all<VerificationEventRow>();
  const contextByTeam = new Map<string, Awaited<ReturnType<typeof verificationContext>>>();
  const candidateIds = new Set<string>();
  let matches = 0;
  for (const event of events.results) {
    let context = contextByTeam.get(event.team_id);
    if (!context) {
      context = await verificationContext(eventId, event.team_id, event.member_id);
      contextByTeam.set(event.team_id, context);
    }
    const candidates = await autoAcceptVerificationCandidates(
      eventId,
      Boolean(eventSettings.requires_review),
      await evaluateStoredVerificationEvent(event, context.tasks, context.rosterSize, false),
    );
    candidates.forEach((candidate) => candidateIds.add(candidate.id));
    matches += candidates.length;
  }
  return { eventCount: events.results.length, candidateCount: candidateIds.size, matches };
}

export async function resolveVerificationCandidate(input: {
  eventId: string; candidateId: string; action: 'accept' | 'dismiss' | 'reopen';
  actorType?: 'organizer' | 'system';
}) {
  const db = getDatabase();
  const candidate = await loadCandidate(input.eventId, input.candidateId);
  if (!candidate) throw new BingoError('That verification candidate no longer exists.', 404);
  const now = new Date().toISOString();
  if (input.action === 'dismiss') {
    if (candidate.status === 'accepted') throw new BingoError('An accepted verification cannot be dismissed.', 409);
    await db.prepare(
      "UPDATE bingo_verification_candidates SET status = 'dismissed', resolved_at = ?, updated_at = ? WHERE id = ?",
    ).bind(now, now, candidate.id).run();
    return { ...candidateToView(candidate), status: 'dismissed' as const, resolvedAt: now, updatedAt: now };
  }
  if (input.action === 'reopen') {
    if (candidate.status === 'accepted') throw new BingoError('An accepted verification is already part of the score.', 409);
    return recomputeCandidate(candidate.id, true);
  }
  if (candidate.status !== 'ready') throw new BingoError('Only a ready verification can be accepted.', 409);
  const row = await db.prepare(
    'SELECT vc.id, vc.event_id, vc.task_id, vc.team_id, vc.member_id, vc.source_summary, vc.confidence, vc.summary, ' +
    'btm.display_name, be.status AS event_status ' +
    'FROM bingo_verification_candidates vc ' +
    'LEFT JOIN bingo_team_members btm ON btm.id = vc.member_id ' +
    'JOIN bingo_events be ON be.id = vc.event_id WHERE vc.id = ? AND vc.event_id = ?',
  ).bind(candidate.id, input.eventId).first<{
    id: string; event_id: string; task_id: string; team_id: string; member_id: string | null;
    source_summary: string; confidence: VerificationConfidence; summary: string; display_name: string | null; event_status: string;
  }>();
  if (!row || !['live', 'complete'].includes(row.event_status)) {
    throw new BingoError('Candidates can only be accepted while the bingo is live or reconciling its final results.', 409);
  }
  const existingClaim = await db.prepare(
    'SELECT id, status FROM bingo_claims WHERE event_id = ? AND verification_candidate_id = ?',
  ).bind(row.event_id, row.id).first<{ id: string; status: string }>();
  if (existingClaim) {
    if (existingClaim.status === 'approved') throw new BingoError('That verification is already part of the score.', 409);
    if (existingClaim.status === 'rejected') {
      await reviewBingoClaim({
        claimId: existingClaim.id, eventId: row.event_id, action: 'reopen', actorType: input.actorType ?? 'organizer',
      });
    } else if (existingClaim.status !== 'pending') {
      throw new BingoError('That verification claim cannot be reopened.', 409);
    }
    const reviewed = await reviewBingoClaim({
      claimId: existingClaim.id, eventId: row.event_id, action: 'approve',
      reviewNote: input.actorType === 'system'
        ? 'Automatically accepted because organizer review is off.'
        : 'Accepted from the automated verification queue.',
      actorType: input.actorType ?? 'organizer',
    });
    return { ...candidateToView(candidate), status: 'accepted' as const, resolvedAt: now, updatedAt: now, scoreAwarded: reviewed.scoreAwarded };
  }
  const claimId = crypto.randomUUID();
  try {
    await db.prepare(
      'INSERT INTO bingo_claims (id, event_id, task_id, team_id, member_id, claimed_by_name, note, status, score_awarded, ' +
      'verification_source, verification_confidence, verification_candidate_id, submitted_at) ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)",
    ).bind(claimId, row.event_id, row.task_id, row.team_id, row.member_id,
      row.display_name ?? 'Verified team progress', row.summary, row.source_summary, row.confidence, row.id, now).run();
    const reviewed = await reviewBingoClaim({
      claimId, eventId: row.event_id, action: 'approve',
      reviewNote: input.actorType === 'system'
        ? 'Automatically accepted because organizer review is off.'
        : 'Accepted from the automated verification queue.',
      actorType: input.actorType ?? 'organizer',
    });
    return { ...candidateToView(candidate), status: 'accepted' as const, resolvedAt: now, updatedAt: now, scoreAwarded: reviewed.scoreAwarded };
  } catch (error) {
    await db.prepare("DELETE FROM bingo_claims WHERE id = ? AND status = 'pending'").bind(claimId).run().catch(() => undefined);
    throw error;
  }
}

async function autoAcceptVerificationCandidates(
  eventId: string,
  requiresReview: boolean,
  candidates: BingoCandidateSnapshot[],
) {
  const resolved: BingoCandidateSnapshot[] = [];
  for (const candidate of candidates) {
    if (!shouldAutoAcceptVerification(requiresReview, candidate.status)) {
      resolved.push(candidate);
      continue;
    }
    try {
      resolved.push(await resolveVerificationCandidate({
        eventId, candidateId: candidate.id, action: 'accept', actorType: 'system',
      }));
    } catch (error) {
      if (error instanceof BingoError && error.status === 409) {
        resolved.push(candidate);
        continue;
      }
      throw error;
    }
  }
  return resolved;
}

async function evaluateStoredVerificationEvent(event: VerificationEventRow, tasks: TaskRow[], rosterSize: number, revive: boolean) {
  const signal = sanitizeVerificationSignal(parseJson(event.payload_json, {}));
  const db = getDatabase();
  const candidates: BingoCandidateSnapshot[] = [];
  for (const task of tasks) {
    const rule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
    const match = matchVerificationSignal(rule, signal, rosterSize, event.member_id, task.id);
    if (!match) continue;
    const candidateId = await ensureCandidate(event, task, match);
    await db.prepare(
      'INSERT INTO bingo_verification_matches (id, candidate_id, verification_event_id, task_id, team_id, member_id, value, progress_kind, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(verification_event_id, task_id) DO NOTHING',
    ).bind(crypto.randomUUID(), candidateId, event.id, task.id, event.team_id, event.member_id, match.value,
      match.progressKind, new Date().toISOString()).run();
    candidates.push(await recomputeCandidate(candidateId, revive));
  }
  return candidates;
}

async function ensureCandidate(event: VerificationEventRow, task: TaskRow, match: BingoRuleMatch) {
  const db = getDatabase();
  const existing = await db.prepare(
    'SELECT id FROM bingo_verification_candidates WHERE event_id = ? AND task_id = ? AND team_id = ?',
  ).bind(event.event_id, task.id, event.team_id).first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO bingo_verification_candidates (id, event_id, task_id, team_id, member_id, source_summary, confidence, status, ' +
    'progress_value, target_value, summary, details_json, created_at, updated_at) ' +
    "VALUES (?, ?, ?, ?, ?, ?, 'reported', 'progress', 0, ?, ?, '{}', ?, ?) " +
    'ON CONFLICT(event_id, task_id, team_id) DO NOTHING',
  ).bind(id, event.event_id, task.id, event.team_id, event.member_id, event.source, match.targetValue,
    'Evidence is accumulating for ' + task.title + '.', now, now).run();
  const resolved = await db.prepare(
    'SELECT id FROM bingo_verification_candidates WHERE event_id = ? AND task_id = ? AND team_id = ?',
  ).bind(event.event_id, task.id, event.team_id).first<{ id: string }>();
  if (!resolved) throw new BingoError('The verification candidate could not be created.', 500);
  return resolved.id;
}

async function recomputeCandidate(candidateId: string, revive: boolean): Promise<BingoCandidateSnapshot> {
  const db = getDatabase();
  const candidate = await db.prepare(
    'SELECT id, event_id, task_id, team_id, member_id, source_summary, confidence, status, progress_value, target_value, ' +
    'summary, details_json, created_at, updated_at, resolved_at FROM bingo_verification_candidates WHERE id = ?',
  ).bind(candidateId).first<CandidateRow>();
  if (!candidate) throw new BingoError('The verification candidate no longer exists.', 404);
  const task = await db.prepare(
    'SELECT id, title, verification_mode, rule_json, sort_order FROM bingo_tasks WHERE id = ?',
  ).bind(candidate.task_id).first<TaskRow>();
  if (!task) throw new BingoError('The verification task no longer exists.', 404);
  const matches = await db.prepare(
    'SELECT vm.value, vm.progress_kind, vm.member_id, ve.source FROM bingo_verification_matches vm ' +
    'JOIN bingo_verification_events ve ON ve.id = vm.verification_event_id WHERE vm.candidate_id = ? ORDER BY ve.observed_at',
  ).bind(candidate.id).all<BingoVerificationMatch>();
  const rule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
  const computed = computeVerificationCandidate(rule, matches.results);
  const status = candidate.status === 'accepted' ? 'accepted'
    : candidate.status === 'dismissed' && !revive ? 'dismissed'
      : computed.complete ? 'ready' : 'progress';
  const now = new Date().toISOString();
  const summary = candidateSummary(task.title, computed.progressValue, computed.targetValue, rule);
  const details = {
    verifier: rule.verifier.type,
    comparator: rule.verifier.comparator,
    scope: rule.scope.type,
    sources: computed.sources,
    completeSources: computed.completeSources,
    sourceProgress: computed.sourceProgress,
    matchCount: matches.results.length,
  };
  await db.prepare(
    'UPDATE bingo_verification_candidates SET member_id = ?, source_summary = ?, confidence = ?, status = ?, ' +
    'progress_value = ?, target_value = ?, summary = ?, details_json = ?, updated_at = ?, resolved_at = ? WHERE id = ?',
  ).bind(computed.memberId, computed.sources.join(',') || 'unknown', computed.confidence, status,
    computed.progressValue, computed.targetValue, summary, JSON.stringify(details), now,
    status === 'accepted' || status === 'dismissed' ? candidate.resolved_at ?? now : null, candidate.id).run();
  return {
    id: candidate.id, taskId: candidate.task_id, teamId: candidate.team_id, memberId: computed.memberId,
    sourceSummary: computed.sources.join(',') || 'unknown', confidence: computed.confidence, status,
    progressValue: computed.progressValue, targetValue: computed.targetValue, summary, details,
    createdAt: candidate.created_at, updatedAt: now,
    resolvedAt: status === 'accepted' || status === 'dismissed' ? candidate.resolved_at ?? now : null,
  };
}

async function verificationContext(eventId: string, teamId: string, memberId: string | null) {
  const db = getDatabase();
  const team = await db.prepare('SELECT id FROM bingo_teams WHERE id = ? AND event_id = ?')
    .bind(teamId, eventId).first<{ id: string }>();
  if (!team) throw new BingoError('That team is not part of this bingo event.', 404);
  if (memberId) {
    const member = await db.prepare('SELECT id FROM bingo_team_members WHERE id = ? AND team_id = ?')
      .bind(memberId, teamId).first<{ id: string }>();
    if (!member) throw new BingoError('That player is not part of the selected team.', 404);
  }
  const [tasks, roster] = await Promise.all([
    db.prepare(
      'SELECT id, title, verification_mode, rule_json, sort_order FROM bingo_tasks WHERE event_id = ? ORDER BY sort_order',
    ).bind(eventId).all<TaskRow>(),
    db.prepare('SELECT COUNT(*) AS count FROM bingo_team_members WHERE team_id = ?')
      .bind(teamId).first<{ count: number }>(),
  ]);
  return { tasks: tasks.results, rosterSize: roster?.count ?? 0 };
}

async function loadCandidate(eventId: string, candidateId: string) {
  return getDatabase().prepare(
    'SELECT id, event_id, task_id, team_id, member_id, source_summary, confidence, status, progress_value, target_value, ' +
    'summary, details_json, created_at, updated_at, resolved_at FROM bingo_verification_candidates WHERE id = ? AND event_id = ?',
  ).bind(candidateId, eventId).first<CandidateRow>();
}

export function candidateToView(candidate: CandidateRow): BingoCandidateSnapshot {
  return {
    id: candidate.id, taskId: candidate.task_id, teamId: candidate.team_id, memberId: candidate.member_id,
    sourceSummary: candidate.source_summary, confidence: candidate.confidence, status: candidate.status,
    progressValue: candidate.progress_value, targetValue: candidate.target_value, summary: candidate.summary,
    details: parseJson(candidate.details_json, {}), createdAt: candidate.created_at, updatedAt: candidate.updated_at,
    resolvedAt: candidate.resolved_at,
  };
}

function candidateSummary(title: string, progress: number, target: number, rule: BingoTaskRule) {
  const unit = rule.verifier.unit ? ' ' + rule.verifier.unit : '';
  if (rule.verifier.comparator === 'at_most') return title + ': ' + formatNumber(progress) + unit + ' against a maximum of ' + formatNumber(target) + unit + '.';
  return title + ': ' + formatNumber(progress) + ' / ' + formatNumber(target) + unit + '.';
}
function formatNumber(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value); }
