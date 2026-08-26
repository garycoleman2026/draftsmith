import { requireClanRole, requireSessionUser } from '../../../lib/auth';
import { recordAudit } from '../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../lib/db';
import { configurationFromDraft, type EventConfiguration } from '../../../lib/event-copy';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const templates = await getDatabase().prepare(`SELECT et.id, et.clan_id, et.name, et.configuration_json, et.created_at, et.updated_at
      FROM event_templates et JOIN clan_memberships cm ON cm.clan_id = et.clan_id
      WHERE cm.user_id = ? AND cm.role IN ('owner', 'admin') ORDER BY et.updated_at DESC`).bind(user.id).all();
    return json({ templates: templates.results });
  } catch (error) { return authError(error, 'Templates could not be loaded.'); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = (await request.json()) as { clanId?: unknown; name?: unknown; draftId?: unknown; configuration?: unknown };
    const clanId = typeof body.clanId === 'string' ? body.clanId : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!clanId || !name) return json({ error: 'Choose a clan and template name.' }, { status: 400 });
    const { user } = await requireClanRole(request, clanId, ['owner', 'admin']);
    let configuration: EventConfiguration | null = null;
    if (typeof body.draftId === 'string') {
      const source = await getDatabase().prepare('SELECT id FROM drafts WHERE id = ? AND clan_id = ?').bind(body.draftId, clanId).first();
      if (!source) return json({ error: 'Choose an event from this clan workspace.' }, { status: 403 });
      configuration = await configurationFromDraft(body.draftId);
    }
    else if (body.configuration && typeof body.configuration === 'object') configuration = body.configuration as EventConfiguration;
    if (!configuration) return json({ error: 'Choose an event to save as a template.' }, { status: 400 });
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await getDatabase().prepare(`INSERT INTO event_templates
      (id, clan_id, name, configuration_json, created_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, clanId, name, JSON.stringify(configuration), user.id, now, now).run();
    await recordAudit(getDatabase(), { clanId, actorUserId: user.id, actorType: 'organizer', eventType: 'template.created', metadata: { id, name }, createdAt: now });
    return json({ id, name, configuration }, { status: 201 });
  } catch (error) { return authError(error, 'The template could not be saved.'); }
}

function authError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
