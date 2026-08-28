import {
  expectedIndividualHours,
  expectedPersonHours,
  expectedTeamHours,
  type BingoTaskRule,
} from './bingo-rules';

export type BingoPlanningTask = {
  freeSpace?: boolean;
  rule: BingoTaskRule;
};

export type BingoPlanningSummary = {
  teamSize: number;
  estimatedTaskCount: number;
  totalTaskCount: number;
  coverage: number;
  individualHours: number;
  personHours: number;
  parallelTeamHours: number;
  windowHours: number | null;
  teamCapacityHours: number | null;
  loadRatio: number | null;
  fit: 'no_deadline' | 'missing_dates' | 'roomy' | 'balanced' | 'tight' | 'over_capacity';
};

export function summarizeBingoPlanning(
  tasks: BingoPlanningTask[],
  teamSizeInput: number,
  startAt?: string | null,
  endAt?: string | null,
): BingoPlanningSummary {
  const teamSize = Math.max(1, Math.min(100, Math.round(Number(teamSizeInput) || 1)));
  const activeTasks = tasks.filter((task) => !task.freeSpace);
  const estimates = activeTasks.flatMap((task) => {
    const individual = expectedIndividualHours(task.rule);
    const team = expectedTeamHours(task.rule, teamSize);
    const people = expectedPersonHours(task.rule, teamSize);
    return individual === null || team === null || people === null ? [] : [{ individual, team, people }];
  });
  const individualHours = sum(estimates.map((estimate) => estimate.individual));
  const personHours = sum(estimates.map((estimate) => estimate.people));
  const parallelTeamHours = personHours / teamSize;
  const windowHours = eventWindowHours(startAt, endAt);
  const teamCapacityHours = windowHours === null ? null : windowHours * teamSize;
  const loadRatio = teamCapacityHours && teamCapacityHours > 0 ? personHours / teamCapacityHours : null;
  const fit = !endAt ? 'no_deadline'
    : windowHours === null ? 'missing_dates'
      : loadRatio === null || loadRatio <= 0.5 ? 'roomy'
        : loadRatio <= 0.85 ? 'balanced'
          : loadRatio <= 1 ? 'tight' : 'over_capacity';
  return {
    teamSize,
    estimatedTaskCount: estimates.length,
    totalTaskCount: activeTasks.length,
    coverage: activeTasks.length ? estimates.length / activeTasks.length : 1,
    individualHours,
    personHours,
    parallelTeamHours,
    windowHours,
    teamCapacityHours,
    loadRatio,
    fit,
  };
}

export function eventWindowHours(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) return null;
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return (end - start) / 3_600_000;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
