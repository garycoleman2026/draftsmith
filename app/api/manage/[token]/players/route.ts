import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { promoteWaitlist } from '../../../../../lib/registration';

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { playerId?: unknown; status?: unknown };
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const status = ['approved', 'pending', 'waitlisted', 'rejected'].includes(String(body.status))
      ? String(body.status) as 'approved' | 'pending' | 'waitlisted' | 'rejected'
      : null;
    if (!playerId || !status) return json({ error: 'Choose a player and valid registration status.' }, { status: 400 });
    const db = getDatabase();
    const [draft, player, captain] = await Promise.all([
      db.prepare('SELECT registration_capacity FROM drafts WHERE id = ?').bind(draftId).first<{ registration_capacity: number }>(),
      db.prepare('SELECT id, signup_status FROM players WHERE id = ? AND draft_id = ? AND withdrawn_at IS NULL')
        .bind(playerId, draftId).first<{ id: string; signup_status: string }>(),
      db.prepare('SELECT id FROM captains WHERE draft_id = ? AND player_id = ?').bind(draftId, playerId).first<{ id: string }>(),
    ]);
    if (!draft || !player) return json({ error: 'That player is not on this roster.' }, { status: 404 });
    if (captain && status !== 'approved') {
      return json({ error: 'Reassign this captain before changing their registration status.' }, { status: 409 });
    }
    let nextStatus = status;
    if (status === 'approved' && player.signup_status !== 'approved') {
      const approved = await db.prepare("SELECT COUNT(*) AS count FROM players WHERE draft_id = ? AND signup_status = 'approved' AND withdrawn_at IS NULL")
        .bind(draftId).first<{ count: number }>();
      if ((approved?.count ?? 0) >= draft.registration_capacity) nextStatus = 'waitlisted';
    }
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE players SET signup_status = ?, updated_at = ? WHERE id = ?').bind(nextStatus, now, playerId),
      db.prepare('UPDATE captains SET submitted_at = NULL, rankings_frozen_at = NULL WHERE draft_id = ?').bind(draftId),
      db.prepare("UPDATE drafts SET status = 'registration', result_json = NULL, updated_at = ? WHERE id = ?").bind(now, draftId),
    ]);
    const promotedPlayerIds = player.signup_status === 'approved' && nextStatus !== 'approved'
      ? await promoteWaitlist(db, draftId, draft.registration_capacity)
      : [];
    await recordAudit(db, {
      draftId, actorType: 'organizer', eventType: 'player.status_changed',
      metadata: { playerId, previousStatus: player.signup_status, status: nextStatus, promotedPlayerIds }, createdAt: now,
    });
    return json({ playerId, status: nextStatus, promotedPlayerIds });
  } catch (error) {
    console.error('update player status failed', error);
    return json({ error: 'The registration status could not be updated.' }, { status: 500 });
  }
}
