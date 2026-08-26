import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { promoteWaitlist } from '../../../../../lib/registration';
import { clampInteger } from '../../../../../lib/validation';
import { scheduleDiscordEvent } from '../../../../../lib/discord-webhooks';

export async function PUT(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDatabase();
    const draftId = await resolveManagerDraftId(token);
    const draft = draftId ? await db
      .prepare(`SELECT id, signup_token_hash, registration_open, registration_capacity,
                       signup_approval_mode, registration_deadline, ranking_deadline,
                       answers_visibility, archived_at
                FROM drafts WHERE id = ?`)
      .bind(draftId)
      .first<{
        id: string; signup_token_hash: string | null; registration_open: number; registration_capacity: number;
        signup_approval_mode: number; registration_deadline: string | null; ranking_deadline: string | null;
        answers_visibility: string; archived_at: string | null;
      }>() : null;
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (!draft.signup_token_hash) return json({ error: 'This event does not use public registration.' }, { status: 409 });
    const open = typeof body.open === 'boolean' ? body.open : Boolean(draft.registration_open);
    const capacity = body.capacity === undefined
      ? draft.registration_capacity
      : clampInteger(body.capacity, 2, 120, draft.registration_capacity);
    const approvalMode = typeof body.approvalMode === 'boolean' ? body.approvalMode : Boolean(draft.signup_approval_mode);
    const registrationDeadline = parseDeadline(body.registrationDeadline, draft.registration_deadline);
    const rankingDeadline = parseDeadline(body.rankingDeadline, draft.ranking_deadline);
    const answersVisibility = ['organizer', 'captains', 'public'].includes(String(body.answersVisibility))
      ? String(body.answersVisibility)
      : draft.answers_visibility;
    const now = new Date().toISOString();
    await db
      .prepare(`UPDATE drafts SET registration_open = ?, registration_capacity = ?,
                signup_approval_mode = ?, registration_deadline = ?, ranking_deadline = ?,
                answers_visibility = ?, status = CASE WHEN ? THEN 'archived' WHEN ? THEN 'registration' ELSE status END,
                updated_at = ? WHERE id = ?`)
      .bind(open ? 1 : 0, capacity, approvalMode ? 1 : 0, registrationDeadline, rankingDeadline,
        answersVisibility, draft.archived_at ? 1 : 0, open ? 1 : 0, now, draft.id)
      .run();
    if (!approvalMode && draft.signup_approval_mode) {
      await db.prepare("UPDATE players SET signup_status = 'waitlisted', updated_at = ? WHERE draft_id = ? AND signup_status = 'pending' AND withdrawn_at IS NULL")
        .bind(now, draft.id).run();
    }
    const promotedPlayerIds = approvalMode ? [] : await promoteWaitlist(db, draft.id, capacity);
    await recordAudit(db, {
      draftId: draft.id, actorType: 'organizer', eventType: open ? 'registration.opened' : 'registration.closed',
      metadata: { capacity, approvalMode, registrationDeadline, rankingDeadline, answersVisibility, promotedPlayerIds },
      createdAt: now,
    });
    if (!open) scheduleDiscordEvent(draft.id, 'registration.closed', {
      username: "Terry's Drafting", embeds: [{ title: 'Registration closed', description: 'Captain rankings can begin.', color: 0x7c5a2d }],
    });
    return json({
      registrationOpen: open, capacity, approvalMode, registrationDeadline,
      rankingDeadline, answersVisibility, promotedPlayerIds,
    });
  } catch (error) {
    console.error('update registration failed', error);
    return json({ error: 'Registration could not be updated.' }, { status: 500 });
  }
}

function parseDeadline(value: unknown, fallback: string | null) {
  if (value === null || value === '') return null;
  if (value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}
