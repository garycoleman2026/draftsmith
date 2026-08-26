import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { requireClanRole, requireSessionUser } from '../../../../../lib/auth';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { clanId?: unknown };
    const clanId = typeof body.clanId === 'string' ? body.clanId : '';
    if (!clanId) return json({ error: 'Choose a clan workspace.' }, { status: 400 });
    await requireClanRole(request, clanId, ['owner', 'admin']);
    const db = getDatabase();
    const now = new Date().toISOString();
    await db
      .prepare('UPDATE drafts SET clan_id = ?, owner_user_id = ?, updated_at = ? WHERE id = ?')
      .bind(clanId, user.id, now, draftId)
      .run();
    await recordAudit(db, {
      draftId,
      clanId,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'event.claimed',
    });
    return json({ claimed: true, draftId, clanId });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The event could not be claimed.' }, { status });
  }
}
