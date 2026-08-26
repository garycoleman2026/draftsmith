import type { DraftResult } from './types';
import type { ConstraintRow } from './draft';

export function previewPlayerSwap(
  result: DraftResult,
  playerAId: string,
  playerBId: string,
  constraints: ConstraintRow[],
) {
  const copy = structuredClone(result);
  const aTeam = copy.teams.find((team) => team.players.some((player) => player.id === playerAId));
  const bTeam = copy.teams.find((team) => team.players.some((player) => player.id === playerBId));
  if (!aTeam || !bTeam) throw new Error('Choose two drafted non-captain players.');
  if (aTeam.teamIndex === bTeam.teamIndex) throw new Error('Choose players from different teams.');
  const aIndex = aTeam.players.findIndex((player) => player.id === playerAId);
  const bIndex = bTeam.players.findIndex((player) => player.id === playerBId);
  [aTeam.players[aIndex], bTeam.players[bIndex]] = [bTeam.players[bIndex], aTeam.players[aIndex]];
  const teamByPlayer = new Map<string, number>();
  for (const team of copy.teams) {
    teamByPlayer.set(team.captain.id, team.teamIndex);
    for (const player of team.players) teamByPlayer.set(player.id, team.teamIndex);
    const values = team.players.map((player) => player.compositeScore ?? player.averageScore).filter((value): value is number => value != null);
    team.compositeStrength = values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }
  const violated = constraints.filter((constraint) => {
    if ((constraint.enforcement ?? 'hard') !== 'hard') return false;
    const a = teamByPlayer.get(constraint.player_a_id);
    const b = teamByPlayer.get(constraint.player_b_id);
    return a !== undefined && b !== undefined &&
      (constraint.constraint_type === 'together' ? a !== b : a === b);
  });
  if (violated.length) throw new Error('That swap would break a hard together/apart rule.');
  copy.generatedAt = new Date().toISOString();
  const strengths = copy.teams.map((team) => team.compositeStrength).filter((value): value is number => value != null);
  if (copy.fairness && strengths.length) {
    copy.fairness.strengthSpread = round(Math.max(...strengths) - Math.min(...strengths));
    const mean = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
    copy.fairness.standardDeviation = round(Math.sqrt(strengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / strengths.length));
    copy.fairness.teamStrengths = copy.teams.map((team) => ({
      teamIndex: team.teamIndex, strength: team.compositeStrength ?? 0, size: team.players.length + 1,
    }));
    copy.fairness.hardConstraintsSatisfied = true;
  }
  return copy;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
