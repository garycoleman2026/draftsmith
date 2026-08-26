import type {
  BalancePreset,
  DraftResult,
  DraftType,
  FairnessReport,
  ResultTeam,
} from './types';

export type PlayerRow = {
  id: string;
  name: string;
  sort_order: number;
  metrics?: Record<string, number | null | undefined>;
};
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
  enforcement?: 'hard' | 'soft';
  penalty?: number;
  player_a_id: string;
  player_b_id: string;
};
export type BalanceWeights = Record<string, number>;

type RankingValue = { rank: number; score: number; normalizedScore: number; avoid: boolean };
type RankingMaps = Map<string, Map<string, RankingValue>>;
type TeamState = {
  teamIndex: number;
  captain: CaptainRow;
  targetSize: number;
  memberIds: Set<string>;
};
type PlayerGroup = {
  id: string;
  members: PlayerRow[];
  draftable: PlayerRow[];
  captainIds: string[];
  lockedTeamIndex: number | null;
  strength: number;
  restrictionCount: number;
};

export class DraftAssignmentError extends Error {
  readonly code: 'invalid_constraints' | 'unsatisfiable_constraints';

  constructor(message: string, code: DraftAssignmentError['code'] = 'unsatisfiable_constraints') {
    super(message);
    this.code = code;
  }
}

export function assignTeams(input: {
  draftId: string;
  draftType: DraftType;
  players: PlayerRow[];
  captains: CaptainRow[];
  rankings: RankingRow[];
  constraints?: ConstraintRow[];
  balancePreset?: BalancePreset;
  balanceWeights?: BalanceWeights;
  seed?: string;
}): DraftResult {
  const players = [...input.players].sort((a, b) => a.sort_order - b.sort_order);
  const captains = [...input.captains].sort((a, b) => a.team_index - b.team_index);
  if (!captains.length || captains.length > players.length) {
    throw new DraftAssignmentError('Choose a valid captain for every team.', 'invalid_constraints');
  }
  const playerIds = new Set(players.map((player) => player.id));
  if (playerIds.size !== players.length || captains.some((captain) => !playerIds.has(captain.player_id))) {
    throw new DraftAssignmentError('Every player and captain must be unique and belong to this roster.', 'invalid_constraints');
  }

  const constraints = input.constraints ?? [];
  const hardConstraints = constraints.filter((constraint) => (constraint.enforcement ?? 'hard') === 'hard');
  const softConstraints = constraints.filter((constraint) => (constraint.enforcement ?? 'hard') === 'soft');
  const captainPlayerIds = new Set(captains.map((captain) => captain.player_id));
  const draftable = players.filter((player) => !captainPlayerIds.has(player.id));
  const rankingMaps = buildRankingMaps(captains, input.rankings, draftable);
  const averageScores = averageNormalizedScores(draftable, captains, rankingMaps);
  const metricScores = normalizeMetrics(players);
  const balanceWeights = resolveBalanceWeights(input.balancePreset ?? 'consensus', input.balanceWeights);
  const compositeScores = buildCompositeScores(players, averageScores, metricScores, balanceWeights);
  const targetSizes = getTargetTeamSizes(players.length, captains.length);
  const groups = buildGroups(players, captains, hardConstraints, compositeScores);
  validateHardGroups(groups, captains, hardConstraints, targetSizes);

  const seed = input.seed?.trim() || input.draftId;
  const baseSeed = hashSeed(seed);
  const attempts = input.draftType === 'random' ? 24 : input.draftType === 'snake' ? 36 : 96;
  let best: { teams: TeamState[]; placements: Map<string, number>; objective: number } | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const random = seededRandom((baseSeed + Math.imul(attempt + 1, 2654435761)) >>> 0);
    const candidate = buildCandidate({
      draftType: input.draftType,
      players,
      captains,
      targetSizes,
      groups,
      hardConstraints,
      softConstraints,
      rankingMaps,
      compositeScores,
      metricScores,
      balanceWeights,
      random,
    });
    if (!candidate) continue;
    const report = calculateFairness({
      teams: candidate.teams,
      players,
      captains,
      rankingMaps,
      constraints,
      compositeScores,
      metricScores,
      balanceWeights,
    });
    if (!best || report.objectiveScore < best.objective) {
      best = { ...candidate, objective: report.objectiveScore };
    }
  }

  if (!best) {
    throw new DraftAssignmentError(
      'No legal team assignment satisfies every hard together/apart rule and team size. Change a hard rule, captain, or team count.',
    );
  }

  if (input.draftType === 'balanced') {
    best = improveWithLegalSwaps({
      initial: best,
      groups,
      players,
      captains,
      targetSizes,
      hardConstraints,
      softConstraints,
      rankingMaps,
      compositeScores,
      metricScores,
      balanceWeights,
    });
  }

  const fairness = calculateFairness({
    teams: best.teams,
    players,
    captains,
    rankingMaps,
    constraints,
    compositeScores,
    metricScores,
    balanceWeights,
  });
  if (!fairness.hardConstraintsSatisfied) {
    throw new DraftAssignmentError('The generated assignment failed a hard roster rule.');
  }
  const playerById = new Map(players.map((player) => [player.id, player] as const));
  const teams: ResultTeam[] = best.teams.map((team) => {
    const memberPlayers = [...team.memberIds]
      .filter((id) => id !== team.captain.player_id)
      .flatMap((id) => {
        const player = playerById.get(id);
        return player ? [player] : [];
      })
      .sort(
        (a, b) =>
          (compositeScores.get(b.id) ?? 5) - (compositeScores.get(a.id) ?? 5) ||
          a.name.localeCompare(b.name),
      );
    const resultPlayers = memberPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      averageScore: round(averageScores.get(player.id) ?? 5, 2),
      compositeScore: round(compositeScores.get(player.id) ?? 5, 2),
    }));
    return {
      teamIndex: team.teamIndex,
      captain: { id: team.captain.player_id, name: team.captain.name },
      players: resultPlayers,
      averageScore: resultPlayers.length
        ? round(resultPlayers.reduce((sum, player) => sum + (player.averageScore ?? 5), 0) / resultPlayers.length, 2)
        : null,
      compositeStrength: fairness.teamStrengths.find((item) => item.teamIndex === team.teamIndex)?.strength ?? null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    draftType: input.draftType,
    teams,
    avoidOverrides: fairness.avoidViolations,
    constraintOverrides: fairness.softViolations,
    seed,
    fairness,
  };
}

export function normalizeCaptainScores(
  rankings: Array<{ playerId: string; rank: number; score: number }>,
) {
  if (!rankings.length) return new Map<string, number>();
  const scores = rankings.map((ranking) => ranking.score);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  const sortedByRank = [...rankings].sort((a, b) => a.rank - b.rank);
  const byRank = new Map(
    sortedByRank.map((ranking, index) => [
      ranking.playerId,
      rankings.length <= 1 ? 5.5 : 10 - (index * 9) / (rankings.length - 1),
    ] as const),
  );
  return new Map(
    rankings.map((ranking) => {
      const normalized = standardDeviation < 0.15
        ? byRank.get(ranking.playerId) ?? 5.5
        : 5.5 + ((ranking.score - mean) / standardDeviation) * 2;
      return [ranking.playerId, clamp(normalized, 1, 10)] as const;
    }),
  );
}

export function resolveBalanceWeights(preset: BalancePreset, custom?: BalanceWeights): BalanceWeights {
  const presets: Record<Exclude<BalancePreset, 'custom'>, BalanceWeights> = {
    consensus: { consensus: 1 },
    all_rounder: { consensus: 0.55, playtime: 0.15, pvm: 0.1, skilling: 0.1, raids: 0.1 },
    pvm: { consensus: 0.4, pvm: 0.35, raids: 0.2, playtime: 0.05 },
    skilling: { consensus: 0.45, skilling: 0.4, playtime: 0.15 },
    raids: { consensus: 0.4, raids: 0.4, pvm: 0.15, playtime: 0.05 },
  };
  const source = preset === 'custom' ? custom ?? { consensus: 1 } : presets[preset];
  const cleaned = Object.fromEntries(
    Object.entries(source)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .map(([key, value]) => [key, Number(value)]),
  );
  const total = Object.values(cleaned).reduce((sum, value) => sum + value, 0);
  if (!total) return { consensus: 1 };
  return Object.fromEntries(Object.entries(cleaned).map(([key, value]) => [key, value / total]));
}

function buildCandidate(input: {
  draftType: DraftType;
  players: PlayerRow[];
  captains: CaptainRow[];
  targetSizes: number[];
  groups: PlayerGroup[];
  hardConstraints: ConstraintRow[];
  softConstraints: ConstraintRow[];
  rankingMaps: RankingMaps;
  compositeScores: Map<string, number>;
  metricScores: Map<string, Record<string, number>>;
  balanceWeights: BalanceWeights;
  random: () => number;
}) {
  const teams = createEmptyTeams(input.captains, input.targetSizes);
  const placements = new Map<string, number>();
  const lockedGroups = input.groups.filter((group) => group.lockedTeamIndex !== null);
  for (const group of lockedGroups) {
    const team = teams.find((item) => item.teamIndex === group.lockedTeamIndex);
    if (!team || !canAddGroup(team, group, input.hardConstraints)) return null;
    addGroup(team, group);
    placements.set(group.id, team.teamIndex);
  }
  const remaining = input.groups.filter((group) => group.lockedTeamIndex === null && group.draftable.length);
  if (input.draftType === 'snake') {
    if (!placeSimulatedSnake(remaining, teams, placements, input)) return null;
  } else {
    const ordered = input.draftType === 'random'
      ? shuffle(remaining, input.random)
      : [...remaining].sort(
          (a, b) =>
            b.restrictionCount - a.restrictionCount ||
            b.draftable.length - a.draftable.length ||
            b.strength - a.strength ||
            input.random() - 0.5,
        );
    for (const group of ordered) {
      const legal = teams.filter((team) => canAddGroup(team, group, input.hardConstraints));
      if (!legal.length) return null;
      const selected = [...legal].sort((a, b) => {
        if (input.draftType === 'random') {
          return occupancy(a) - occupancy(b) || input.random() - 0.5;
        }
        return (
          incrementalPlacementCost(a, group, teams, input) -
            incrementalPlacementCost(b, group, teams, input) ||
          occupancy(a) - occupancy(b) ||
          input.random() - 0.5
        );
      })[0];
      addGroup(selected, group);
      placements.set(group.id, selected.teamIndex);
    }
  }
  if (teams.some((team) => team.memberIds.size !== team.targetSize)) return null;
  return { teams, placements };
}

function placeSimulatedSnake(
  remainingGroups: PlayerGroup[],
  teams: TeamState[],
  placements: Map<string, number>,
  input: Parameters<typeof buildCandidate>[0],
) {
  const remaining = [...remainingGroups];
  let turn = 0;
  let guard = 0;
  while (remaining.length && guard < remaining.length * teams.length * 8 + 80) {
    guard += 1;
    const team = teams[snakeTeamPosition(turn, teams.length)];
    turn += 1;
    if (!team || team.memberIds.size >= team.targetSize) continue;
    const legal = remaining.filter((group) => canAddGroup(team, group, input.hardConstraints));
    if (!legal.length) continue;
    const selected = [...legal].sort((a, b) => {
      const aPreference = captainPreference(team, a, input.rankingMaps);
      const bPreference = captainPreference(team, b, input.rankingMaps);
      return bPreference - aPreference || b.strength - a.strength || input.random() - 0.5;
    })[0];
    addGroup(team, selected);
    placements.set(selected.id, team.teamIndex);
    remaining.splice(remaining.indexOf(selected), 1);
  }
  if (remaining.length) {
    for (const group of remaining) {
      const legal = teams.filter((team) => canAddGroup(team, group, input.hardConstraints));
      if (!legal.length) return false;
      const team = legal.sort((a, b) => occupancy(a) - occupancy(b))[0];
      addGroup(team, group);
      placements.set(group.id, team.teamIndex);
    }
  }
  return true;
}

function improveWithLegalSwaps(input: {
  initial: { teams: TeamState[]; placements: Map<string, number>; objective: number };
  groups: PlayerGroup[];
  players: PlayerRow[];
  captains: CaptainRow[];
  targetSizes: number[];
  hardConstraints: ConstraintRow[];
  softConstraints: ConstraintRow[];
  rankingMaps: RankingMaps;
  compositeScores: Map<string, number>;
  metricScores: Map<string, Record<string, number>>;
  balanceWeights: BalanceWeights;
}) {
  const placements = new Map(input.initial.placements);
  let teams = input.initial.teams;
  let objective = input.initial.objective;
  const movable = input.groups.filter((group) => group.lockedTeamIndex === null && group.draftable.length);
  for (let iteration = 0; iteration < 10; iteration += 1) {
    let bestSwap: { a: PlayerGroup; b: PlayerGroup; teams: TeamState[]; objective: number } | null = null;
    for (let aIndex = 0; aIndex < movable.length; aIndex += 1) {
      const a = movable[aIndex];
      for (let bIndex = aIndex + 1; bIndex < movable.length; bIndex += 1) {
        const b = movable[bIndex];
        const aTeam = placements.get(a.id);
        const bTeam = placements.get(b.id);
        if (aTeam === undefined || bTeam === undefined || aTeam === bTeam) continue;
        if (a.draftable.length !== b.draftable.length) continue;
        const nextPlacements = new Map(placements);
        nextPlacements.set(a.id, bTeam);
        nextPlacements.set(b.id, aTeam);
        const nextTeams = teamsFromPlacements(
          input.captains,
          input.targetSizes,
          input.groups,
          nextPlacements,
          input.hardConstraints,
        );
        if (!nextTeams) continue;
        const report = calculateFairness({
          teams: nextTeams,
          players: input.players,
          captains: input.captains,
          rankingMaps: input.rankingMaps,
          constraints: [...input.hardConstraints, ...input.softConstraints],
          compositeScores: input.compositeScores,
          metricScores: input.metricScores,
          balanceWeights: input.balanceWeights,
        });
        if (report.objectiveScore + 0.0001 < objective && (!bestSwap || report.objectiveScore < bestSwap.objective)) {
          bestSwap = { a, b, teams: nextTeams, objective: report.objectiveScore };
        }
      }
    }
    if (!bestSwap) break;
    const aTeam = placements.get(bestSwap.a.id)!;
    const bTeam = placements.get(bestSwap.b.id)!;
    placements.set(bestSwap.a.id, bTeam);
    placements.set(bestSwap.b.id, aTeam);
    teams = bestSwap.teams;
    objective = bestSwap.objective;
  }
  return { teams, placements, objective };
}

export function calculateFairness(input: {
  teams: TeamState[];
  players: PlayerRow[];
  captains: CaptainRow[];
  rankingMaps: RankingMaps;
  constraints: ConstraintRow[];
  compositeScores: Map<string, number>;
  metricScores: Map<string, Record<string, number>>;
  balanceWeights: BalanceWeights;
}): FairnessReport {
  const teamByPlayer = new Map<string, number>();
  for (const team of input.teams) {
    for (const playerId of team.memberIds) teamByPlayer.set(playerId, team.teamIndex);
  }
  const hardViolations = input.constraints.filter((constraint) => {
    if ((constraint.enforcement ?? 'hard') !== 'hard') return false;
    return constraintViolated(constraint, teamByPlayer);
  }).length;
  const softViolations = input.constraints.filter((constraint) => {
    if ((constraint.enforcement ?? 'hard') !== 'soft') return false;
    return constraintViolated(constraint, teamByPlayer);
  }).length;
  let avoidViolations = 0;
  let preferencePenalty = 0;
  for (const team of input.teams) {
    const rankingMap = input.rankingMaps.get(team.captain.id);
    for (const playerId of team.memberIds) {
      if (playerId === team.captain.player_id) continue;
      const ranking = rankingMap?.get(playerId);
      if (ranking?.avoid) avoidViolations += 1;
      preferencePenalty += 10 - (ranking?.normalizedScore ?? 5.5);
    }
  }
  const teamStrengths = input.teams.map((team) => ({
    teamIndex: team.teamIndex,
    strength: round(
      [...team.memberIds].reduce((sum, id) => sum + (input.compositeScores.get(id) ?? 5), 0) /
        Math.max(1, team.memberIds.size),
      3,
    ),
    size: team.memberIds.size,
  }));
  const values = teamStrengths.map((team) => team.strength);
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const standardDeviation = Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length),
  );
  const strengthSpread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const metricSpreads: Record<string, number> = {};
  for (const metric of Object.keys(input.balanceWeights).filter((key) => key !== 'consensus')) {
    const averages = input.teams.map((team) => {
      const values = [...team.memberIds].map((id) => input.metricScores.get(id)?.[metric] ?? 5);
      return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    });
    metricSpreads[metric] = round(Math.max(...averages) - Math.min(...averages), 3);
  }
  const weightedMetricSpread = Object.entries(metricSpreads).reduce(
    (sum, [metric, spread]) => sum + spread * (input.balanceWeights[metric] ?? 0),
    0,
  );
  const objectiveScore =
    standardDeviation * 100 +
    weightedMetricSpread * 35 +
    softViolations * 100 +
    avoidViolations * 30 +
    preferencePenalty * 0.25 +
    hardViolations * 1_000_000;
  return {
    objectiveScore: round(objectiveScore, 3),
    strengthSpread: round(strengthSpread, 3),
    standardDeviation: round(standardDeviation, 3),
    teamStrengths,
    metricSpreads,
    hardConstraintsSatisfied: hardViolations === 0,
    softViolations,
    avoidViolations,
  };
}

function buildRankingMaps(captains: CaptainRow[], rankings: RankingRow[], players: PlayerRow[]) {
  const maps: RankingMaps = new Map(captains.map((captain) => [captain.id, new Map()]));
  for (const captain of captains) {
    const rows = players.map((player, index) => {
      const row = rankings.find((ranking) => ranking.captain_id === captain.id && ranking.player_id === player.id);
      const rank = row?.rank ?? index + 1;
      const score = validScore(row?.score) ? Number(row?.score) : scoreFromRank(rank, players.length);
      return { playerId: player.id, rank, score, avoid: Boolean(row?.avoid) };
    });
    const normalized = normalizeCaptainScores(rows);
    const map = maps.get(captain.id)!;
    for (const row of rows) {
      map.set(row.playerId, {
        rank: row.rank,
        score: row.score,
        normalizedScore: normalized.get(row.playerId) ?? 5.5,
        avoid: row.avoid,
      });
    }
  }
  return maps;
}

function averageNormalizedScores(players: PlayerRow[], captains: CaptainRow[], maps: RankingMaps) {
  return new Map(
    players.map((player) => {
      const values = captains.map((captain) => maps.get(captain.id)?.get(player.id)?.normalizedScore ?? 5.5);
      return [player.id, values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)] as const;
    }),
  );
}

function normalizeMetrics(players: PlayerRow[]) {
  const metricNames = new Set(players.flatMap((player) => Object.keys(player.metrics ?? {})));
  const normalized = new Map<string, Record<string, number>>(players.map((player) => [player.id, {}]));
  for (const metric of metricNames) {
    const known = players.flatMap((player) => {
      const value = player.metrics?.[metric];
      return typeof value === 'number' && Number.isFinite(value) ? [{ id: player.id, value }] : [];
    });
    const minimum = known.length ? Math.min(...known.map((item) => item.value)) : 0;
    const maximum = known.length ? Math.max(...known.map((item) => item.value)) : 0;
    for (const player of players) {
      const value = player.metrics?.[metric];
      normalized.get(player.id)![metric] = typeof value === 'number' && Number.isFinite(value)
        ? maximum === minimum
          ? 5.5
          : 1 + ((value - minimum) * 9) / (maximum - minimum)
        : 5.5;
    }
  }
  return normalized;
}

function buildCompositeScores(
  players: PlayerRow[],
  consensus: Map<string, number>,
  metrics: Map<string, Record<string, number>>,
  weights: BalanceWeights,
) {
  return new Map(
    players.map((player) => {
      const score = Object.entries(weights).reduce((sum, [metric, weight]) => {
        const value = metric === 'consensus' ? consensus.get(player.id) ?? 5.5 : metrics.get(player.id)?.[metric] ?? 5.5;
        return sum + value * weight;
      }, 0);
      return [player.id, score] as const;
    }),
  );
}

function buildGroups(
  players: PlayerRow[],
  captains: CaptainRow[],
  hardConstraints: ConstraintRow[],
  compositeScores: Map<string, number>,
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
  for (const constraint of hardConstraints) {
    if (constraint.constraint_type === 'together') union(constraint.player_a_id, constraint.player_b_id);
  }
  const byRoot = new Map<string, PlayerRow[]>();
  for (const player of players) {
    const root = find(player.id);
    const members = byRoot.get(root) ?? [];
    members.push(player);
    byRoot.set(root, members);
  }
  const captainByPlayer = new Map(captains.map((captain) => [captain.player_id, captain] as const));
  return [...byRoot.entries()].map(([id, members]) => {
    const groupCaptains = members.flatMap((member) => {
      const captain = captainByPlayer.get(member.id);
      return captain ? [captain] : [];
    });
    const draftable = members.filter((member) => !captainByPlayer.has(member.id));
    const memberIds = new Set(members.map((member) => member.id));
    return {
      id,
      members,
      draftable,
      captainIds: groupCaptains.map((captain) => captain.player_id),
      lockedTeamIndex: groupCaptains[0]?.team_index ?? null,
      strength: draftable.reduce((sum, member) => sum + (compositeScores.get(member.id) ?? 5), 0),
      restrictionCount: hardConstraints.filter(
        (constraint) => memberIds.has(constraint.player_a_id) || memberIds.has(constraint.player_b_id),
      ).length,
    } satisfies PlayerGroup;
  });
}

function validateHardGroups(
  groups: PlayerGroup[],
  captains: CaptainRow[],
  hardConstraints: ConstraintRow[],
  targetSizes: number[],
) {
  const groupByPlayer = new Map(groups.flatMap((group) => group.members.map((member) => [member.id, group] as const)));
  for (const group of groups) {
    if (group.captainIds.length > 1) {
      throw new DraftAssignmentError('A hard together group cannot contain more than one captain.', 'invalid_constraints');
    }
    const capacity = group.lockedTeamIndex === null
      ? Math.max(...targetSizes)
      : targetSizes[captains.findIndex((captain) => captain.team_index === group.lockedTeamIndex)] ?? 0;
    if (group.members.length > capacity) {
      throw new DraftAssignmentError(
        `A hard together group has ${group.members.length} players but its team has only ${capacity} spots.`,
        'invalid_constraints',
      );
    }
  }
  for (const constraint of hardConstraints) {
    if (
      constraint.constraint_type === 'apart' &&
      groupByPlayer.get(constraint.player_a_id)?.id === groupByPlayer.get(constraint.player_b_id)?.id
    ) {
      throw new DraftAssignmentError('A hard apart rule conflicts with a hard together group.', 'invalid_constraints');
    }
  }
}

function createEmptyTeams(captains: CaptainRow[], targetSizes: number[]): TeamState[] {
  return captains.map((captain, index) => ({
    teamIndex: captain.team_index,
    captain,
    targetSize: targetSizes[index] ?? 1,
    memberIds: new Set([captain.player_id]),
  }));
}

function teamsFromPlacements(
  captains: CaptainRow[],
  targetSizes: number[],
  groups: PlayerGroup[],
  placements: Map<string, number>,
  hardConstraints: ConstraintRow[],
) {
  const teams = createEmptyTeams(captains, targetSizes);
  for (const group of groups) {
    if (!group.draftable.length) continue;
    const teamIndex = group.lockedTeamIndex ?? placements.get(group.id);
    const team = teams.find((item) => item.teamIndex === teamIndex);
    if (!team || !canAddGroup(team, group, hardConstraints)) return null;
    addGroup(team, group);
  }
  return teams.every((team) => team.memberIds.size === team.targetSize) ? teams : null;
}

function canAddGroup(team: TeamState, group: PlayerGroup, hardConstraints: ConstraintRow[]) {
  const incoming = group.draftable.filter((player) => !team.memberIds.has(player.id));
  if (team.memberIds.size + incoming.length > team.targetSize) return false;
  const combined = new Set([...team.memberIds, ...incoming.map((player) => player.id)]);
  return !hardConstraints.some(
    (constraint) =>
      constraint.constraint_type === 'apart' &&
      combined.has(constraint.player_a_id) &&
      combined.has(constraint.player_b_id),
  );
}

function addGroup(team: TeamState, group: PlayerGroup) {
  for (const player of group.draftable) team.memberIds.add(player.id);
}

function incrementalPlacementCost(
  team: TeamState,
  group: PlayerGroup,
  teams: TeamState[],
  input: Parameters<typeof buildCandidate>[0],
) {
  const projected = teams.map((item) => {
    const ids = item === team
      ? [...item.memberIds, ...group.draftable.map((player) => player.id)]
      : [...item.memberIds];
    return ids.reduce((sum, id) => sum + (input.compositeScores.get(id) ?? 5), 0) / Math.max(1, ids.length);
  });
  const mean = projected.reduce((sum, value) => sum + value, 0) / projected.length;
  const variance = projected.reduce((sum, value) => sum + (value - mean) ** 2, 0) / projected.length;
  const preference = captainPreference(team, group, input.rankingMaps);
  const softPenalty = input.softConstraints.reduce((sum, constraint) => {
    const existing = team.memberIds;
    const incoming = new Set(group.members.map((member) => member.id));
    const oneExistingOneIncoming =
      (existing.has(constraint.player_a_id) && incoming.has(constraint.player_b_id)) ||
      (existing.has(constraint.player_b_id) && incoming.has(constraint.player_a_id));
    return sum + (constraint.constraint_type === 'apart' && oneExistingOneIncoming ? constraint.penalty ?? 100 : 0);
  }, 0);
  return Math.sqrt(variance) * 100 + softPenalty + (10 - preference) * 0.5;
}

function captainPreference(team: TeamState, group: PlayerGroup, maps: RankingMaps) {
  const map = maps.get(team.captain.id);
  if (!group.draftable.length) return 5.5;
  return group.draftable.reduce((sum, player) => sum + (map?.get(player.id)?.normalizedScore ?? 5.5), 0) /
    group.draftable.length;
}

function constraintViolated(constraint: ConstraintRow, teamByPlayer: Map<string, number>) {
  const a = teamByPlayer.get(constraint.player_a_id);
  const b = teamByPlayer.get(constraint.player_b_id);
  if (a === undefined || b === undefined) return false;
  return constraint.constraint_type === 'together' ? a !== b : a === b;
}

function occupancy(team: TeamState) {
  return team.memberIds.size / Math.max(1, team.targetSize);
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

export function liveTeamPosition(
  turnNumber: number,
  teamCount: number,
  order: 'snake' | 'linear' | 'third_round_reversal' = 'snake',
) {
  if (teamCount <= 1) return 0;
  if (order === 'linear') return turnNumber % teamCount;
  if (order === 'third_round_reversal') {
    const round = Math.floor(turnNumber / teamCount);
    const position = turnNumber % teamCount;
    if (round === 0) return position;
    if (round === 1 || round === 2) return teamCount - 1 - position;
    return round % 2 === 1 ? position : teamCount - 1 - position;
  }
  return snakeTeamPosition(turnNumber, teamCount);
}

function scoreFromRank(rank: number, playerCount: number) {
  if (playerCount <= 1) return 10;
  return clamp(Math.round(10 - ((rank - 1) * 9) / (playerCount - 1)), 1, 10);
}

function validScore(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle<T>(values: T[], random: () => number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
