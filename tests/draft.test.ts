import { describe, expect, it } from 'vitest';
import {
  assignTeams,
  DraftAssignmentError,
  normalizeCaptainScores,
  resolveBalanceWeights,
  type CaptainRow,
  type PlayerRow,
  type RankingRow,
} from '../lib/draft';

const players: PlayerRow[] = Array.from({ length: 10 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `Player ${index + 1}`,
  sort_order: index,
  metrics: { playtime: 10 + index * 3, pvm: index * 100 },
}));
const captains: CaptainRow[] = [
  { id: 'c1', player_id: 'p1', team_index: 0, name: 'Player 1' },
  { id: 'c2', player_id: 'p2', team_index: 1, name: 'Player 2' },
];
const rankings: RankingRow[] = captains.flatMap((captain, captainIndex) =>
  players.slice(2).map((player, index) => ({
    captain_id: captain.id,
    player_id: player.id,
    rank: captainIndex ? players.length - 2 - index : index + 1,
    score: captainIndex ? 2 + Math.floor(index / 2) : 10 - index,
    avoid: 0,
  })),
);

describe('captain score normalization', () => {
  it('removes captain-specific score scale while preserving preference order', () => {
    const generous = normalizeCaptainScores([
      { playerId: 'a', rank: 1, score: 10 },
      { playerId: 'b', rank: 2, score: 9 },
      { playerId: 'c', rank: 3, score: 8 },
    ]);
    const strict = normalizeCaptainScores([
      { playerId: 'a', rank: 1, score: 5 },
      { playerId: 'b', rank: 2, score: 3 },
      { playerId: 'c', rank: 3, score: 1 },
    ]);
    expect(generous.get('a')).toBeGreaterThan(generous.get('b')!);
    expect(strict.get('a')).toBeGreaterThan(strict.get('b')!);
    expect((generous.get('a')! + generous.get('b')! + generous.get('c')!) / 3).toBeCloseTo(5.5, 5);
    expect((strict.get('a')! + strict.get('b')! + strict.get('c')!) / 3).toBeCloseTo(5.5, 5);
  });

  it('normalizes custom balance weights', () => {
    expect(resolveBalanceWeights('custom', { consensus: 2, playtime: 1 })).toEqual({
      consensus: 2 / 3,
      playtime: 1 / 3,
    });
  });
});

describe('team assignment invariants', () => {
  it('uses every player once, reaches exact sizes, and preserves hard rules', () => {
    const result = assignTeams({
      draftId: 'event-1',
      draftType: 'balanced',
      players,
      captains,
      rankings,
      seed: 'repeatable',
      balancePreset: 'all_rounder',
      constraints: [
        { constraint_type: 'together', enforcement: 'hard', player_a_id: 'p3', player_b_id: 'p4' },
        { constraint_type: 'apart', enforcement: 'hard', player_a_id: 'p5', player_b_id: 'p6' },
      ],
    });
    expect(result.teams.map((team) => team.players.length + 1)).toEqual([5, 5]);
    const assignments = new Map<string, number>();
    for (const team of result.teams) {
      assignments.set(team.captain.id, team.teamIndex);
      for (const player of team.players) assignments.set(player.id, team.teamIndex);
    }
    expect(assignments.size).toBe(players.length);
    expect(assignments.get('p3')).toBe(assignments.get('p4'));
    expect(assignments.get('p5')).not.toBe(assignments.get('p6'));
    expect(result.fairness?.hardConstraintsSatisfied).toBe(true);
  });

  it('fails instead of silently overriding impossible hard rules', () => {
    expect(() =>
      assignTeams({
        draftId: 'impossible',
        draftType: 'balanced',
        players: players.slice(0, 4),
        captains,
        rankings: rankings.filter((ranking) => ['p3', 'p4'].includes(ranking.player_id)),
        constraints: [
          { constraint_type: 'together', enforcement: 'hard', player_a_id: 'p1', player_b_id: 'p3' },
          { constraint_type: 'apart', enforcement: 'hard', player_a_id: 'p1', player_b_id: 'p3' },
        ],
      }),
    ).toThrow(DraftAssignmentError);
  });

  it('is deterministic for the same explicit seed', () => {
    const input = {
      draftId: 'deterministic',
      draftType: 'random' as const,
      players,
      captains,
      rankings,
      seed: 'same-seed',
    };
    const first = assignTeams(input).teams.map((team) => team.players.map((player) => player.id));
    const second = assignTeams(input).teams.map((team) => team.players.map((player) => player.id));
    expect(second).toEqual(first);
  });
});
