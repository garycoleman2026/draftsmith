import { canManageDraft, requireSessionUser } from '../../../../../lib/auth';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { configurationFromDraft, createEventFromConfiguration } from '../../../../../lib/event-copy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const { id } = await context.params;
    if (!(await canManageDraft(user.id, id))) return json({ error: 'You do not have permission to duplicate this event.' }, { status: 403 });
    const source = await getDatabase().prepare('SELECT title, clan_id FROM drafts WHERE id = ?').bind(id).first<{ title: string; clan_id: string | null }>();
    if (!source?.clan_id) return json({ error: 'Claim this event to a clan before duplicating it.' }, { status: 409 });
    const configuration = await configurationFromDraft(id);
    if (!configuration) return json({ error: 'The source event was not found.' }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { title?: unknown };
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : `${source.title} copy`;
    const created = await createEventFromConfiguration({ configuration, title, clanId: source.clan_id, userId: user.id });
    await recordAudit(getDatabase(), { draftId: created.id, clanId: source.clan_id, actorUserId: user.id, actorType: 'organizer', eventType: 'event.duplicated', metadata: { sourceDraftId: id } });
    return json(created, { status: 201 });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The event could not be duplicated.' }, { status });
  }
}
