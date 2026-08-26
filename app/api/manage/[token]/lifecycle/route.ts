import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { status?: unknown };
    const status = ['registration', 'rankings', 'complete', 'archived'].includes(String(body.status))
      ? String(body.status) as 'registration' | 'rankings' | 'complete' | 'archived'
      : null;
    if (!status) return json({ error: 'Choose a valid event stage.' }, { status: 400 });
    const db = getDatabase();
    const draft = await db.prepare('SELECT result_json, live_started_at, status FROM drafts WHERE id = ?')
      .bind(draftId).first<{ result_json: string | null; live_started_at: string | null; status: string }>();
    if (!draft) return json({ error: 'This event no longer exists.' }, { status: 404 });
    if (status === 'complete' && !draft.result_json) return json({ error: 'Run or finish the draft before marking it complete.' }, { status: 409 });
    if (status === 'registration' && draft.live_started_at) return json({ error: 'Undo the live draft before reopening registration.' }, { status: 409 });
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE drafts SET status = ?, registration_open = ?, archived_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(status, status === 'registration' ? 1 : 0, status === 'archived' ? now : null, now, draftId).run();
    if (status === 'registration' || (status === 'rankings' && draft.status === 'registration')) {
      await db.prepare('UPDATE captains SET rankings_frozen_at = NULL WHERE draft_id = ?').bind(draftId).run();
    } else if (status === 'complete' || status === 'archived') {
      await db.prepare('UPDATE captains SET rankings_frozen_at = COALESCE(rankings_frozen_at, ?) WHERE draft_id = ?')
        .bind(now, draftId).run();
    }
    await recordAudit(db, { draftId, actorType: 'organizer', eventType: `draft.${status}`, createdAt: now });
    return json({ status, archivedAt: status === 'archived' ? now : null });
  } catch (error) {
    console.error('update lifecycle failed', error);
    return json({ error: 'The event stage could not be updated.' }, { status: 500 });
  }
}
