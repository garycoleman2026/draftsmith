import { requireClanRole } from '../../../../../lib/auth';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { createEventFromConfiguration, type EventConfiguration } from '../../../../../lib/event-copy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const db = getDatabase();
  const template = await db.prepare('SELECT clan_id, name, configuration_json FROM event_templates WHERE id = ?').bind(id)
    .first<{ clan_id: string; name: string; configuration_json: string }>();
  if (!template) return json({ error: 'That template was not found.' }, { status: 404 });
  try {
    const { user } = await requireClanRole(request, template.clan_id, ['owner', 'admin']);
    const body = await request.json().catch(() => ({})) as { title?: unknown };
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : `${template.name} event`;
    const created = await createEventFromConfiguration({
      configuration: JSON.parse(template.configuration_json) as EventConfiguration,
      title, clanId: template.clan_id, userId: user.id,
    });
    await recordAudit(db, { draftId: created.id, clanId: template.clan_id, actorUserId: user.id, actorType: 'organizer', eventType: 'event.created_from_template', metadata: { templateId: id } });
    return json(created, { status: 201 });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The event could not be created.' }, { status });
  }
}
