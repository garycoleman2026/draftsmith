import { createHashedCredential } from './access-tokens';
import { bingoActivityInsert, BingoError, chunkedBatch, uniqueBingoSlug } from './bingo';
import type { BingoTemplateDefinition } from './bingo-types';
import { getDatabase } from './db';
import type { DraftResult, BingoBoardScope, BingoMode } from './types';
import { normalizeRsn } from './validation';

const TEAM_COLORS = ['#3f6a45', '#714a79', '#9b542f', '#2f6875', '#8a7330', '#88424a', '#506b8b', '#6f693c'];
const TEAM_EMBLEMS = ['dragon', 'raven', 'stag', 'wolf', 'phoenix', 'boar', 'owl', 'lion'];

export type BingoEventSnapshotInput = {
  draftId: string;
  title: string;
  result: DraftResult;
  configuration: BingoTemplateDefinition;
  mode: BingoMode;
  boardScope: BingoBoardScope;
  startAt?: string | null;
  endAt?: string | null;
  createdByUserId?: string | null;
  templateKey?: string | null;
  teamNames?: Record<number, string>;
};

export type BingoEventSnapshotResult = {
  id: string;
  publicSlug: string;
  publicPath: string;
  teamLinks: { teamId: string; teamName: string; path: string }[];
};

export async function createBingoEventSnapshot(input: BingoEventSnapshotInput): Promise<BingoEventSnapshotResult> {
  if (input.result.teams.length < 2) throw new BingoError('Add at least two teams before opening a bingo event.', 400);
  const gridSize = Math.max(3, Math.min(7, input.configuration.rules.layout.rows));
  const expectedTasks = gridSize * gridSize;
  if (input.configuration.tasks.length !== expectedTasks) {
    throw new BingoError(`The selected template must contain exactly ${expectedTasks} tasks.`, 400);
  }
  if (input.startAt && input.endAt && Date.parse(input.endAt) <= Date.parse(input.startAt)) {
    throw new BingoError('The end time must be after the start time.', 400);
  }

  const db = getDatabase();
  const eventId = crypto.randomUUID();
  const publicSlug = await uniqueBingoSlug(input.title);
  const now = new Date().toISOString();
  const teamData = await Promise.all(input.result.teams.map(async (team, index) => ({
    id: crypto.randomUUID(),
    sourceTeamIndex: team.teamIndex,
    name: (input.teamNames?.[team.teamIndex] || `Team ${team.captain.name}`).trim().slice(0, 60),
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    emblem: TEAM_EMBLEMS[index % TEAM_EMBLEMS.length],
    credential: await createHashedCredential(),
    members: [
      { id: team.captain.id, name: team.captain.name, role: 'captain' },
      ...team.players.map((player) => ({ id: player.id, name: player.name, role: 'member' })),
    ],
  })));
  const winCondition = input.configuration.rules.scoring.winCondition;
  const targetValue = winCondition === 'lines'
    ? Math.max(1, Number(input.configuration.targetValue) || 1)
    : Math.max(0, Number(input.configuration.targetValue) || 0);

  try {
    await db.batch([
      db.prepare(`INSERT INTO bingo_events
        (id, draft_id, title, public_slug, mode, board_scope, grid_size, status, win_condition, target_value,
         requires_review, public_spectator, spectator_delay_seconds, start_at, end_at, baseline_status,
         revision, rules_json, created_by_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, 1, 0, ?, ?, 'idle', 0, ?, ?, ?, ?)`)
        .bind(eventId, input.draftId, input.title, publicSlug, input.mode, input.boardScope, gridSize, winCondition,
          targetValue, input.startAt ?? null, input.endAt ?? null,
          JSON.stringify({ ...input.configuration.rules, templateKey: input.templateKey ?? null }),
          input.createdByUserId ?? null, now, now),
      ...teamData.map((team) => db.prepare(`INSERT INTO bingo_teams
        (id, event_id, source_team_index, name, color, emblem, access_token_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(team.id, eventId, team.sourceTeamIndex, team.name, team.color, team.emblem, team.credential.hash, now)),
      ...input.configuration.tasks.map((task, sortOrder) => db.prepare(`INSERT INTO bingo_tasks
        (id, event_id, title, description, points, category, difficulty, verification_mode, repeatable,
         max_completions, hidden, free_space, icon_key, rule_json, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), eventId, task.title, task.description, task.points, task.category, task.difficulty,
          task.verificationMode, task.repeatable ? 1 : 0, task.maxCompletions, task.hidden ? 1 : 0,
          task.freeSpace ? 1 : 0, task.iconKey, JSON.stringify(task.rule), sortOrder, now, now)),
      bingoActivityInsert({ eventId, type: 'event.created', message: `${input.title} entered the bingo hall.`, now }),
    ]);
    await chunkedBatch(teamData.flatMap((team) => team.members.map((member) => db.prepare(`INSERT INTO bingo_team_members
      (id, team_id, player_id, display_name, normalized_name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), team.id, member.id, member.name, normalizeRsn(member.name), member.role, now))));
  } catch (error) {
    await db.prepare('DELETE FROM bingo_events WHERE id = ?').bind(eventId).run().catch(() => undefined);
    throw error;
  }

  return {
    id: eventId,
    publicSlug,
    publicPath: `/bingo/event/${publicSlug}`,
    teamLinks: teamData.map((team) => ({ teamId: team.id, teamName: team.name, path: `/bingo/team/${team.credential.token}` })),
  };
}

export function validBingoMode(value: unknown): BingoMode {
  return ['classic', 'points', 'lockout', 'blackout', 'progression', 'categories'].includes(String(value))
    ? String(value) as BingoMode
    : 'points';
}

export function validBingoScope(value: unknown): BingoBoardScope {
  return value === 'shared' ? 'shared' : 'per_team';
}

export function validBingoDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
