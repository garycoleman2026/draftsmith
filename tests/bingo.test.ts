import { describe, expect, it } from 'vitest';
import { calculateBingoStandings, claimAvailability, countCompletedLines } from '../lib/bingo-scoring';
import { parseBingoTaskImport, sanitizeBingoTasks } from '../lib/bingo-types';

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
});
