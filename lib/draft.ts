import type { DraftResult, DraftType, ResultTeam } from './types';

type PlayerRow = { id: string; name: string; sort_order: number };
type CaptainRow = {
  id: string;
  player_id: string;
  team_index: number;
  name: string;
};
type RankingRow = {
  captain_id: string;
  player_id: string;
  rank: number;
  avoid: number;
};

type TeamState = ResultTeam & {
  strength: number;
  targetSize: number;
};

export function assignTeams(input: {
  draftId: string;
  draftType: DraftType;
  players: PlayerRow[];
  captains: CaptainRow[];
  rankings: RankingRow[];
}): DraftResult {
  const { draftId, draftType, players, captains, rankings } = input;
  const captainPlayerIds = new Set(captains.map((captain) => captain.player_id));
  const draftable = players.filter((player) => !captainPlayerIds.has(player.id));
  const rankingMaps = new Map<string, Map<string, { rank: number; avoid: boolean }>>();

  for (const captain of captains) rankingMaps.set(captain.id, new Map());
  for (const ranking of rankings) {
    rankingMaps.get(ranking.captain_id)?.set(ranking.player_id, {
      rank: ranking.rank,
      avoid: Boolean(ranking.avoid),
    });
  }

  const averageRanks = new Map<string, number>();
  for (const player of draftable) {
    const ranks = captains
      .map((captain) => rankingMaps.get(captain.id)?.get(player.id)?.rank)
      .filter((rank): rank is number => typeof rank === 'number');
    const average = ranks.length
      ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
      : draftable.length;
    averageRanks.set(player.id, average);
  }

  const baseSize = Math.floor(players.length / captains.length);
  const largerTeams = players.length % captains.length;
  const teams: TeamState[] = captains
    .slice()
    .sort((a, b) => a.team_index - b.team_index)
    .map((captain, index) => ({
      teamIndex: captain.team_index,
      captain: { id: captain.player_id, name: captain.name },
      players: [],
      averageRank: null,
      strength: 0,
      targetSize: baseSize + (index < largerTeams ? 1 : 0),
    }));

  let avoidOverrides = 0;
  const addPlayer = (team: TeamState, player: PlayerRow) => {
    const averageRank = averageRanks.get(player.id) ?? null;
    team.players.push({ id: player.id, name: player.name, averageRank });
    team.strength += averageRank === null ? 0 : draftable.length + 1 - averageRank;
  };

  const availableTeams = (player: PlayerRow) => {
    const withRoom = teams.filter((team) => team.players.length + 1 < team.targetSize);
    const notAvoided = withRoom.filter((team) => {
      const captain = captains.find((item) => item.team_index === team.teamIndex);
      return captain ? !rankingMaps.get(captain.id)?.get(player.id)?.avoid : true;
    });
    if (notAvoided.length) return notAvoided;
    if (withRoom.length) avoidOverrides += 1;
    return withRoom;
  };

  if (draftType === 'random') {
    const shuffled = seededShuffle(draftable, hashSeed(draftId));
    for (const player of shuffled) {
      const options = availableTeams(player).sort(
        (a, b) => a.players.length - b.players.length || a.teamIndex - b.teamIndex,
      );
      if (options[0]) addPlayer(options[0], player);
    }
  } else if (draftType === 'snake') {
    const remaining = new Map(draftable.map((player) => [player.id, player]));
    let round = 0;
    while (remaining.size) {
      const order = round % 2 ? [...teams].reverse() : teams;
      let pickedThisRound = 0;
      for (const team of order) {
        if (team.players.length + 1 >= team.targetSize || !remaining.size) continue;
        const captain = captains.find((item) => item.team_index === team.teamIndex);
        if (!captain) continue;
        const ranked = [...remaining.values()].sort((a, b) => {
          const aRank = rankingMaps.get(captain.id)?.get(a.id)?.rank ?? draftable.length;
          const bRank = rankingMaps.get(captain.id)?.get(b.id)?.rank ?? draftable.length;
          return aRank - bRank || a.sort_order - b.sort_order;
        });
        const preferred = ranked.find(
          (player) => !rankingMaps.get(captain.id)?.get(player.id)?.avoid,
        );
        const pick = preferred ?? ranked[0];
        if (!pick) continue;
        if (!preferred) avoidOverrides += 1;
        addPlayer(team, pick);
        remaining.delete(pick.id);
        pickedThisRound += 1;
      }
      if (!pickedThisRound) break;
      round += 1;
    }
  } else {
    const strongestFirst = [...draftable].sort(
      (a, b) =>
        (averageRanks.get(a.id) ?? draftable.length) -
          (averageRanks.get(b.id) ?? draftable.length) ||
        a.sort_order - b.sort_order,
    );
    for (const player of strongestFirst) {
      const playerStrength = draftable.length + 1 - (averageRanks.get(player.id) ?? draftable.length);
      const options = availableTeams(player).sort((a, b) => {
        const aCaptain = captains.find((item) => item.team_index === a.teamIndex);
        const bCaptain = captains.find((item) => item.team_index === b.teamIndex);
        const aSlots = Math.max(1, a.targetSize - 1);
        const bSlots = Math.max(1, b.targetSize - 1);
        const aPreference = aCaptain
          ? (rankingMaps.get(aCaptain.id)?.get(player.id)?.rank ?? draftable.length) /
            Math.max(1, draftable.length)
          : 1;
        const bPreference = bCaptain
          ? (rankingMaps.get(bCaptain.id)?.get(player.id)?.rank ?? draftable.length) /
            Math.max(1, draftable.length)
          : 1;
        const aScore = (a.strength + playerStrength) / aSlots + aPreference * 0.12;
        const bScore = (b.strength + playerStrength) / bSlots + bPreference * 0.12;
        return aScore - bScore || a.teamIndex - b.teamIndex;
      });
      if (options[0]) addPlayer(options[0], player);
    }
  }

  for (const team of teams) {
    team.players.sort(
      (a, b) =>
        (a.averageRank ?? Number.MAX_SAFE_INTEGER) -
          (b.averageRank ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name),
    );
    team.averageRank = team.players.length
      ? team.players.reduce((sum, player) => sum + (player.averageRank ?? draftable.length), 0) /
        team.players.length
      : null;
  }

  return {
    generatedAt: new Date().toISOString(),
    draftType,
    teams: teams.map(({ strength: _strength, targetSize: _targetSize, ...team }) => team),
    avoidOverrides,
  };
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
