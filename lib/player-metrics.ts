export type MetricAnswer = { player_id: string; balance_metric: string | null; value: string };

export function buildPlayerMetrics(
  playerIds: string[],
  answers: MetricAnswer[],
  insightPayloadByPlayer: Map<string, unknown>,
) {
  const metrics = new Map(playerIds.map((id) => [id, {} as Record<string, number>]));
  for (const answer of answers) {
    if (!answer.balance_metric) continue;
    const value = parseMetricValue(answer.value);
    if (value === null) continue;
    metrics.get(answer.player_id)![answer.balance_metric] = value;
  }
  for (const playerId of playerIds) {
    const insight = asRecord(insightPayloadByPlayer.get(playerId));
    const official = asRecord(insight?.official);
    const wom = asRecord(insight?.wiseOldMan);
    const current = metrics.get(playerId)!;
    assignIfMissing(current, 'skilling', scaled(numberOrNull(official?.level) ?? numberOrNull(wom?.totalLevel), 500, 2376));
    assignIfMissing(current, 'playtime', logarithmic(numberOrNull(wom?.experience) ?? numberOrNull(official?.experience), 1_000_000, 4_800_000_000));
    assignIfMissing(current, 'pvm', logarithmic(numberOrNull(wom?.ehb), 1, 8_000));
    assignIfMissing(current, 'raids', scaled(numberOrNull(wom?.raidsScore), 0, 10_000));
  }
  return metrics;
}

export function parseMetricValue(value: string) {
  const numeric = Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]);
  if (Number.isFinite(numeric)) return numeric;
  const normalized = value.trim().toLocaleLowerCase();
  const labels: Record<string, number> = {
    beginner: 2, casual: 3, intermediate: 5, experienced: 7, advanced: 8, expert: 10,
    low: 2, medium: 5, high: 8, yes: 8, no: 2,
  };
  return labels[normalized] ?? null;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scaled(value: number | null, minimum: number, maximum: number) {
  if (value === null) return null;
  return Math.max(1, Math.min(10, 1 + ((value - minimum) / Math.max(1, maximum - minimum)) * 9));
}

function logarithmic(value: number | null, minimum: number, maximum: number) {
  if (value === null || value <= 0) return null;
  return scaled(Math.log10(value), Math.log10(minimum), Math.log10(maximum));
}

function assignIfMissing(metrics: Record<string, number>, key: string, value: number | null) {
  if (metrics[key] === undefined && value !== null) metrics[key] = value;
}
