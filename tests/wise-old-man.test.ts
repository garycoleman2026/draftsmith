import { describe, expect, it } from 'vitest';
import { buildWiseOldManSignals, type WomTaskRequirement } from '../lib/bingo-wom-reconciliation';
import { defaultBingoTaskRule, type BingoTaskRule } from '../lib/bingo-rules';
import { parseWiseOldManGroup, parseWiseOldManPlayer, type WiseOldManSnapshot } from '../lib/wise-old-man-core';

const snapshotPayload = {
  playerId: 42,
  createdAt: '2026-08-27T12:00:00.000Z',
  data: {
    skills: {
      overall: { metric: 'overall', experience: 100_000_000, level: 2000 },
      agility: { metric: 'agility', experience: 10_000_000, level: 90 },
      runecraft: { metric: 'runecraft', experience: 5_000_000, level: 80 },
    },
    bosses: { giant_mole: { metric: 'giant_mole', kills: 100 }, zulrah: { metric: 'zulrah', kills: -1 } },
  },
};

describe('Wise Old Man snapshot parsing', () => {
  it('normalizes complete player details while discarding unknown negative KC', () => {
    const parsed = parseWiseOldManPlayer({
      id: 42, displayName: 'Terry Main', updatedAt: '2026-08-27T12:01:00.000Z', latestSnapshot: snapshotPayload,
    });
    expect(parsed).toMatchObject({
      playerId: 42, displayName: 'Terry Main', normalizedName: 'terry main', snapshotAt: '2026-08-27T12:00:00.000Z',
      skills: { agility: { experience: 10_000_000, level: 90 } }, bosses: { giant_mole: 100 },
    });
    expect(parsed.bosses).not.toHaveProperty('zulrah');
  });

  it('parses the official bulk group shape in one pass', () => {
    const parsed = parseWiseOldManGroup([{ player: { id: 42, displayName: 'Terry Main' }, data: snapshotPayload }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].skills.overall.experience).toBe(100_000_000);
  });
});

describe('Wise Old Man bingo reconciliation', () => {
  it('turns baseline deltas into one cumulative team XP signal', () => {
    const task = requirement('xp', 'xp_gain', { metric: 'agility', amount: 10_000_000 }, 'team_total');
    const baseline = [roster('a', 'team', stats(1_000_000, 90, 10)), roster('b', 'team', stats(2_000_000, 91, 20))];
    const current = [roster('a', 'team', stats(5_000_000, 91, 13)), roster('b', 'team', stats(8_000_000, 92, 27))];
    const signals = buildWiseOldManSignals({ runId: 'run-12345678', tasks: [task], baseline, current });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ teamId: 'team', memberId: null, signal: { metric: 'agility', value: 10_000_000, measurement: 'absolute' } });
  });

  it('keeps individual KC progress separated by member', () => {
    const task = requirement('mole', 'boss_kc', { metric: 'giant_mole', amount: 25 }, 'any_member');
    const signals = buildWiseOldManSignals({
      runId: 'run-12345678', tasks: [task],
      baseline: [roster('a', 'team', stats(1, 98, 100)), roster('b', 'team', stats(1, 70, 20))],
      current: [roster('a', 'team', stats(1, 99, 110)), roster('b', 'team', stats(1, 71, 45))],
    });
    expect(signals.map((item) => [item.memberId, item.signal.value])).toEqual([['a', 10], ['b', 25]]);
    expect(signals.every((item) => item.signal.metadata.eligibleTaskIds instanceof Array)).toBe(true);
  });

  it('only reports a level target when it was below target at baseline', () => {
    const task = requirement('level', 'level_reached', { metric: 'agility', amount: 99 }, 'any_member');
    const signals = buildWiseOldManSignals({
      runId: 'run-12345678', tasks: [task],
      baseline: [roster('already', 'team', stats(1, 99, 0)), roster('earned', 'team', stats(1, 98, 0))],
      current: [roster('already', 'team', stats(1, 99, 0)), roster('earned', 'team', stats(1, 99, 0))],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ memberId: 'earned', signal: { value: 99 } });
  });
});

function requirement(id: string, type: BingoTaskRule['verifier']['type'], verifier: Partial<BingoTaskRule['verifier']>, scope: BingoTaskRule['scope']['type']): WomTaskRequirement {
  const base = defaultBingoTaskRule('stat_delta');
  return {
    id,
    rule: {
      ...base,
      verifier: { ...base.verifier, type, ...verifier },
      scope: { type: scope, participantCount: null },
      proof: { sources: ['wise_old_man'], approval: 'review' },
    },
  };
}

function stats(agilityXp: number, agilityLevel: number, moleKills: number): WiseOldManSnapshot {
  return {
    schemaVersion: 1, playerId: null, displayName: 'Player', normalizedName: 'player',
    providerUpdatedAt: '2026-08-27T12:00:00.000Z', snapshotAt: '2026-08-27T12:00:00.000Z',
    skills: { overall: { experience: agilityXp, level: agilityLevel }, agility: { experience: agilityXp, level: agilityLevel } },
    bosses: { giant_mole: moleKills },
  };
}
function roster(memberId: string, teamId: string, snapshot: WiseOldManSnapshot) { return { memberId, teamId, snapshot }; }
