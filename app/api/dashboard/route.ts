import { requireSessionUser } from '../../../lib/auth';
import { ensureSchema, getDatabase, json } from '../../../lib/db';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const db = getDatabase();
    const [clans, drafts, bingos, draftTemplates, boards] = await Promise.all([
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
                  NULL AS bingo_id, NULL AS bingo_title, NULL AS bingo_status,
                  NULL AS bingo_public_slug, NULL AS bingo_public_spectator,
                  NULL AS bingo_public_listed, NULL AS bingo_access_role,
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
          `SELECT d.id, d.title, d.draft_type, d.team_count, d.roster_mode,
                  d.status, d.registration_open, be.created_at, be.updated_at,
                  d.archived_at, d.clan_id, d.public_slug, c.name AS clan_name,
                  be.id AS bingo_id, be.title AS bingo_title, be.status AS bingo_status,
                  be.public_slug AS bingo_public_slug, be.public_spectator AS bingo_public_spectator,
                  be.public_listed AS bingo_public_listed,
                  CASE WHEN be.created_by_user_id = ? OR d.owner_user_id = ? OR cm.role IN ('owner', 'admin')
                    THEN 'owner' ELSE bec.role END AS bingo_access_role,
                  (SELECT COUNT(*) FROM bingo_team_members btm JOIN bingo_teams bt ON bt.id = btm.team_id WHERE bt.event_id = be.id) AS player_count
           FROM bingo_events be
           JOIN drafts d ON d.id = be.draft_id
           LEFT JOIN clans c ON c.id = d.clan_id
           LEFT JOIN clan_memberships cm ON cm.clan_id = d.clan_id AND cm.user_id = ?
           LEFT JOIN bingo_event_collaborators bec ON bec.event_id = be.id AND bec.user_id = ?
           WHERE be.created_by_user_id = ? OR d.owner_user_id = ? OR cm.role IN ('owner', 'admin') OR bec.user_id IS NOT NULL
           ORDER BY be.updated_at DESC`,
        )
        .bind(user.id, user.id, user.id, user.id, user.id, user.id)
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
           WHERE (bt.clan_id IS NULL AND bt.owner_user_id = ?) OR (bt.clan_id IS NOT NULL AND cm.user_id = ?)
           ORDER BY bt.updated_at DESC`,
        )
        .bind(user.id, user.id, user.id)
        .all(),
    ]);
    return json({
      user,
      clans: clans.results,
      events: drafts.results,
      bingoEvents: bingos.results,
      draftTemplates: draftTemplates.results,
      boards: boards.results,
    });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The dashboard could not be loaded.' }, { status });
  }
}
