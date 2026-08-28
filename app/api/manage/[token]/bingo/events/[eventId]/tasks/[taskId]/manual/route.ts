import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoActivityInsert, bingoErrorResponse, parseJson, requireManagedBingoEvent } from '@/lib/bingo';
import { bingoUnlockPrerequisites, sanitizeBingoEventRules, sanitizeBingoTaskRule } from '@/lib/bingo-rules';
import { claimAvailability, type BingoScoreCompletion } from '@/lib/bingo-scoring';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import type { BingoVerificationMode } from '@/lib/types';

type Context = { params: Promise<{ token: string; eventId: string; taskId: string }> };

type TaskRow = {
  id: string; title: string; description: string; category: string; points: number; verification_mode: BingoVerificationMode;
  repeatable: number; max_completions: number; free_space: number; sort_order: number; rule_json: string;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token, eventId, taskId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    if (event.status === 'archived') throw new BingoError('Archived events are read-only.', 409);
    await enforceRateLimit({ request, scope: 'bingo-manual-scorekeeping', limit: 120, windowSeconds: 3_600, subject: eventId });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? '');
    const reason = text(body.reason, 500);
    if (reason.length < 3) throw new BingoError('Add a short organizer reason so the correction is auditable.');
    const db = getDatabase();
    const task = await db.prepare(
      `SELECT id, title, description, category, points, verification_mode, repeatable, max_completions,
              free_space, sort_order, rule_json
       FROM bingo_tasks WHERE id = ? AND event_id = ?`,
    ).bind(taskId, eventId).first<TaskRow>();
    if (!task) throw new BingoError('That tile is not on this board.', 404);
    const now = new Date().toISOString();

    if (action === 'edit_content') {
      const rule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
      const presentation = body.presentation && typeof body.presentation === 'object' ? body.presentation as Record<string, unknown> : {};
      const details = body.details && typeof body.details === 'object' ? body.details as Record<string, unknown> : {};
      const nextRule = sanitizeBingoTaskRule({
        ...rule,
        presentation: { ...rule.presentation, ...presentation },
        details: { ...rule.details, ...details },
      }, task.verification_mode);
      const title = text(body.title, 80) || task.title;
      const description = text(body.description, 400);
      const category = text(body.category, 40) || task.category;
      await db.batch([
        db.prepare(`UPDATE bingo_tasks SET title = ?, description = ?, category = ?, rule_json = ?, updated_at = ?
                    WHERE id = ? AND event_id = ?`)
          .bind(title, description, category, JSON.stringify(nextRule), now, task.id, eventId),
        bingoActivityInsert({ eventId, taskId: task.id, type: 'task.edited', message: `The organizer clarified ${title}.`, metadata: { reason }, now }),
        db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
      ]);
      await audit(request, event.draft_id, eventId, 'bingo.task_content_edited', { taskId, reason }, now);
      return json({ updated: true });
    }

    if (!['live', 'complete'].includes(event.status)) throw new BingoError('Manual scorekeeping opens after the bingo starts.', 409);
    const teamId = typeof body.teamId === 'string' ? body.teamId : '';
    const memberId = typeof body.memberId === 'string' && body.memberId ? body.memberId : null;
    const team = await db.prepare('SELECT id, name FROM bingo_teams WHERE id = ? AND event_id = ?')
      .bind(teamId, eventId).first<{ id: string; name: string }>();
    if (!team) throw new BingoError('Choose a team from this event.');
    const member = memberId ? await db.prepare(
      'SELECT id, display_name FROM bingo_team_members WHERE id = ? AND team_id = ?',
    ).bind(memberId, team.id).first<{ id: string; display_name: string }>() : null;
    if (memberId && !member) throw new BingoError('That player is not on the selected team.');
    const taskRule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
    const suggestedTarget = taskRule.verifier.amount ?? 1;
    const targetValue = boundedNumber(body.targetValue, 0.000001, 1_000_000_000_000, suggestedTarget);
    const progressValue = boundedNumber(body.progressValue, 0, 1_000_000_000_000, 0);

    if (action === 'set_progress') {
      await db.batch([
        manualProgressUpsert({ eventId, taskId, teamId, memberId: member?.id ?? null, progressValue, targetValue, reason, now }),
        bingoActivityInsert({ eventId, teamId, taskId, type: 'progress.adjusted', message: `${team.name}'s progress on ${task.title} was set to ${formatProgress(progressValue, targetValue)}.`, metadata: { progressValue, targetValue, reason }, delaySeconds: event.spectator_delay_seconds, now }),
        db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
      ]);
      await audit(request, event.draft_id, eventId, 'bingo.progress_adjusted', { taskId, teamId, memberId, progressValue, targetValue, reason }, now);
      return json({ progressValue, targetValue });
    }

    if (action === 'reset_progress') {
      await db.batch([
        db.prepare('DELETE FROM bingo_manual_progress WHERE event_id = ? AND task_id = ? AND team_id = ?').bind(eventId, taskId, teamId),
        bingoActivityInsert({ eventId, teamId, taskId, type: 'progress.reset', message: `${team.name}'s manual progress on ${task.title} was reset.`, metadata: { reason }, delaySeconds: event.spectator_delay_seconds, now }),
        db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
      ]);
      await audit(request, event.draft_id, eventId, 'bingo.progress_reset', { taskId, teamId, reason }, now);
      return json({ reset: true });
    }

    if (action === 'reopen') {
      const completion = await db.prepare(
        `SELECT id, claim_id, completion_number FROM bingo_completions
         WHERE event_id = ? AND task_id = ? AND team_id = ? ORDER BY completion_number DESC LIMIT 1`,
      ).bind(eventId, taskId, teamId).first<{ id: string; claim_id: string; completion_number: number }>();
      if (!completion) throw new BingoError('That team has no completion to reopen.', 409);
      await db.batch([
        db.prepare('DELETE FROM bingo_completions WHERE id = ?').bind(completion.id),
        db.prepare(`UPDATE bingo_claims SET status = 'withdrawn', review_note = ?, score_awarded = 0, reviewed_at = ? WHERE id = ?`)
          .bind(reason, now, completion.claim_id),
        manualProgressUpsert({ eventId, taskId, teamId, memberId: member?.id ?? null, progressValue, targetValue, reason, now }),
        bingoActivityInsert({ eventId, teamId, taskId, type: 'completion.reopened', message: `${team.name}'s completion of ${task.title} was reopened by the organizer.`, metadata: { completionNumber: completion.completion_number, reason }, delaySeconds: event.spectator_delay_seconds, now }),
        db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
      ]);
      await audit(request, event.draft_id, eventId, 'bingo.completion_reopened', { taskId, teamId, completionId: completion.id, reason }, now);
      return json({ reopened: true });
    }

    if (action !== 'complete') throw new BingoError('Choose a manual scorekeeping action.');
    if (task.free_space) throw new BingoError('The free space is already counted.', 409);
    const [completionRows, taskRows, pendingClaim] = await Promise.all([
      db.prepare('SELECT task_id, team_id, points FROM bingo_completions WHERE event_id = ?')
        .bind(eventId).all<{ task_id: string; team_id: string; points: number }>(),
      db.prepare('SELECT id, sort_order FROM bingo_tasks WHERE event_id = ?')
        .bind(eventId).all<{ id: string; sort_order: number }>(),
      db.prepare(`SELECT id FROM bingo_claims WHERE event_id = ? AND task_id = ? AND team_id = ? AND status = 'pending'
                  ORDER BY submitted_at DESC LIMIT 1`).bind(eventId, taskId, teamId).first<{ id: string }>(),
    ]);
    const completions: BingoScoreCompletion[] = completionRows.results.map((row) => ({ taskId: row.task_id, teamId: row.team_id, points: row.points }));
    const eventRules = sanitizeBingoEventRules(parseJson(event.rules_json, {}), event.grid_size);
    const unlockRule = bingoUnlockPrerequisites(task.sort_order, taskRule, eventRules);
    const prerequisiteTaskIds = unlockRule.positions.flatMap((position) => {
      const prerequisite = taskRows.results.find((candidate) => candidate.sort_order === position);
      return prerequisite ? [prerequisite.id] : [];
    });
    const availability = claimAvailability({
      mode: event.mode, repeatable: Boolean(task.repeatable), maxCompletions: task.max_completions,
      taskId, teamId, completions, hasPendingClaim: false, prerequisiteTaskIds, prerequisiteMode: unlockRule.mode,
      prerequisiteTeamId: event.board_scope === 'shared' ? null : teamId,
      globalLockout: event.board_scope === 'shared' && eventRules.progression.tileOwnership === 'first_team',
    });
    if (!availability.allowed) throw new BingoError(availability.reason ?? 'That tile cannot be completed.', 409);
    const claimId = pendingClaim?.id ?? crypto.randomUUID();
    const completionNumber = completions.filter((completion) => completion.taskId === taskId && completion.teamId === teamId).length + 1;
    const claimedByName = member?.display_name ?? 'Organizer correction';
    const claimStatement = pendingClaim
      ? db.prepare(`UPDATE bingo_claims SET member_id = COALESCE(?, member_id), claimed_by_name = ?, note = ?, verification_source = 'organizer',
                    verification_confidence = 'reviewed', status = 'approved', review_note = ?, score_awarded = ?, reviewed_at = ?, approved_at = ?
                    WHERE id = ? AND status = 'pending'`)
        .bind(member?.id ?? null, claimedByName, reason, reason, task.points, now, now, claimId)
      : db.prepare(`INSERT INTO bingo_claims
          (id, event_id, task_id, team_id, member_id, claimed_by_name, note, verification_source,
           verification_confidence, status, review_note, score_awarded, submitted_at, reviewed_at, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'organizer', 'reviewed', 'approved', ?, ?, ?, ?, ?)`)
        .bind(claimId, eventId, taskId, teamId, member?.id ?? null, claimedByName, reason, reason, task.points, now, now, now);
    try {
      await db.batch([
        claimStatement,
        db.prepare(`INSERT INTO bingo_completions
          (id, event_id, task_id, team_id, claim_id, completion_number, global_lock_key, points,
           verification_source, verification_confidence, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'organizer', 'reviewed', ?)`)
          .bind(crypto.randomUUID(), eventId, taskId, teamId, claimId, completionNumber,
            event.mode === 'lockout' || event.board_scope === 'shared' && eventRules.progression.tileOwnership === 'first_team' ? taskId : null,
            task.points, now),
        manualProgressUpsert({ eventId, taskId, teamId, memberId: member?.id ?? null, progressValue: targetValue, targetValue, reason, now }),
        bingoActivityInsert({ eventId, teamId, taskId, type: 'completion.manual', message: `${team.name} completed ${task.title} for ${task.points} point${task.points === 1 ? '' : 's'} (organizer entry).`, metadata: { reason, memberId: member?.id ?? null }, delaySeconds: event.spectator_delay_seconds, now }),
        db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
      ]);
    } catch (error) {
      if (/UNIQUE|constraint/i.test(error instanceof Error ? error.message : String(error))) throw new BingoError('That tile was completed moments ago. Refresh and try again.', 409);
      throw error;
    }
    await audit(request, event.draft_id, eventId, 'bingo.completion_manual', { taskId, teamId, memberId, claimId, points: task.points, reason }, now);
    return json({ completed: true, claimId, completionNumber });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('manual bingo scorekeeping failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

function manualProgressUpsert(input: {
  eventId: string; taskId: string; teamId: string; memberId: string | null;
  progressValue: number; targetValue: number; reason: string; now: string;
}) {
  return getDatabase().prepare(
    `INSERT INTO bingo_manual_progress
      (id, event_id, task_id, team_id, member_id, progress_value, target_value, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id, task_id, team_id) DO UPDATE SET
       member_id = excluded.member_id, progress_value = excluded.progress_value,
       target_value = excluded.target_value, note = excluded.note, updated_at = excluded.updated_at`,
  ).bind(crypto.randomUUID(), input.eventId, input.taskId, input.teamId, input.memberId,
    input.progressValue, input.targetValue, input.reason, input.now, input.now);
}

async function audit(request: Request, draftId: string, eventId: string, eventType: string, metadata: unknown, now: string) {
  await recordAudit(getDatabase(), {
    draftId, actorType: 'organizer', eventType, metadata: { eventId, ...metadata as Record<string, unknown> },
    requestId: requestId(request), createdAt: now,
  }).catch(() => undefined);
}

function text(value: unknown, max: number) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''; }
function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}
function formatProgress(value: number, target: number) { return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} / ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(target)}`; }
