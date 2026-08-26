import { describe, expect, it } from 'vitest';
import { liveTeamPosition } from '../lib/draft';
import { getLiveTurn } from '../lib/live';

const captains = [
  { id: 'a', player_id: 'p1', team_index: 0, name: 'A' },
  { id: 'b', player_id: 'p2', team_index: 1, name: 'B' },
  { id: 'c', player_id: 'p3', team_index: 2, name: 'C' },
];

describe('live draft order', () => {
  it('supports snake, linear, and third-round reversal', () => {
    expect(Array.from({ length: 6 }, (_, turn) => liveTeamPosition(turn, 3, 'snake'))).toEqual([0, 1, 2, 2, 1, 0]);
    expect(Array.from({ length: 6 }, (_, turn) => liveTeamPosition(turn, 3, 'linear'))).toEqual([0, 1, 2, 0, 1, 2]);
    expect(Array.from({ length: 9 }, (_, turn) => liveTeamPosition(turn, 3, 'third_round_reversal'))).toEqual([
      0, 1, 2, 2, 1, 0, 2, 1, 0,
    ]);
  });

  it('advances from pass actions as well as picks', () => {
    const turn = getLiveTurn({
      totalPlayers: 9,
      captains,
      picks: [],
      actions: [{ captain_id: 'a', turn_number: 0, action: 'pass', created_at: new Date().toISOString() }],
      order: 'linear',
    });
    expect(turn?.captain.id).toBe('b');
    expect(turn?.turnNumber).toBe(1);
  });
});
