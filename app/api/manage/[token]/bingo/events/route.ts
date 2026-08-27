import { createHashedCredential, resolveManagerDraftId } from '@/lib/access-tokens';
import { recordAudit, requestId } from '@/lib/audit';
import { bingoActivityInsert, chunkedBatch, parseJson, uniqueBingoSlug } from '@/lib/bingo';
import { getBuiltinBingoTemplate, sanitizeBingoTemplate } from '@/lib/bingo-types';
import { getSessionUser } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import type { DraftResult, BingoBoardScope, BingoMode } from '@/lib/types';
import { normalizeRsn } from '@/lib/validation';

const TEAM_COLORS = ['#3f6a45', '#714a79', '#9b542f', '#2f6875', '#8a7330', '#88424a', '#506b8b', '#6f693c'];
const TEAM_EMBLEMS = ['dragon', 'raven', 'stag', 'wolf', 'phoenix', 'boar', 'owl', 'lion'];

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const events = await getDatabase().prepare(
      `SELECT be.id, be.title, be.public_slug, be.mode, be.board_scope, be.status, be.start_at, be.end_at,
              be.started_at, be.ended_at, be.revision, be.created_at,
              (SELECT COUNT(*) FROM bingo_tasks bt WHERE bt.event_id = be.id) AS task_count,
              (SELECT COUNT(*) FROM bingo_claims bc WHERE bc.event_id = be.id AND bc.status = 'pending') AS pending_count
       FROM bingo_events be WHERE be.draft_id = ? ORDER BY be.created_at DESC`,
    ).bind(draftId).all<Record<string, string | number | null>>();
    return json({ events: events.results.map((event) => ({
      ...event,
      managePath: `/bingo/manage/${token}/${event.id}`,
      publicPath: `/bingo/event/${event.public_slug}`,
    })) });
  } catch (error) {
    console.error('list bingo events failed', error);
    return json({ error: 'The bingo events could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  let createdEventId: string | null = null;
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const db = getDatabase();
    const draft = await db.prepare('SELECT title, result_json, clan_id, owner_user_id FROM drafts WHERE id = ?')
      .bind(draftId).first<{ title: string; result_json: string | null; clan_id: string | null; owner_user_id: string | null }>();
    const result = parseJson<DraftResult | null>(draft?.result_json, null);
    if (!draft || !result?.teams?.length) return json({ error: 'Finish the team draft before opening a bingo event.' }, { status: 409 });
    const count = await db.prepare('SELECT COUNT(*) AS count FROM bingo_events WHERE draft_id = ?').bind(draftId).first<{ count: number }>();
    if ((count?.count ?? 0) >= 20) return json({ error: 'This draft already has the maximum of 20 bingo events.' }, { status: 409 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const customTemplate = typeof body.templateId === 'string'
      ? await loadCustomTemplate(body.templateId, draftId, draft.clan_id)
      : null;
    const builtin = getBuiltinBingoTemplate(body.templateKey);
    const configuration = customTemplate
      ? sanitizeBingoTemplate(parseJson(customTemplate.configuration_json, {}), builtin)
      : builtin;
    const mode = validMode(body.mode ?? configuration.mode);
    const boardScope = mode === 'lockout' ? 'shared' : validScope(body.boardScope ?? configuration.boardScope);
    const gridSize = Math.max(3, Math.min(7, configuration.rules.layout.rows));
    const expectedTasks = gridSize * gridSize;
    const tasks = configuration.tasks;
    if (tasks.length !== expectedTasks) return json({ error: `The selected template must contain exactly ${expectedTasks} tasks.` }, { status: 400 });
    const titleInput = typeof body.title === 'string' ? body.title.trim().slice(0, 90) : '';
    const title = titleInput || `${draft.title} bingo`;
    const startAt = validDate(body.startAt);
    const endAt = validDate(body.endAt);
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) return json({ error: 'The end time must be after the start time.' }, { status: 400 });
    const eventId = crypto.randomUUID();
    createdEventId = eventId;
    const publicSlug = await uniqueBingoSlug(title);
    const sessionUser = await getSessionUser(request);
    const now = new Date().toISOString();
    const teamData = await Promise.all(result.teams.map(async (team, index) => ({
      id: crypto.randomUUID(),
      sourceTeamIndex: team.teamIndex,
      name: `Team ${team.captain.name}`.slice(0, 60),
      color: TEAM_COLORS[index % TEAM_COLORS.length],
      emblem: TEAM_EMBLEMS[index % TEAM_EMBLEMS.length],
      credential: await createHashedCredential(),
      members: [
        { id: team.captain.id, name: team.captain.name, role: 'captain' },
        ...team.players.map((player) => ({ id: player.id, name: player.name, role: 'member' })),
      ],
    })));
    const winCondition = configuration.rules.scoring.winCondition;
    const targetValue = winCondition === 'lines' ? Math.max(1, Number(configuration.targetValue) || 1) : Math.max(0, Number(configuration.targetValue) || 0);
    await db.batch([
      db.prepare(`INSERT INTO bingo_events
        (id, draft_id, title, public_slug, mode, board_scope, grid_size, status, win_condition, target_value,
         requires_review, public_spectator, spectator_delay_seconds, start_at, end_at, baseline_status,
         revision, rules_json, created_by_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, 1, 0, ?, ?, 'idle', 0, ?, ?, ?, ?)`)
        .bind(eventId, draftId, title, publicSlug, mode, boardScope, gridSize, winCondition, targetValue,
          startAt, endAt, JSON.stringify({ ...configuration.rules, templateKey: customTemplate ? null : builtin.key }), sessionUser?.id ?? draft.owner_user_id, now, now),
      ...teamData.map((team) => db.prepare(`INSERT INTO bingo_teams
        (id, event_id, source_team_index, name, color, emblem, access_token_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(team.id, eventId, team.sourceTeamIndex, team.name, team.color, team.emblem, team.credential.hash, now)),
      ...tasks.map((task, sortOrder) => db.prepare(`INSERT INTO bingo_tasks
        (id, event_id, title, description, points, category, difficulty, verification_mode, repeatable,
         max_completions, hidden, free_space, icon_key, rule_json, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), eventId, task.title, task.description, task.points, task.category, task.difficulty,
          task.verificationMode, task.repeatable ? 1 : 0, task.maxCompletions, task.hidden ? 1 : 0,
          task.freeSpace ? 1 : 0, task.iconKey, JSON.stringify(task.rule), sortOrder, now, now)),
      bingoActivityInsert({ eventId, type: 'event.created', message: `${title} entered the bingo hall.`, now }),
    ]);
    await chunkedBatch(teamData.flatMap((team) => team.members.map((member) => db.prepare(`INSERT INTO bingo_team_members
      (id, team_id, player_id, display_name, normalized_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), team.id, member.id, member.name, normalizeRsn(member.name), member.role, now))));
    await recordAudit(db, {
      draftId, clanId: draft.clan_id, actorUserId: sessionUser?.id ?? null, actorType: 'organizer',
      eventType: 'bingo.created', metadata: { eventId, mode, boardScope, taskCount: tasks.length },
      requestId: requestId(request), createdAt: now,
    });
    return json({
      id: eventId,
      managePath: `/bingo/manage/${token}/${eventId}`,
      publicPath: `/bingo/event/${publicSlug}`,
      teamLinks: teamData.map((team) => ({ teamId: team.id, teamName: team.name, path: `/bingo/team/${team.credential.token}` })),
    }, { status: 201 });
  } catch (error) {
    if (createdEventId) await getDatabase().prepare('DELETE FROM bingo_events WHERE id = ?').bind(createdEventId).run().catch(() => undefined);
    console.error('create bingo event failed', error);
    return json({ error: 'The bingo event could not be created.' }, { status: 500 });
  }
}

async function loadCustomTemplate(templateId: string, draftId: string, clanId: string | null) {
  return getDatabase().prepare(
    `SELECT id, configuration_json FROM bingo_templates
     WHERE id = ? AND (owner_draft_id = ? OR (clan_id IS NOT NULL AND clan_id = ?))`,
  ).bind(templateId, draftId, clanId).first<{ id: string; configuration_json: string }>();
}

function validMode(value: unknown): BingoMode {
  return ['classic', 'points', 'lockout', 'blackout', 'progression', 'categories'].includes(String(value)) ? String(value) as BingoMode : 'points';
}
function validScope(value: unknown): BingoBoardScope { return value === 'shared' ? 'shared' : 'per_team'; }
function validDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
