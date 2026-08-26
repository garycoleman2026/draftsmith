import { canManageDraft, requireSessionUser } from '../../../../../lib/auth';
import { createTemporaryManagerToken } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const { id } = await context.params;
    if (!(await canManageDraft(user.id, id))) {
      return json({ error: 'You do not have permission to manage this event.' }, { status: 403 });
    }
    const access = await createTemporaryManagerToken({ draftId: id, userId: user.id });
    await recordAudit(getDatabase(), {
      draftId: id,
      actorUserId: user.id,
      actorType: 'organizer',
      eventType: 'event.manage_link_created',
      metadata: { expiresAt: access.expiresAt },
    });
    return json({ path: `/manage/${access.token}`, expiresAt: access.expiresAt });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The management link could not be created.' }, { status });
  }
}
