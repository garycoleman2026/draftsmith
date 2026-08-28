import { describe, expect, it } from 'vitest';
import { summarizeBingoPlanning } from '../lib/bingo-planning';
import { OSRS_BINGO_PRESETS } from '../lib/bingo-types';

describe('bingo duration planning', () => {
  const oathplate = OSRS_BINGO_PRESETS.find((task) => task.title === 'Get an Oathplate helm')!;
  const mole = OSRS_BINGO_PRESETS.find((task) => task.title === 'Obtain the Baby mole pet')!;

  it('compares expected person-hours with the dated team capacity', () => {
    const summary = summarizeBingoPlanning(
      [oathplate, mole],
      5,
      '2026-08-28T00:00:00.000Z',
      '2026-08-30T00:00:00.000Z',
    );

    expect(summary.estimatedTaskCount).toBe(2);
    expect(summary.individualHours).toBeCloseTo(95.294, 2);
    expect(summary.personHours).toBeCloseTo(95.294, 2);
    expect(summary.parallelTeamHours).toBeCloseTo(19.059, 2);
    expect(summary.windowHours).toBe(48);
    expect(summary.teamCapacityHours).toBe(240);
    expect(summary.loadRatio).toBeCloseTo(0.397, 2);
    expect(summary.fit).toBe('roomy');
  });

  it('supports an intentionally open-ended bingo', () => {
    const summary = summarizeBingoPlanning([oathplate], 4, '2026-08-28T00:00:00.000Z', null);
    expect(summary.fit).toBe('no_deadline');
    expect(summary.windowHours).toBeNull();
  });
});
