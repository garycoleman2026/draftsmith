import { requireSessionUser } from '../../../lib/auth';
import { ensureSchema, getDatabase, json } from '../../../lib/db';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const db = getDatabase();
    const [clans, drafts, templates] = await Promise.all([
      db
        .prepare(
          `SELECT c.id, c.name, c.slug, c.description, c.public_listing, cm.role
           FROM clan_memberships cm JOIN clans c ON c.id = cm.clan_id
           WHERE cm.user_id = ? ORDER BY c.name`,
        )
        .bind(user.id)
        .all(),
      db
        .prepare(
          `SELECT DISTINCT d.id, d.title, d.draft_type, d.team_count, d.roster_mode,
                  d.status, d.registration_open, d.created_at, d.updated_at,
                  d.archived_at, d.clan_id, c.name AS clan_name,
                  (SELECT COUNT(*) FROM players p WHERE p.draft_id = d.id AND p.withdrawn_at IS NULL) AS player_count
           FROM drafts d
           LEFT JOIN clans c ON c.id = d.clan_id
           LEFT JOIN clan_memberships cm ON cm.clan_id = d.clan_id AND cm.user_id = ?
           WHERE d.owner_user_id = ? OR cm.role IN ('owner', 'admin')
           ORDER BY d.updated_at DESC`,
        )
        .bind(user.id, user.id)
        .all(),
      db
        .prepare(
          `SELECT et.id, et.clan_id, et.name, et.configuration_json, et.created_at, et.updated_at
           FROM event_templates et
           JOIN clan_memberships cm ON cm.clan_id = et.clan_id
           WHERE cm.user_id = ? AND cm.role IN ('owner', 'admin')
           ORDER BY et.updated_at DESC`,
        )
        .bind(user.id)
        .all(),
    ]);
    return json({ user, clans: clans.results, events: drafts.results, templates: templates.results });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The dashboard could not be loaded.' }, { status });
  }
}
