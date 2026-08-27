import { recordAudit } from './audit';
import { BingoError, bingoActivityInsert } from './bingo';
import { claimAvailability, type BingoScoreCompletion } from './bingo-scoring';
import { getDatabase } from './db';
import { scheduleDiscordEvent } from './discord-webhooks';
import type { BingoMode } from './types';

type ReviewableClaim = {
  id: string;
  event_id: string;
  draft_id: string;
  event_title: string;
  event_status: string;
  mode: BingoMode;
  spectator_delay_seconds: number;
  task_id: string;
  task_title: string;
  task_points: number;
  repeatable: number;
  max_completions: number;
  free_space: number;
  team_id: string;
  team_name: string;
  claimed_by_name: string;
  evidence_upload_id: string | null;
  status: string;
};

export async function reviewBingoClaim(input: {
  claimId: string;
  eventId: string;
  action: 'approve' | 'reject';
  reviewNote?: string;
  actorType: 'organizer' | 'system';
}) {
  const db = getDatabase();
  const claim = await db.prepare(
    `SELECT bc.id, bc.event_id, bc.task_id, bc.team_id, bc.claimed_by_name, bc.evidence_upload_id, bc.status,
            be.draft_id, be.title AS event_title, be.status AS event_status, be.mode, be.spectator_delay_seconds,
            bt.title AS task_title, bt.points AS task_points, bt.repeatable, bt.max_completions, bt.free_space,
            bteam.name AS team_name
     FROM bingo_claims bc
     JOIN bingo_events be ON be.id = bc.event_id
     JOIN bingo_tasks bt ON bt.id = bc.task_id
     JOIN bingo_teams bteam ON bteam.id = bc.team_id
     WHERE bc.id = ? AND bc.event_id = ?`,
  ).bind(input.claimId, input.eventId).first<ReviewableClaim>();
  if (!claim) throw new BingoError('That claim no longer exists.', 404);
  if (claim.status !== 'pending') throw new BingoError('That claim has already been reviewed.', 409);
  if (input.action === 'approve' && claim.event_status !== 'live') throw new BingoError('Claims can only be approved while the bingo is live.', 409);

  const now = new Date().toISOString();
  const reviewNote = (input.reviewNote ?? '').trim().slice(0, 500) || null;
  if (input.action === 'reject') {
    const result = await db.prepare(
      `UPDATE bingo_claims SET status = 'rejected', review_note = ?, reviewed_at = ?
       WHERE id = ? AND event_id = ? AND status = 'pending'`,
    ).bind(reviewNote, now, claim.id, claim.event_id).run();
    if (!result.meta.changes) throw new BingoError('That claim has already been reviewed.', 409);
    await db.batch([
      bingoActivityInsert({
        eventId: claim.event_id, teamId: claim.team_id, taskId: claim.task_id,
        type: 'claim.rejected', message: `${claim.team_name}'s claim for ${claim.task_title} needs another look.`, now,
      }),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, claim.event_id),
    ]);
    await recordAudit(db, {
      draftId: claim.draft_id, actorType: input.actorType, eventType: 'bingo.claim_rejected',
      metadata: { eventId: claim.event_id, claimId: claim.id, taskId: claim.task_id, teamId: claim.team_id }, createdAt: now,
    }).catch(() => undefined);
    return { status: 'rejected' as const, scoreAwarded: 0 };
  }

  if (claim.free_space) throw new BingoError('The free space is already counted and cannot be claimed.', 409);
  const completionRows = await db.prepare(
    'SELECT task_id, team_id, points FROM bingo_completions WHERE event_id = ? AND task_id = ?',
  ).bind(claim.event_id, claim.task_id).all<{ task_id: string; team_id: string; points: number }>();
  const completions: BingoScoreCompletion[] = completionRows.results.map((row) => ({
    taskId: row.task_id, teamId: row.team_id, points: row.points,
  }));
  const availability = claimAvailability({
    mode: claim.mode,
    repeatable: Boolean(claim.repeatable),
    maxCompletions: claim.max_completions,
    taskId: claim.task_id,
    teamId: claim.team_id,
    completions,
    hasPendingClaim: false,
  });
  if (!availability.allowed) throw new BingoError(availability.reason ?? 'That tile is no longer available.', 409);
  const completionNumber = completions.filter((completion) => completion.teamId === claim.team_id).length + 1;
  const delay = Math.max(0, claim.spectator_delay_seconds);
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO bingo_completions
          (id, event_id, task_id, team_id, claim_id, completion_number, global_lock_key, points, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), claim.event_id, claim.task_id, claim.team_id, claim.id, completionNumber,
        claim.mode === 'lockout' ? claim.task_id : null, claim.task_points, now),
      db.prepare(
        `UPDATE bingo_claims SET status = 'approved', review_note = ?, score_awarded = ?, reviewed_at = ?, approved_at = ?
         WHERE id = ? AND event_id = ? AND status = 'pending'`,
      ).bind(reviewNote, claim.task_points, now, now, claim.id, claim.event_id),
      ...(claim.evidence_upload_id ? [db.prepare('UPDATE bingo_evidence_uploads SET consumed_at = ? WHERE id = ?').bind(now, claim.evidence_upload_id)] : []),
      bingoActivityInsert({
        eventId: claim.event_id, teamId: claim.team_id, taskId: claim.task_id, type: 'claim.approved',
        message: `${claim.team_name} claimed ${claim.task_title} for ${claim.task_points} point${claim.task_points === 1 ? '' : 's'}!`,
        metadata: { points: claim.task_points, claimedBy: claim.claimed_by_name }, delaySeconds: delay, now,
      }),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, claim.event_id),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE|constraint/i.test(message)) throw new BingoError('That tile was claimed moments ago. Refresh the board to see the winner.', 409);
    throw error;
  }
  await recordAudit(db, {
    draftId: claim.draft_id, actorType: input.actorType, eventType: 'bingo.claim_approved',
    metadata: { eventId: claim.event_id, claimId: claim.id, taskId: claim.task_id, teamId: claim.team_id, points: claim.task_points }, createdAt: now,
  }).catch(() => undefined);
  scheduleDiscordEvent(claim.draft_id, 'bingo.claim_approved', {
    username: "Terry's Drafting",
    embeds: [{
      title: `${claim.team_name} completed a bingo tile`,
      description: `${claim.task_title} · ${claim.task_points} point${claim.task_points === 1 ? '' : 's'}`,
      color: 0xd0a23d,
    }],
  });
  return { status: 'approved' as const, scoreAwarded: claim.task_points };
}
