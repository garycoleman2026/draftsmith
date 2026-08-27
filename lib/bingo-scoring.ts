export type BingoScoreTeam = { id: string; name: string; sourceTeamIndex: number };
export type BingoScoreTask = { id: string; sortOrder: number; points: number; freeSpace: boolean };
export type BingoScoreCompletion = { taskId: string; teamId: string; points: number };

export type BingoStanding = BingoScoreTeam & {
  score: number;
  completedCount: number;
  lineCount: number;
  completedTaskIds: string[];
};

export function calculateBingoStandings(
  teams: BingoScoreTeam[],
  tasks: BingoScoreTask[],
  completions: BingoScoreCompletion[],
  gridSize: number,
  rankingMode: 'points' | 'lines' = 'points',
): BingoStanding[] {
  const freeTaskIds = tasks.filter((task) => task.freeSpace).map((task) => task.id);
  return teams.map((team) => {
    const teamCompletions = completions.filter((completion) => completion.teamId === team.id);
    const completedTaskIds = [...new Set(teamCompletions.map((completion) => completion.taskId))];
    const lineTaskIds = new Set([...completedTaskIds, ...freeTaskIds]);
    return {
      ...team,
      score: teamCompletions.reduce((sum, completion) => sum + completion.points, 0),
      completedCount: completedTaskIds.length,
      lineCount: countCompletedLines(tasks, lineTaskIds, gridSize),
      completedTaskIds,
    };
  }).sort((left, right) => rankingMode === 'lines'
    ? right.lineCount - left.lineCount || right.completedCount - left.completedCount || right.score - left.score || left.sourceTeamIndex - right.sourceTeamIndex
    : right.score - left.score || right.lineCount - left.lineCount || right.completedCount - left.completedCount || left.sourceTeamIndex - right.sourceTeamIndex);
}

export function countCompletedLines(tasks: BingoScoreTask[], completedTaskIds: Set<string>, gridSize: number) {
  if (gridSize < 2 || tasks.length < gridSize * gridSize) return 0;
  const ordered = [...tasks].sort((left, right) => left.sortOrder - right.sortOrder).slice(0, gridSize * gridSize);
  const lines: string[][] = [];
  for (let row = 0; row < gridSize; row += 1) lines.push(ordered.slice(row * gridSize, row * gridSize + gridSize).map((task) => task.id));
  for (let column = 0; column < gridSize; column += 1) lines.push(Array.from({ length: gridSize }, (_, row) => ordered[row * gridSize + column].id));
  lines.push(Array.from({ length: gridSize }, (_, index) => ordered[index * gridSize + index].id));
  lines.push(Array.from({ length: gridSize }, (_, index) => ordered[index * gridSize + (gridSize - index - 1)].id));
  return lines.filter((line) => line.every((taskId) => completedTaskIds.has(taskId))).length;
}

export function claimAvailability(input: {
  mode: string;
  repeatable: boolean;
  maxCompletions: number;
  taskId: string;
  teamId: string;
  completions: BingoScoreCompletion[];
  hasPendingClaim: boolean;
}) {
  if (input.hasPendingClaim) return { allowed: false, reason: 'Your team already has this tile under review.' };
  const global = input.completions.filter((completion) => completion.taskId === input.taskId);
  if (input.mode === 'lockout' && global.length) return { allowed: false, reason: 'Another team already owns this lockout tile.' };
  const team = global.filter((completion) => completion.teamId === input.teamId);
  if (!input.repeatable && team.length) return { allowed: false, reason: 'Your team already completed this tile.' };
  if (input.repeatable && team.length >= input.maxCompletions) return { allowed: false, reason: 'Your team reached this task’s completion limit.' };
  return { allowed: true, reason: null };
}
