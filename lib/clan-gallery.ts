import { getDatabase } from './db';

export type PublicClanSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  eventCount: number;
  completedCount: number;
  templateCount: number;
  latestEventAt: string | null;
};

export type PublicClanEvent = {
  id: string;
  title: string;
  slug: string;
  mode: string;
  gridSize: number;
  status: string;
  teamCount: number;
  taskCount: number;
  completionCount: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type PublicClanTemplate = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: string;
  cloneCount: number;
  upvoteCount: number;
  downvoteCount: number;
};

type ClanRow = {
  id: string; name: string; slug: string; description: string; member_count: number; event_count: number;
  completed_count: number; template_count: number; latest_event_at: string | null;
};

export async function listPublicClans() {
  try {
    const result = await getDatabase().prepare(
      `SELECT c.id, c.name, c.slug, c.description,
              (SELECT COUNT(*) FROM clan_memberships cm WHERE cm.clan_id = c.id) AS member_count,
              (SELECT COUNT(*) FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
               WHERE d.clan_id = c.id AND be.public_listed = 1 AND be.public_spectator = 1) AS event_count,
              (SELECT COUNT(*) FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
               WHERE d.clan_id = c.id AND be.public_listed = 1 AND be.public_spectator = 1 AND be.status = 'complete') AS completed_count,
              (SELECT COUNT(*) FROM bingo_templates bt WHERE bt.clan_id = c.id AND bt.visibility = 'public') AS template_count,
              (SELECT MAX(COALESCE(be.started_at, be.created_at)) FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
               WHERE d.clan_id = c.id AND be.public_listed = 1 AND be.public_spectator = 1) AS latest_event_at
       FROM clans c WHERE c.public_listing = 1
       ORDER BY event_count DESC, template_count DESC, c.name LIMIT 200`,
    ).all<ClanRow>();
    return result.results.map(mapClanRow);
  } catch {
    return [];
  }
}

export async function loadPublicClan(slug: string) {
  const db = getDatabase();
  const clan = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.description,
            (SELECT COUNT(*) FROM clan_memberships cm WHERE cm.clan_id = c.id) AS member_count,
            (SELECT COUNT(*) FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
             WHERE d.clan_id = c.id AND be.public_listed = 1 AND be.public_spectator = 1) AS event_count,
            (SELECT COUNT(*) FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
             WHERE d.clan_id = c.id AND be.public_listed = 1 AND be.public_spectator = 1 AND be.status = 'complete') AS completed_count,
            (SELECT COUNT(*) FROM bingo_templates bt WHERE bt.clan_id = c.id AND bt.visibility = 'public') AS template_count,
            (SELECT MAX(COALESCE(be.started_at, be.created_at)) FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
             WHERE d.clan_id = c.id AND be.public_listed = 1 AND be.public_spectator = 1) AS latest_event_at
     FROM clans c WHERE c.slug = ? AND c.public_listing = 1`,
  ).bind(slug).first<ClanRow>();
  if (!clan) return null;
  const [eventResult, templateResult] = await Promise.all([
    db.prepare(
      `SELECT be.id, be.title, be.public_slug, be.mode, be.grid_size, be.status, be.started_at, be.ended_at, be.created_at,
              (SELECT COUNT(*) FROM bingo_teams team WHERE team.event_id = be.id) AS team_count,
              (SELECT COUNT(*) FROM bingo_tasks task WHERE task.event_id = be.id) AS task_count,
              (SELECT COUNT(*) FROM bingo_completions completion WHERE completion.event_id = be.id) AS completion_count
       FROM bingo_events be JOIN drafts d ON d.id = be.draft_id
       WHERE d.clan_id = ? AND be.public_listed = 1 AND be.public_spectator = 1
       ORDER BY CASE be.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'complete' THEN 2 ELSE 3 END,
                COALESCE(be.started_at, be.created_at) DESC LIMIT 100`,
    ).bind(clan.id).all<Record<string, string | number | null>>(),
    db.prepare(
      `SELECT id, public_slug, name, summary, category, clone_count,
              (SELECT COUNT(*) FROM bingo_template_votes vote WHERE vote.template_id = bingo_templates.id AND vote.vote = 1) AS upvote_count,
              (SELECT COUNT(*) FROM bingo_template_votes vote WHERE vote.template_id = bingo_templates.id AND vote.vote = -1) AS downvote_count
       FROM bingo_templates WHERE clan_id = ? AND visibility = 'public' AND public_slug IS NOT NULL
       ORDER BY clone_count DESC, updated_at DESC LIMIT 50`,
    ).bind(clan.id).all<Record<string, string | number | null>>(),
  ]);
  return {
    clan: mapClanRow(clan),
    events: eventResult.results.map((event): PublicClanEvent => ({
      id: String(event.id), title: String(event.title), slug: String(event.public_slug), mode: String(event.mode),
      gridSize: Number(event.grid_size), status: String(event.status), teamCount: Number(event.team_count),
      taskCount: Number(event.task_count), completionCount: Number(event.completion_count),
      startedAt: event.started_at ? String(event.started_at) : null,
      endedAt: event.ended_at ? String(event.ended_at) : null, createdAt: String(event.created_at),
    })),
    templates: templateResult.results.map((template): PublicClanTemplate => ({
      id: String(template.id), slug: String(template.public_slug), name: String(template.name),
      summary: String(template.summary), category: String(template.category), cloneCount: Number(template.clone_count),
      upvoteCount: Number(template.upvote_count) || 0,
      downvoteCount: Number(template.downvote_count) || 0,
    })),
  };
}

function mapClanRow(row: ClanRow): PublicClanSummary {
  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description,
    memberCount: Number(row.member_count) || 0, eventCount: Number(row.event_count) || 0,
    completedCount: Number(row.completed_count) || 0, templateCount: Number(row.template_count) || 0,
    latestEventAt: row.latest_event_at,
  };
}
