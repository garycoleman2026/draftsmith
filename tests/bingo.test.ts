import { describe, expect, it } from 'vitest';
import { calculateBingoStandings, claimAvailability, countCompletedLines } from '../lib/bingo-scoring';
import { BUILTIN_BINGO_TEMPLATES, OSRS_BINGO_PRESETS, parseBingoTaskImport, sanitizeBingoTasks, serializeBingoTaskImport } from '../lib/bingo-types';
import {
  defaultBingoEventRules,
  bingoTaskImageUrl,
  expectedIndividualHours,
  expectedTeamHours,
  formatTaskTime,
  sanitizeBingoTaskRule,
  validateBingoBoard,
} from '../lib/bingo-rules';

const tasks = Array.from({ length: 25 }, (_, index) => ({
  id: `task-${index}`, sortOrder: index, points: index === 12 ? 0 : 10, freeSpace: index === 12,
}));

describe('bingo scoring', () => {
  it('counts rows, columns, and diagonals with the free center', () => {
    expect(countCompletedLines(tasks, new Set(['task-0', 'task-1', 'task-2', 'task-3', 'task-4']), 5)).toBe(1);
    expect(countCompletedLines(tasks, new Set(['task-0', 'task-6', 'task-18', 'task-24', 'task-12']), 5)).toBe(1);
    expect(countCompletedLines(tasks, new Set(['task-2', 'task-7', 'task-17', 'task-22', 'task-12']), 5)).toBe(1);
  });

  it('ranks classic boards by completed lines before raw tile score', () => {
    const standings = calculateBingoStandings(
      [{ id: 'line', name: 'Line', sourceTeamIndex: 0 }, { id: 'scatter', name: 'Scatter', sourceTeamIndex: 1 }],
      tasks,
      [
        ...['task-0', 'task-1', 'task-2', 'task-3', 'task-4'].map((taskId) => ({ taskId, teamId: 'line', points: 1 })),
        ...['task-5', 'task-6', 'task-8', 'task-9', 'task-10', 'task-11'].map((taskId) => ({ taskId, teamId: 'scatter', points: 1 })),
      ],
      5,
      'lines',
    );
    expect(standings[0].id).toBe('line');
    expect(standings[0].lineCount).toBe(1);
  });

  it('scores duplicate repeatable completions and preserves deterministic ties', () => {
    const standings = calculateBingoStandings(
      [{ id: 'a', name: 'A', sourceTeamIndex: 0 }, { id: 'b', name: 'B', sourceTeamIndex: 1 }],
      tasks,
      [{ taskId: 'task-0', teamId: 'a', points: 10 }, { taskId: 'task-0', teamId: 'a', points: 10 }],
      5,
    );
    expect(standings[0]).toMatchObject({ id: 'a', score: 20, completedCount: 1 });
  });
});

describe('bingo claim constraints', () => {
  it('blocks a globally owned lockout tile', () => {
    expect(claimAvailability({
      mode: 'lockout', repeatable: false, maxCompletions: 1, taskId: 'task', teamId: 'b', hasPendingClaim: false,
      completions: [{ taskId: 'task', teamId: 'a', points: 10 }],
    })).toMatchObject({ allowed: false });
  });

  it('blocks duplicate pending and maxed repeatable claims', () => {
    expect(claimAvailability({ mode: 'points', repeatable: false, maxCompletions: 1, taskId: 'task', teamId: 'a', completions: [], hasPendingClaim: true }).allowed).toBe(false);
    expect(claimAvailability({
      mode: 'points', repeatable: true, maxCompletions: 2, taskId: 'task', teamId: 'a', hasPendingClaim: false,
      completions: [{ taskId: 'task', teamId: 'a', points: 5 }, { taskId: 'task', teamId: 'a', points: 5 }],
    }).allowed).toBe(false);
  });

  it('blocks a progression tile until its prerequisites are complete for that team', () => {
    expect(claimAvailability({
      mode: 'progression', repeatable: false, maxCompletions: 1, taskId: 'next', teamId: 'a',
      completions: [{ taskId: 'first', teamId: 'b', points: 10 }], hasPendingClaim: false,
      prerequisiteTaskIds: ['first'],
    })).toMatchObject({ allowed: false });
    expect(claimAvailability({
      mode: 'progression', repeatable: false, maxCompletions: 1, taskId: 'next', teamId: 'a',
      completions: [{ taskId: 'first', teamId: 'a', points: 10 }], hasPendingClaim: false,
      prerequisiteTaskIds: ['first'],
    })).toMatchObject({ allowed: true });
  });
});

describe('bingo task imports', () => {
  it('accepts pipe, tab, and quoted CSV rows', () => {
    const parsed = parseBingoTaskImport([
      'Task one | 25 | Bossing | screenshot | Show the drop',
      'Task two\t40\tSkilling\tstat delta\tGain XP',
      '"Task, three",55,Clues,hybrid,"Show clue, reward"',
    ].join('\n'));
    expect(parsed).toHaveLength(3);
    expect(parsed.map((task) => task.title)).toEqual(['Task one', 'Task two', 'Task, three']);
    expect(parsed[1].verificationMode).toBe('stat_delta');
    expect(parsed[2].description).toBe('Show clue, reward');
  });

  it('normalizes a free tile and rejects empty entries', () => {
    expect(sanitizeBingoTasks([{ title: 'Free Space', points: 99 }, { title: '' }], 25)).toEqual([
      expect.objectContaining({ title: "Terry's free space", freeSpace: true, points: 0 }),
    ]);
  });

  it('round-trips verifier, scope, proof, presentation, planning, details, and prerequisites', () => {
    const source = structuredClone(OSRS_BINGO_PRESETS.find((task) => task.title.includes('Agility XP'))!);
    source.rule.prerequisitePositions = [0, 4];
    source.rule.details.notes = 'Use the event baseline.';
    source.rule.details.exclusions = 'No XP before the start time.';
    source.rule.details.sourceUrl = 'https://oldschool.runescape.wiki/w/Agility';
    const [parsed] = parseBingoTaskImport(serializeBingoTaskImport([source]));
    expect(parsed.rule).toMatchObject({
      verifier: { type: 'xp_gain', metric: 'agility', amount: 10_000_000, unit: 'XP' },
      scope: { type: 'team_total' },
      presentation: { imageKind: 'item', imageKey: 'Agility cape' },
      planning: { efficientUnitsPerHour: 100_000, quantity: 1 },
      details: {
        notes: 'Use the event baseline.',
        exclusions: 'No XP before the start time.',
        sourceUrl: 'https://oldschool.runescape.wiki/w/Agility',
      },
      prerequisitePositions: [0, 4],
    });
    expect(parsed.rule.proof.sources).toEqual(['wise_old_man', 'runelite', 'screenshot']);
  });

  it('calculates expected solo and parallel team hours from editable task assumptions', () => {
    const oathplate = OSRS_BINGO_PRESETS.find((task) => task.title === 'Get an Oathplate helm')!;
    const agility = OSRS_BINGO_PRESETS.find((task) => task.title.includes('Agility XP'))!;
    expect(expectedIndividualHours(oathplate.rule)).toBe(60);
    expect(expectedTeamHours(oathplate.rule, 10)).toBe(6);
    expect(expectedIndividualHours(agility.rule)).toBe(100);
    expect(expectedTeamHours(agility.rule, 10)).toBe(10);
  });

  it('uses a speed task clock target instead of an arbitrary attempt budget', () => {
    const tob = OSRS_BINGO_PRESETS.find((task) => task.title === 'Beat the GM Theatre of Blood trio time')!;
    const chambers = OSRS_BINGO_PRESETS.find((task) => task.title === 'Beat the Chambers CM five-player time')!;
    expect(expectedIndividualHours(tob.rule)).toBeCloseTo(1_050 / 3_600);
    expect(formatTaskTime(tob.rule)).toBe('17:30');
    expect(formatTaskTime(chambers.rule)).toBe('25:00');
  });

  it('sanitizes unsafe source links and impossible planning values', () => {
    const rule = sanitizeBingoTaskRule({
      details: { sourceUrl: 'javascript:alert(1)' },
      planning: { dropRateNumerator: -1, dropRateDenominator: 'nope', efficientKillsPerHour: 0, quantity: 900 },
    });
    expect(rule.details.sourceUrl).toBe('');
    expect(rule.planning).toMatchObject({
      dropRateNumerator: null,
      dropRateDenominator: null,
      efficientKillsPerHour: null,
      quantity: 100,
    });
  });

  it('ships a broad OSRS library with the requested headline presets', () => {
    expect(OSRS_BINGO_PRESETS.length).toBeGreaterThanOrEqual(60);
    expect(OSRS_BINGO_PRESETS.map((task) => task.title)).toEqual(expect.arrayContaining([
      'Get an Oathplate helm', 'Obtain the Baby mole pet', 'Receive a Twisted ancestral colour kit',
      'Beat the GM Theatre of Blood trio time', 'Beat the Chambers CM five-player time',
      'Gain 10,000,000 team Agility XP',
    ]));
  });

  it('configures resolvable artwork keys for every official preset', () => {
    expect(OSRS_BINGO_PRESETS.filter((task) => task.rule.presentation.imageKind === 'none')).toEqual([]);
    expect(Object.fromEntries(OSRS_BINGO_PRESETS.map((task) => [task.title, task.rule.presentation.imageKey])))
      .toMatchObject({
        'Obtain the Baby mole pet': 'Baby Mole',
        'Receive a scythe of Vitur': 'Scythe of Vitur (uncharged)',
        'Gain 50 Zulrah kill count': 'Zulrah (serpentine)',
        'Complete one Barrows armour set': 'Chest (Barrows)',
        'Receive a Tome of water from Tempoross': 'Tome of Water (empty)',
        'Receive a tome of fire from Wintertodt': 'Tome of Fire (empty)',
        'Receive an imp champion scroll': 'Imp champion scroll',
        'Receive the jar of dirt from Kraken': 'Jar of Dirt',
      });
    expect(OSRS_BINGO_PRESETS.every((task) => bingoTaskImageUrl(task.rule)?.startsWith('https://oldschool.runescape.wiki/')))
      .toBe(true);
  });

  it('gives every non-free official starter tile an editable time estimate', () => {
    for (const template of BUILTIN_BINGO_TEMPLATES) {
      expect(template.tasks.filter((task) => !task.freeSpace && expectedIndividualHours(task.rule) === null))
        .toEqual([]);
    }
  });

  it('validates variable grid boards and structured task requirements', () => {
    const rules = defaultBingoEventRules(3, 'points');
    const board = OSRS_BINGO_PRESETS.slice(0, 9);
    expect(validateBingoBoard(board, rules)).toMatchObject({ valid: true, errors: [] });
    expect(validateBingoBoard(board.slice(0, 8), rules)).toMatchObject({ valid: false });
  });
});
