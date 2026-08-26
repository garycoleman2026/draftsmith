import { describe, expect, it } from 'vitest';
import { previewPlayerSwap } from '../lib/results';
import type { DraftResult } from '../lib/types';

const result: DraftResult = {
  generatedAt: '2026-01-01T00:00:00.000Z', draftType: 'balanced', avoidOverrides: 0, constraintOverrides: 0,
  teams: [
    { teamIndex: 0, captain: { id: 'c1', name: 'One' }, averageScore: 5, players: [{ id: 'a', name: 'A', averageScore: 8 }] },
    { teamIndex: 1, captain: { id: 'c2', name: 'Two' }, averageScore: 5, players: [{ id: 'b', name: 'B', averageScore: 3 }] },
  ],
};

describe('manual result swaps', () => {
  it('previews a legal one-for-one swap without mutating the saved result', () => {
    const next = previewPlayerSwap(result, 'a', 'b', []);
    expect(next.teams[0].players[0].id).toBe('b');
    expect(result.teams[0].players[0].id).toBe('a');
  });

  it('rejects a hard constraint violation', () => {
    expect(() => previewPlayerSwap(result, 'a', 'b', [{
      constraint_type: 'together', enforcement: 'hard', player_a_id: 'c1', player_b_id: 'a',
    }])).toThrow(/hard/);
  });
});
