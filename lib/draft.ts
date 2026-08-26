import type { DraftResult, DraftType, ResultTeam } from './types';

export type PlayerRow = { id: string; name: string; sort_order: number };
export type CaptainRow = {
  id: string;
  player_id: string;
  team_index: number;
  name: string;
};
export type RankingRow = {
  captain_id: string;
  player_id: string;
  rank: number;
  score?: number | null;
  avoid: number;
};
export type ConstraintRow = {
  constraint_type: 'together' | 'apart';
  player_a_id: string;
  player_b_id: string;
};

type TeamState = ResultTeam & {
  strength: number;
  targetSize: number;
  memberIds: Set<string>;
};

type PlayerGroup = {
  id: string;
  members: PlayerRow[];
  draftable: PlayerRow[];
  captainIds: string[];
  strength: number;
};

export function assignTeams(input: {
  draftId: string;
  draftType: DraftType;
  players: PlayerRow[];
  captains: CaptainRow[];
  rankings: RankingRow[];
  constraints?: ConstraintRow[];
}): DraftResult {
  const { draftId, draftType, players, captains, rankings } = input;
  const constraints = input.constraints ?? [];
  const captainPlayerIds = new Set(captains.map((captain) => captain.player_id));
  const draftable = players.filter((player) => !captainPlayerIds.has(player.id));
  const rankingMaps = buildRankingMaps(captains, rankings, draftable.length);
  const averageScores = new Map<string, number>();

  for (const player of draftable) {
    const scores = captains
      .map((captain) => rankingMaps.get(captain.id)?.get(player.id)?.score)
      .filter((score): score is number => typeof score === 'number');
    averageScores.set(
      player.id,
      scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 5,
    );
  }

  const targetSizes = getTargetTeamSizes(players.length, captains.length);
  const teams: TeamState[] = captains
    .slice()
    .sort((a, b) => a.team_index - b.team_index)
    .map((captain, index) => ({
      teamIndex: captain.team_index,
      captain: { id: captain.player_id, name: captain.name },
      players: [],
      averageScore: null,
      strength: 0,
      targetSize: targetSizes[index] ?? 1,
      memberIds: new Set([captain.player_id]),
    }));

  const groups = buildGroups(players, captains, constraints, averageScores);
  const remaining: PlayerGroup[] = [];

  for (const group of groups) {
    if (!group.draftable.length) continue;
    if (group.captainIds.length) {
      const captain = captains.find((item) => group.captainIds.includes(item.player_id));
      const forcedTeam = captain
        ? teams.find((team) => team.teamIndex === captain.team_index)
        : undefined;
      if (forcedTeam) addGroup(forcedTeam, group, averageScores);
    } else {
      remaining.push(group);
    }
  }

  if (draftType === 'snake') {
    runSimulatedSnake(remaining, teams, captains, rankingMaps, constraints, averageScores);
  } else {
    const ordered =
      draftType === 'random'
        ? seededShuffle(remaining, hashSeed(draftId))
        : [...remaining].sort(
            (a, b) => b.strength - a.strength || a.members[0].sort_order - b.members[0].sort_order,
          );
    for (const group of ordered) {
      const strict = teams.filter((team) => canPlace(team, group, captains, rankingMaps, constraints, true));
      const ruleSafe = teams.filter((team) => canPlace(team, group, captains, rankingMaps, constraints, false));
      const withCapacity = teams.filter((team) => hasCapacity(team, group));
      const options = strict.length
        ? strict
        : ruleSafe.length
          ? ruleSafe
          : withCapacity.length
            ? withCapacity
            : teams;
      const selected = [...options].sort((a, b) => {
        if (draftType === 'random') {
          return a.memberIds.size - b.memberIds.size || a.teamIndex - b.teamIndex;
        }
        const aSlots = Math.max(1, a.targetSize - 1);
        const bSlots = Math.max(1, b.targetSize - 1);
        const aPreference = captainPreference(a, group, captains, rankingMaps);
        const bPreference = captainPreference(b, group, captains, rankingMaps);
        const aScore = (a.strength + group.strength) / aSlots - aPreference * 0.04;
        const bScore = (b.strength + group.strength) / bSlots - bPreference * 0.04;
        return aScore - bScore || a.memberIds.size - b.memberIds.size || a.teamIndex - b.teamIndex;
      })[0];
      if (selected) addGroup(selected, group, averageScores);
    }
  }

  const teamByPlayer = new Map<string, number>();
  for (const team of teams) {
    for (const memberId of team.memberIds) teamByPlayer.set(memberId, team.teamIndex);
    team.players.sort(
      (a, b) =>
        (b.averageScore ?? Number.MIN_SAFE_INTEGER) -
          (a.averageScore ?? Number.MIN_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    );
    team.averageScore = team.players.length
      ? team.players.reduce((sum, player) => sum + (player.averageScore ?? 5), 0) /
        team.players.length
      : null;
  }

  const constraintOverrides = constraints.filter((constraint) => {
    const aTeam = teamByPlayer.get(constraint.player_a_id);
    const bTeam = teamByPlayer.get(constraint.player_b_id);
    if (aTeam === undefined || bTeam === undefined) return false;
    return constraint.constraint_type === 'together' ? aTeam !== bTeam : aTeam === bTeam;
  }).length;

  let avoidOverrides = 0;
  for (const team of teams) {
    const captain = captains.find((item) => item.team_index === team.teamIndex);
    if (!captain) continue;
    for (const player of team.players) {
      if (rankingMaps.get(captain.id)?.get(player.id)?.avoid) avoidOverrides += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    draftType,
    teams: teams.map(({ strength, targetSize, memberIds, ...team }) => {
      void strength;
      void targetSize;
      void memberIds;
      return team;
    }),
    avoidOverrides,
    constraintOverrides,
  };
}

function buildRankingMaps(captains: CaptainRow[], rankings: RankingRow[], playerCount: number) {
  const maps = new Map<string, Map<string, { rank: number; score: number; avoid: boolean }>>();
  for (const captain of captains) maps.set(captain.id, new Map());
  for (const ranking of rankings) {
    const score =
      typeof ranking.score === 'number' && ranking.score >= 1 && ranking.score <= 10
        ? ranking.score
        : scoreFromRank(ranking.rank, playerCount);
    maps.get(ranking.captain_id)?.set(ranking.player_id, {
      rank: ranking.rank,
      score,
      avoid: Boolean(ranking.avoid),
    });
  }
  return maps;
}

function buildGroups(
  players: PlayerRow[],
  captains: CaptainRow[],
  constraints: ConstraintRow[],
  averageScores: Map<string, number>,
) {
  const parent = new Map(players.map((player) => [player.id, player.id] as const));
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    if (next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const aRoot = find(a);
    const bRoot = find(b);
    if (aRoot !== bRoot) parent.set(bRoot, aRoot);
  };
  for (const constraint of constraints) {
    if (constraint.constraint_type === 'together') {
      union(constraint.player_a_id, constraint.player_b_id);
    }
  }

  const membersByRoot = new Map<string, PlayerRow[]>();
  for (const player of players) {
    const root = find(player.id);
    const members = membersByRoot.get(root) ?? [];
    members.push(player);
    membersByRoot.set(root, members);
  }
  const captainIds = new Set(captains.map((captain) => captain.player_id));
  return [...membersByRoot.entries()].map(([id, members]) => {
    const draftable = members.filter((member) => !captainIds.has(member.id));
    return {
      id,
      members,
      draftable,
      captainIds: members.filter((member) => captainIds.has(member.id)).map((member) => member.id),
      strength: draftable.reduce((sum, member) => sum + (averageScores.get(member.id) ?? 5), 0),
    } satisfies PlayerGroup;
  });
}

function runSimulatedSnake(
  remainingGroups: PlayerGroup[],
  teams: TeamState[],
  captains: CaptainRow[],
  rankingMaps: Map<string, Map<string, { rank: number; score: number; avoid: boolean }>>,
  constraints: ConstraintRow[],
  averageScores: Map<string, number>,
) {
  const remaining = [...remainingGroups];
  let turn = 0;
  let guard = 0;
  while (remaining.length && guard < remainingGroups.length * teams.length * 4 + 20) {
    guard += 1;
    const team = teams[snakeTeamPosition(turn, teams.length)];
    turn += 1;
    if (!team || team.memberIds.size >= team.targetSize) continue;
    const strict = remaining.filter((group) =>
      canPlace(team, group, captains, rankingMaps, constraints, true),
    );
    const ruleSafe = remaining.filter((group) =>
      canPlace(team, group, captains, rankingMaps, constraints, false),
    );
    const withCapacity = remaining.filter((group) => hasCapacity(team, group));
    const options = strict.length
      ? strict
      : ruleSafe.length
        ? ruleSafe
        : withCapacity.length
          ? withCapacity
          : remaining;
    const selected = [...options].sort((a, b) => {
      const aPreference = captainPreference(team, a, captains, rankingMaps);
      const bPreference = captainPreference(team, b, captains, rankingMaps);
      return bPreference - aPreference || b.strength - a.strength;
    })[0];
    if (!selected) continue;
    addGroup(team, selected, averageScores);
    remaining.splice(remaining.indexOf(selected), 1);
  }

  for (const group of remaining) {
    const team = [...teams].sort(
      (a, b) => a.memberIds.size - b.memberIds.size || a.strength - b.strength,
    )[0];
    if (team) addGroup(team, group, averageScores);
  }
}

function canPlace(
  team: TeamState,
  group: PlayerGroup,
  captains: CaptainRow[],
  rankingMaps: Map<string, Map<string, { rank: number; score: number; avoid: boolean }>>,
  constraints: ConstraintRow[],
  respectPreferences: boolean,
) {
  if (!hasCapacity(team, group)) return false;
  const combined = new Set([...team.memberIds, ...group.members.map((member) => member.id)]);
  if (
    constraints.some(
      (constraint) =>
        constraint.constraint_type === 'apart' &&
        combined.has(constraint.player_a_id) &&
        combined.has(constraint.player_b_id),
    )
  ) {
    return false;
  }
  if (!respectPreferences) return true;
  const captain = captains.find((item) => item.team_index === team.teamIndex);
  return captain
    ? group.draftable.every(
        (player) => !rankingMaps.get(captain.id)?.get(player.id)?.avoid,
      )
    : true;
}

function hasCapacity(team: TeamState, group: PlayerGroup) {
  const newMembers = group.draftable.filter((player) => !team.memberIds.has(player.id)).length;
  return team.memberIds.size + newMembers <= team.targetSize;
}

function captainPreference(
  team: TeamState,
  group: PlayerGroup,
  captains: CaptainRow[],
  rankingMaps: Map<string, Map<string, { rank: number; score: number; avoid: boolean }>>,
) {
  const captain = captains.find((item) => item.team_index === team.teamIndex);
  if (!captain || !group.draftable.length) return 5;
  return (
    group.draftable.reduce(
      (sum, player) => sum + (rankingMaps.get(captain.id)?.get(player.id)?.score ?? 5),
      0,
    ) / group.draftable.length
  );
}

function addGroup(team: TeamState, group: PlayerGroup, averageScores: Map<string, number>) {
  for (const player of group.draftable) {
    if (team.memberIds.has(player.id)) continue;
    const averageScore = averageScores.get(player.id) ?? null;
    team.players.push({ id: player.id, name: player.name, averageScore });
    team.memberIds.add(player.id);
    team.strength += averageScore ?? 5;
  }
}

export function getTargetTeamSizes(playerCount: number, teamCount: number) {
  if (teamCount <= 0) return [];
  const baseSize = Math.floor(playerCount / teamCount);
  const largerTeams = playerCount % teamCount;
  return Array.from({ length: teamCount }, (_, index) => baseSize + (index < largerTeams ? 1 : 0));
}

export function snakeTeamPosition(turnNumber: number, teamCount: number) {
  if (teamCount <= 1) return 0;
  const round = Math.floor(turnNumber / teamCount);
  const position = turnNumber % teamCount;
  return round % 2 === 0 ? position : teamCount - 1 - position;
}

function scoreFromRank(rank: number, playerCount: number) {
  if (playerCount <= 1) return 10;
  return Math.max(1, Math.min(10, Math.round(10 - ((rank - 1) * 9) / (playerCount - 1))));
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(values: T[], seed: number) {
  const copy = [...values];
  let state = seed || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
