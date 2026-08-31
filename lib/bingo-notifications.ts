export function collectNewBingoCompletions<T extends { id: string }>(completions: T[], seenIds: Set<string>) {
  const newlyCompleted = completions.filter((completion) => !seenIds.has(completion.id));
  for (const completion of newlyCompleted) seenIds.add(completion.id);
  return newlyCompleted;
}
