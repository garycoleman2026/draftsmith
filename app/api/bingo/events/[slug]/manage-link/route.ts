import { createTemporaryBingoEventToken } from '@/lib/access-tokens';
import { recordAudit } from '@/lib/audit';
import { canManageBingoEvent, requireSessionUser } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const eventId = (await context.params).slug;
    const role = await canManageBingoEvent(user.id, eventId);
    if (!role) return json({ error: 'You do not have permission to manage this bingo.' }, { status: 403 });
    const access = await createTemporaryBingoEventToken({ eventId, userId: user.id, role });
    const event = await getDatabase().prepare('SELECT draft_id FROM bingo_events WHERE id = ?').bind(eventId).first<{ draft_id: string }>();
    await recordAudit(getDatabase(), {
      draftId: event?.draft_id ?? null, actorUserId: user.id, actorType: 'organizer',
      eventType: 'bingo.manage_link_created', metadata: { eventId, role, expiresAt: access.expiresAt },
    }).catch(() => undefined);
    return json({ path: `/bingo/manage/${access.token}/${eventId}`, role, expiresAt: access.expiresAt });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The organizer room could not be opened.' }, { status });
  }
}
