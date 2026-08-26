import { getTargetTeamSizes, snakeTeamPosition, type CaptainRow, type ConstraintRow, type PlayerRow } from './draft';
import type { DraftResult } from './types';

export type LivePickRow = {
  captain_id: string;
  player_id: string;
  pick_number: number;
  turn_number: number;
  picked_at: string;
};

export function getLiveTurn(input: {
  totalPlayers: number;
  captains: CaptainRow[];
  picks: LivePickRow[];
}) {
  const captains = [...input.captains].sort((a, b) => a.team_index - b.team_index);
  if (!captains.length) return null;
  const targetSizes = getTargetTeamSizes(input.totalPlayers, captains.length);
  const pickCountByCaptain = new Map<string, number>();
  for (const pick of input.picks) {
    pickCountByCaptain.set(pick.captain_id, (pickCountByCaptain.get(pick.captain_id) ?? 0) + 1);
  }
  let turnNumber = input.picks.length
    ? Math.max(...input.picks.map((pick) => pick.turn_number)) + 1
    : 0;
  const maxChecks = input.totalPlayers * captains.length + captains.length + 10;
  for (let check = 0; check < maxChecks; check += 1) {
    const position = snakeTeamPosition(turnNumber, captains.length);
    const captain = captains[position];
    const teamSize = 1 + (pickCountByCaptain.get(captain.id) ?? 0);
    if (teamSize < (targetSizes[position] ?? 1)) return { turnNumber, captain };
    turnNumber += 1;
  }
  return null;
}

export function getTogetherGroupIds(
  playerId: string,
  players: PlayerRow[],
  constraints: ConstraintRow[],
) {
  const playerIds = new Set(players.map((player) => player.id));
  const connected = new Set([playerId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const constraint of constraints) {
      if (constraint.constraint_type !== 'together') continue;
      if (connected.has(constraint.player_a_id) && !connected.has(constraint.player_b_id)) {
        connected.add(constraint.player_b_id);
        changed = true;
      }
      if (connected.has(constraint.player_b_id) && !connected.has(constraint.player_a_id)) {
        connected.add(constraint.player_a_id);
        changed = true;
      }
    }
  }
  return [...connected].filter((id) => playerIds.has(id));
}

export function hasApartConflict(
  currentTeamIds: Set<string>,
  incomingIds: Set<string>,
  constraints: ConstraintRow[],
) {
  const combined = new Set([...currentTeamIds, ...incomingIds]);
  return constraints.some(
    (constraint) =>
      constraint.constraint_type === 'apart' &&
      combined.has(constraint.player_a_id) &&
      combined.has(constraint.player_b_id),
  );
}

export function buildLiveResult(input: {
  players: PlayerRow[];
  captains: CaptainRow[];
  picks: LivePickRow[];
}): DraftResult {
  const playerById = new Map(input.players.map((player) => [player.id, player] as const));
  const picksByCaptain = new Map<string, LivePickRow[]>();
  for (const pick of input.picks) {
    const picks = picksByCaptain.get(pick.captain_id) ?? [];
    picks.push(pick);
    picksByCaptain.set(pick.captain_id, picks);
  }
  const teams = [...input.captains]
    .sort((a, b) => a.team_index - b.team_index)
    .map((captain) => ({
      teamIndex: captain.team_index,
      captain: { id: captain.player_id, name: captain.name },
      players: (picksByCaptain.get(captain.id) ?? [])
        .sort((a, b) => a.pick_number - b.pick_number)
        .flatMap((pick) => {
          const player = playerById.get(pick.player_id);
          return player ? [{ id: player.id, name: player.name, averageScore: null }] : [];
        }),
      averageScore: null,
    }));
  return {
    generatedAt: new Date().toISOString(),
    draftType: 'live',
    teams,
    avoidOverrides: 0,
    constraintOverrides: 0,
  };
}
