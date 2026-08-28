import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoActivityInsert, bingoErrorResponse, parseJson, resolveBingoTeam } from '@/lib/bingo';
import { reviewBingoClaim } from '@/lib/bingo-claims';
import { claimAvailability } from '@/lib/bingo-scoring';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { bingoUnlockPrerequisites, sanitizeBingoEventRules, sanitizeBingoTaskRule } from '@/lib/bingo-rules';
import { scheduleDiscordEvent } from '@/lib/discord-webhooks';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import type { BingoMode, BingoVerificationMode } from '@/lib/types';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    await enforceRateLimit({ request, scope: 'bingo-claims', limit: 25, windowSeconds: 600, subject: team.id });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';
    const memberId = typeof body.memberId === 'string' ? body.memberId : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const evidenceUrl = validEvidenceUrl(body.evidenceUrl);
    const evidenceUploadId = typeof body.evidenceUploadId === 'string' ? body.evidenceUploadId : null;
    const db = getDatabase();
    const [event, task, member, upload, taskRows, completionRows, pending] = await Promise.all([
      db.prepare('SELECT id, draft_id, title, status, mode, board_scope, grid_size, rules_json, requires_review FROM bingo_events WHERE id = ?').bind(team.event_id)
        .first<{ id: string; draft_id: string; title: string; status: string; mode: BingoMode; board_scope: string; grid_size: number; rules_json: string | null; requires_review: number }>(),
      db.prepare(`SELECT id, title, verification_mode, repeatable, max_completions, free_space, sort_order, rule_json
                  FROM bingo_tasks WHERE id = ? AND event_id = ?`).bind(taskId, team.event_id)
        .first<{ id: string; title: string; verification_mode: BingoVerificationMode; repeatable: number; max_completions: number; free_space: number; sort_order: number; rule_json: string }>(),
      db.prepare('SELECT id, display_name FROM bingo_team_members WHERE id = ? AND team_id = ?').bind(memberId, team.id)
        .first<{ id: string; display_name: string }>(),
      evidenceUploadId ? db.prepare(`SELECT id FROM bingo_evidence_uploads
        WHERE id = ? AND event_id = ? AND team_id = ? AND consumed_at IS NULL`).bind(evidenceUploadId, team.event_id, team.id).first<{ id: string }>() : null,
      db.prepare('SELECT id, sort_order FROM bingo_tasks WHERE event_id = ?').bind(team.event_id)
        .all<{ id: string; sort_order: number }>(),
      db.prepare('SELECT task_id, team_id, points FROM bingo_completions WHERE event_id = ?')
        .bind(team.event_id).all<{ task_id: string; team_id: string; points: number }>(),
      db.prepare("SELECT id FROM bingo_claims WHERE event_id = ? AND task_id = ? AND team_id = ? AND status = 'pending' LIMIT 1")
        .bind(team.event_id, taskId, team.id).first<{ id: string }>(),
    ]);
    if (!event || event.status !== 'live') throw new BingoError('Claims are only open while the bingo is live.', 409);
    if (!task) throw new BingoError('That tile is not on this bingo board.', 404);
    if (!member) throw new BingoError('Choose the team member who completed the task.');
    if (task.free_space) throw new BingoError('The free space is already counted.', 409);
    if (evidenceUploadId && !upload) throw new BingoError('That screenshot is missing, expired, or belongs to another team.');
    if (['screenshot', 'hybrid'].includes(task.verification_mode) && !evidenceUrl && !evidenceUploadId) {
      throw new BingoError('Add a screenshot or HTTPS evidence link for this tile.');
    }
    const taskRule = sanitizeBingoTaskRule(parseJson(task.rule_json, {}), task.verification_mode);
    const eventRules = sanitizeBingoEventRules(parseJson(event.rules_json, {}), event.grid_size);
    const unlockRule = bingoUnlockPrerequisites(task.sort_order, taskRule, eventRules);
    const prerequisiteTaskIds = unlockRule.positions.flatMap((position) => {
      const prerequisite = taskRows.results.find((row) => row.sort_order === position);
      return prerequisite ? [prerequisite.id] : [];
    });
    const availability = claimAvailability({
      mode: event.mode, repeatable: Boolean(task.repeatable), maxCompletions: task.max_completions,
      taskId, teamId: team.id,
      completions: completionRows.results.map((row) => ({ taskId: row.task_id, teamId: row.team_id, points: row.points })),
      hasPendingClaim: Boolean(pending),
      prerequisiteTaskIds,
      prerequisiteMode: unlockRule.mode,
      prerequisiteTeamId: event.board_scope === 'shared' ? null : team.id,
      globalLockout: event.board_scope === 'shared' && eventRules.progression.tileOwnership === 'first_team',
    });
    if (!availability.allowed) throw new BingoError(availability.reason ?? 'That tile cannot be claimed.', 409);
    const claimId = crypto.randomUUID();
    const now = new Date().toISOString();
    const verificationSource = evidenceUploadId || evidenceUrl ? 'screenshot' : 'manual';
    await db.batch([
      db.prepare(`INSERT INTO bingo_claims
        (id, event_id, task_id, team_id, member_id, claimed_by_name, note, evidence_url, evidence_upload_id,
         verification_source, verification_confidence, status, score_awarded, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', 'pending', 0, ?)`).bind(claimId, event.id, task.id, team.id, member.id,
        member.display_name, note, evidenceUrl, evidenceUploadId, verificationSource, now),
      bingoActivityInsert({ eventId: event.id, teamId: team.id, taskId: task.id, type: 'claim.submitted',
        message: `${team.name} submitted ${task.title} for review.`, now }),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, event.id),
    ]);
    await recordAudit(db, {
      draftId: event.draft_id, actorType: 'participant', actorReference: team.id, eventType: 'bingo.claim_submitted',
      metadata: { eventId: event.id, claimId, taskId: task.id, memberId: member.id }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    scheduleDiscordEvent(event.draft_id, 'bingo.claim_submitted', {
      username: "Terry's Drafting",
      embeds: [{ title: 'Bingo claim awaiting review', description: `${team.name} · ${task.title} · ${member.display_name}`, color: 0xb58932 }],
    });
    if (!event.requires_review) {
      const reviewed = await reviewBingoClaim({ claimId, eventId: event.id, action: 'approve', actorType: 'system' });
      return json({ id: claimId, ...reviewed }, { status: 201 });
    }
    return json({ id: claimId, status: 'pending' }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('submit bingo claim failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

function validEvidenceUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.toString().length > 500) throw new Error('invalid');
    return url.toString();
  } catch { throw new BingoError('Evidence links must be valid HTTPS URLs.'); }
}
