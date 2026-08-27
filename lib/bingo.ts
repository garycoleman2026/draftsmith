import { resolveManagerDraftId } from './access-tokens';
import { calculateBingoStandings, claimAvailability, type BingoScoreCompletion } from './bingo-scoring';
import { getDatabase } from './db';
import { sanitizeBingoEventRules, sanitizeBingoTaskRule, type BingoEventRules } from './bingo-rules';
import { hashToken } from './security';
import type { BingoBoardScope, BingoClaimStatus, BingoMode, BingoStatus, BingoVerificationMode } from './types';

export type BingoEventRow = {
  id: string; draft_id: string; title: string; public_slug: string; mode: BingoMode; board_scope: BingoBoardScope;
  grid_size: number; status: BingoStatus; win_condition: string; target_value: number; requires_review: number;
  public_spectator: number; spectator_delay_seconds: number; start_at: string | null; end_at: string | null;
  started_at: string | null; ended_at: string | null; baseline_status: string; revision: number;
  rules_json: string | null; created_at: string; updated_at: string;
};

type TeamRow = { id: string; event_id: string; source_team_index: number; name: string; color: string; emblem: string };
type MemberRow = { id: string; team_id: string; player_id: string | null; display_name: string; normalized_name: string; role: string };
type TaskRow = {
  id: string; event_id: string; title: string; description: string; points: number; category: string; difficulty: string;
  verification_mode: BingoVerificationMode; repeatable: number; max_completions: number; hidden: number; free_space: number;
  icon_key: string; rule_json: string; sort_order: number;
};
type ClaimRow = {
  id: string; event_id: string; task_id: string; team_id: string; member_id: string | null; claimed_by_name: string;
  note: string; evidence_url: string | null; evidence_upload_id: string | null; status: BingoClaimStatus;
  review_note: string | null; score_awarded: number; submitted_at: string; reviewed_at: string | null; approved_at: string | null;
  verification_source: string; verification_confidence: string; verification_candidate_id: string | null;
};
type CompletionRow = { id: string; task_id: string; team_id: string; claim_id: string; completion_number: number; points: number; verification_source: string; verification_confidence: string; completed_at: string };
type ActivityRow = { id: string; team_id: string | null; task_id: string | null; activity_type: string; message: string; metadata_json: string | null; visible_at: string; created_at: string };
type CandidateRow = {
  id: string; task_id: string; team_id: string; member_id: string | null; source_summary: string; confidence: string;
  status: string; progress_value: number; target_value: number; summary: string; details_json: string;
  created_at: string; updated_at: string; resolved_at: string | null;
};

export class BingoError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function requireManagedBingoEvent(token: string, eventId: string) {
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) throw new BingoError('This organizer link is not valid.', 404);
  const event = await getDatabase().prepare(
    `SELECT id, draft_id, title, public_slug, mode, board_scope, grid_size, status, win_condition, target_value,
            requires_review, public_spectator, spectator_delay_seconds, start_at, end_at, started_at, ended_at,
            baseline_status, revision, rules_json, created_at, updated_at
     FROM bingo_events WHERE id = ? AND draft_id = ?`,
  ).bind(eventId, draftId).first<BingoEventRow>();
  if (!event) throw new BingoError('This bingo event is not available from that organizer link.', 404);
  return event;
}

export async function resolveBingoTeam(token: string) {
  const tokenHash = await hashToken(token);
  return getDatabase().prepare(
    `SELECT bt.id, bt.event_id, bt.source_team_index, bt.name, bt.color, bt.emblem
     FROM bingo_teams bt WHERE bt.access_token_hash = ?`,
  ).bind(tokenHash).first<TeamRow>();
}

export async function uniqueBingoSlug(title: string) {
  const base = title.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42) || 'clan-bingo';
  const db = getDatabase();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = attempt ? `-${attempt + 1}` : '';
    const slug = `${base.slice(0, 48 - suffix.length)}${suffix}`;
    if (!await db.prepare('SELECT id FROM bingo_events WHERE public_slug = ?').bind(slug).first()) return slug;
  }
  return `${base.slice(0, 34)}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function loadBingoView(input: {
  eventId: string;
  viewer: 'public' | 'team' | 'organizer';
  teamId?: string | null;
}) {
  const db = getDatabase();
  const event = await db.prepare(
    `SELECT id, draft_id, title, public_slug, mode, board_scope, grid_size, status, win_condition, target_value,
            requires_review, public_spectator, spectator_delay_seconds, start_at, end_at, started_at, ended_at,
            baseline_status, revision, rules_json, created_at, updated_at
     FROM bingo_events WHERE id = ?`,
  ).bind(input.eventId).first<BingoEventRow>();
  if (!event) throw new BingoError('This bingo event does not exist.', 404);
  if (input.viewer === 'public' && !event.public_spectator) throw new BingoError('Public spectating is disabled for this event.', 404);
  const candidateScope = input.viewer === 'organizer' ? '' : input.viewer === 'team' ? ' AND team_id = ?' : ' AND 1 = 0';
  const candidateBindings = input.viewer === 'team' ? [event.id, input.teamId ?? ''] : [event.id];

  const [teamResult, memberResult, taskResult, claimResult, completionResult, activityResult, snapshotResult, candidateResult, verificationCount] = await Promise.all([
    db.prepare('SELECT id, event_id, source_team_index, name, color, emblem FROM bingo_teams WHERE event_id = ? ORDER BY source_team_index')
      .bind(event.id).all<TeamRow>(),
    db.prepare(`SELECT btm.id, btm.team_id, btm.player_id, btm.display_name, btm.normalized_name, btm.role
                FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id
                WHERE bt.event_id = ? ORDER BY bt.source_team_index, CASE btm.role WHEN 'captain' THEN 0 ELSE 1 END, btm.display_name`)
      .bind(event.id).all<MemberRow>(),
    db.prepare(`SELECT id, event_id, title, description, points, category, difficulty, verification_mode,
                       repeatable, max_completions, hidden, free_space, icon_key, rule_json, sort_order
                FROM bingo_tasks WHERE event_id = ? ORDER BY sort_order`).bind(event.id).all<TaskRow>(),
    db.prepare(`SELECT id, event_id, task_id, team_id, member_id, claimed_by_name, note, evidence_url,
                       evidence_upload_id, verification_source, verification_confidence, verification_candidate_id,
                       status, review_note, score_awarded, submitted_at, reviewed_at, approved_at
                FROM bingo_claims WHERE event_id = ? ORDER BY submitted_at DESC LIMIT 250`).bind(event.id).all<ClaimRow>(),
    db.prepare(`SELECT id, task_id, team_id, claim_id, completion_number, points, verification_source,
                       verification_confidence, completed_at
                FROM bingo_completions WHERE event_id = ? ORDER BY completed_at`).bind(event.id).all<CompletionRow>(),
    db.prepare(`SELECT id, team_id, task_id, activity_type, message, metadata_json, visible_at, created_at
                FROM bingo_activity WHERE event_id = ? ORDER BY created_at DESC LIMIT 80`).bind(event.id).all<ActivityRow>(),
    db.prepare(`SELECT phase, COUNT(*) AS count, MAX(captured_at) AS captured_at
                FROM bingo_player_snapshots WHERE event_id = ? GROUP BY phase`).bind(event.id)
      .all<{ phase: string; count: number; captured_at: string | null }>(),
    db.prepare(`SELECT id, task_id, team_id, member_id, source_summary, confidence, status, progress_value,
                       target_value, summary, details_json, created_at, updated_at, resolved_at
                FROM bingo_verification_candidates WHERE event_id = ?${candidateScope} ORDER BY updated_at DESC LIMIT 1000`)
      .bind(...candidateBindings).all<CandidateRow>(),
    db.prepare(`SELECT COUNT(*) AS count FROM bingo_verification_events WHERE event_id = ?${candidateScope}`)
      .bind(...candidateBindings).first<{ count: number }>(),
  ]);

  const now = Date.now();
  const cutoff = input.viewer === 'public' ? new Date(now - event.spectator_delay_seconds * 1000).toISOString() : new Date(now).toISOString();
  const completions = completionResult.results.filter((completion) => completion.completed_at <= cutoff);
  const scoreCompletions: BingoScoreCompletion[] = completions.map((completion) => ({
    taskId: completion.task_id, teamId: completion.team_id, points: completion.points,
  }));
  const eventRules = sanitizeBingoEventRules(
    parseJson(event.rules_json, {}), event.grid_size,
    ['lines', 'points', 'blackout', 'categories'].includes(event.win_condition)
      ? event.win_condition as BingoEventRules['scoring']['winCondition'] : 'points',
  );
  const standings = calculateBingoStandings(
    teamResult.results.map((team) => ({ id: team.id, name: team.name, sourceTeamIndex: team.source_team_index })),
    taskResult.results.map((task) => ({ id: task.id, sortOrder: task.sort_order, points: task.points, freeSpace: Boolean(task.free_space), category: task.category })),
    scoreCompletions,
    event.grid_size,
    ['lines', 'blackout', 'categories'].includes(event.win_condition)
      ? event.win_condition as 'lines' | 'blackout' | 'categories' : 'points',
    eventRules.scoring.categoryTarget,
  );
  const standingById = new Map(standings.map((standing) => [standing.id, standing]));
  const visibleClaims = claimResult.results.filter((claim) => {
    if (input.viewer === 'organizer') return true;
    if (input.viewer === 'team') return claim.team_id === input.teamId;
    return claim.status === 'approved' && Boolean(claim.approved_at && claim.approved_at <= cutoff);
  });
  const pendingClaims = claimResult.results.filter((claim) => claim.status === 'pending');

  return {
    event: {
      id: event.id,
      draftId: input.viewer === 'organizer' ? event.draft_id : null,
      title: event.title,
      publicSlug: event.public_slug,
      publicPath: `/bingo/event/${event.public_slug}`,
      mode: event.mode,
      boardScope: event.board_scope,
      gridSize: event.grid_size,
      status: event.status,
      winCondition: event.win_condition,
      targetValue: event.target_value,
      requiresReview: Boolean(event.requires_review),
      publicSpectator: Boolean(event.public_spectator),
      spectatorDelaySeconds: event.spectator_delay_seconds,
      startAt: event.start_at,
      endAt: event.end_at,
      startedAt: event.started_at,
      endedAt: event.ended_at,
      baselineStatus: event.baseline_status,
      revision: event.revision,
      rules: eventRules,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    },
    teams: teamResult.results.map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      emblem: team.emblem,
      sourceTeamIndex: team.source_team_index,
      members: memberResult.results.filter((member) => member.team_id === team.id).map((member) => ({
        id: member.id, playerId: member.player_id, name: member.display_name, role: member.role,
      })),
      score: standingById.get(team.id)?.score ?? 0,
      completedCount: standingById.get(team.id)?.completedCount ?? 0,
      lineCount: standingById.get(team.id)?.lineCount ?? 0,
      categoryCount: standingById.get(team.id)?.categoryCount ?? 0,
      rank: standings.findIndex((standing) => standing.id === team.id) + 1,
    })),
    tasks: taskResult.results.map((task) => {
      const owners = completions.filter((completion) => completion.task_id === task.id).map((completion) => completion.team_id);
      const pendingTeamIds = pendingClaims.filter((claim) => claim.task_id === task.id).map((claim) => claim.team_id);
      const rule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
      const prerequisiteTaskIds = rule.prerequisitePositions.flatMap((position) => {
        const prerequisite = taskResult.results.find((candidate) => candidate.sort_order === position);
        return prerequisite ? [prerequisite.id] : [];
      });
      const prerequisiteCompleteFor = (teamId: string) => prerequisiteTaskIds.every((taskId) =>
        completions.some((completion) => completion.task_id === taskId && completion.team_id === teamId));
      const unlocked = !prerequisiteTaskIds.length
        || input.viewer === 'team' && Boolean(input.teamId && prerequisiteCompleteFor(input.teamId))
        || input.viewer === 'public' && teamResult.results.some((team) => prerequisiteCompleteFor(team.id));
      const viewerHasCompletion = input.viewer === 'team' && input.teamId ? owners.includes(input.teamId) : owners.length > 0;
      const concealed = Boolean(task.hidden) && input.viewer !== 'organizer' && !viewerHasCompletion && !unlocked;
      const availability = input.viewer === 'team' && input.teamId ? claimAvailability({
        mode: event.mode,
        repeatable: Boolean(task.repeatable),
        maxCompletions: task.max_completions,
        taskId: task.id,
        teamId: input.teamId,
        completions: scoreCompletions,
        hasPendingClaim: pendingTeamIds.includes(input.teamId),
        prerequisiteTaskIds,
      }) : null;
      return {
        id: task.id,
        title: concealed ? 'Unrevealed task' : task.title,
        description: concealed ? '' : task.description,
        points: concealed ? null : task.points,
        category: concealed ? 'Hidden' : task.category,
        difficulty: concealed ? null : task.difficulty,
        verificationMode: concealed ? null : task.verification_mode,
        repeatable: Boolean(task.repeatable),
        maxCompletions: task.max_completions,
        hidden: Boolean(task.hidden),
        concealed,
        freeSpace: Boolean(task.free_space),
        iconKey: task.icon_key,
        rule: concealed ? sanitizeBingoTaskRule({}, 'manual') : rule,
        sortOrder: task.sort_order,
        ownerTeamIds: [...new Set(owners)],
        pendingTeamIds: input.viewer === 'organizer'
          ? [...new Set(pendingTeamIds)]
          : input.viewer === 'team' && input.teamId && pendingTeamIds.includes(input.teamId) ? [input.teamId] : [],
        claimable: event.status === 'live' && !task.free_space && (availability?.allowed ?? false),
        claimBlockedReason: event.status !== 'live'
          ? 'Claims open when the organizer starts the event.'
          : task.free_space ? 'The free space is already counted.' : availability?.reason ?? null,
      };
    }),
    claims: visibleClaims.map((claim) => ({
      id: claim.id,
      taskId: claim.task_id,
      teamId: claim.team_id,
      memberId: claim.member_id,
      claimedByName: claim.claimed_by_name,
      note: input.viewer === 'public' ? '' : claim.note,
      evidenceUrl: input.viewer === 'public' ? null : claim.evidence_url,
      evidenceUploadId: input.viewer === 'organizer' ? claim.evidence_upload_id : null,
      status: claim.status,
      reviewNote: input.viewer === 'public' ? null : claim.review_note,
      verificationSource: claim.verification_source,
      verificationConfidence: claim.verification_confidence,
      verificationCandidateId: input.viewer === 'organizer' ? claim.verification_candidate_id : null,
      scoreAwarded: claim.score_awarded,
      submittedAt: claim.submitted_at,
      reviewedAt: claim.reviewed_at,
      approvedAt: claim.approved_at,
    })),
    completions: completions.map((completion) => ({
      id: completion.id,
      taskId: completion.task_id,
      teamId: completion.team_id,
      claimId: completion.claim_id,
      completionNumber: completion.completion_number,
      points: completion.points,
      verificationSource: completion.verification_source,
      verificationConfidence: completion.verification_confidence,
      completedAt: completion.completed_at,
    })),
    activity: activityResult.results.filter((activity) => {
      if (input.viewer === 'organizer') return true;
      if (input.viewer === 'public') {
        return activity.visible_at <= new Date(now).toISOString()
          && !['claim.submitted', 'claim.rejected'].includes(activity.activity_type);
      }
      return !['claim.submitted', 'claim.rejected'].includes(activity.activity_type) || activity.team_id === input.teamId;
    }).slice(0, 40).map((activity) => ({
      id: activity.id,
      teamId: activity.team_id,
      taskId: activity.task_id,
      type: activity.activity_type,
      message: activity.message,
      metadata: parseJson<Record<string, unknown>>(activity.metadata_json, {}),
      createdAt: activity.created_at,
    })),
    snapshots: snapshotResult.results.map((snapshot) => ({ phase: snapshot.phase, count: snapshot.count, capturedAt: snapshot.captured_at })),
    verification: {
      eventCount: verificationCount?.count ?? 0,
      candidates: candidateResult.results.filter((candidate) => {
        if (input.viewer === 'organizer') return true;
        if (input.viewer === 'team') return candidate.team_id === input.teamId && candidate.status !== 'dismissed';
        return false;
      }).map((candidate) => ({
        id: candidate.id, taskId: candidate.task_id, teamId: candidate.team_id, memberId: candidate.member_id,
        sourceSummary: candidate.source_summary, confidence: candidate.confidence, status: candidate.status,
        progressValue: candidate.progress_value, targetValue: candidate.target_value, summary: candidate.summary,
        details: input.viewer === 'public' ? {} : parseJson<Record<string, unknown>>(candidate.details_json, {}),
        createdAt: candidate.created_at, updatedAt: candidate.updated_at, resolvedAt: candidate.resolved_at,
      })),
    },
    viewer: { type: input.viewer, teamId: input.teamId ?? null },
  };
}

export function bingoActivityInsert(input: {
  eventId: string; teamId?: string | null; taskId?: string | null; type: string; message: string;
  metadata?: Record<string, unknown>; delaySeconds?: number; now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const visibleAt = new Date(Date.parse(now) + (input.delaySeconds ?? 0) * 1000).toISOString();
  return getDatabase().prepare(
    `INSERT INTO bingo_activity
      (id, event_id, team_id, task_id, activity_type, message, metadata_json, visible_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), input.eventId, input.teamId ?? null, input.taskId ?? null, input.type,
    input.message, input.metadata ? JSON.stringify(input.metadata) : null, visibleAt, now);
}

export async function bumpBingoRevision(eventId: string, now = new Date().toISOString()) {
  await getDatabase().prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId).run();
}

export async function chunkedBatch(statements: D1PreparedStatement[], size = 50) {
  const db = getDatabase();
  for (let index = 0; index < statements.length; index += size) await db.batch(statements.slice(index, index + size));
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

export function bingoErrorResponse(error: unknown) {
  const status = error instanceof BingoError ? error.status : 500;
  return { status, message: error instanceof Error && status < 500 ? error.message : 'The bingo hall could not complete that request.' };
}
