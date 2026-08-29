import { requireSessionUser } from '../../../lib/auth';
import { ensureSchema, getDatabase, json } from '../../../lib/db';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const db = getDatabase();
    const [clans, drafts, draftTemplates, boards] = await Promise.all([
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
                  d.archived_at, d.clan_id, d.public_slug, c.name AS clan_name,
                  be.id AS bingo_id, be.title AS bingo_title, be.status AS bingo_status,
                  be.public_slug AS bingo_public_slug,
                  be.public_spectator AS bingo_public_spectator,
                  be.public_listed AS bingo_public_listed,
                  (SELECT COUNT(*) FROM players p WHERE p.draft_id = d.id AND p.withdrawn_at IS NULL) AS player_count
           FROM drafts d
           LEFT JOIN clans c ON c.id = d.clan_id
           LEFT JOIN bingo_events be ON be.id = (
             SELECT be2.id FROM bingo_events be2
             WHERE be2.draft_id = d.id
             ORDER BY be2.updated_at DESC LIMIT 1
           )
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
      db
        .prepare(
          `SELECT DISTINCT bt.id, bt.name, bt.mode, bt.board_scope, bt.visibility,
                  bt.public_slug, bt.summary, bt.category, bt.owner_user_id,
                  bt.clan_id, c.name AS clan_name, bt.updated_at
           FROM bingo_templates bt
           LEFT JOIN clans c ON c.id = bt.clan_id
           LEFT JOIN clan_memberships cm ON cm.clan_id = bt.clan_id AND cm.user_id = ?
           WHERE bt.owner_user_id = ? OR (bt.clan_id IS NOT NULL AND cm.user_id = ?)
           ORDER BY bt.updated_at DESC`,
        )
        .bind(user.id, user.id, user.id)
        .all(),
    ]);
    return json({
      user,
      clans: clans.results,
      events: drafts.results,
      draftTemplates: draftTemplates.results,
      boards: boards.results,
    });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The dashboard could not be loaded.' }, { status });
  }
}
