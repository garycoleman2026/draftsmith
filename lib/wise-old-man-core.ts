import { normalizeRsn } from './validation';

export type WiseOldManSnapshot = {
  schemaVersion: 1;
  playerId: number | null;
  displayName: string;
  normalizedName: string;
  providerUpdatedAt: string | null;
  snapshotAt: string;
  skills: Record<string, { experience: number; level: number }>;
  bosses: Record<string, number>;
};

export function parseWiseOldManPlayer(value: unknown, fallbackName = ''): WiseOldManSnapshot {
  const player = record(value) ?? {};
  const snapshot = record(player.latestSnapshot) ?? record(player.data);
  return parseSnapshot(player, snapshot, fallbackName);
}

export function parseWiseOldManGroup(value: unknown): WiseOldManSnapshot[] {
  if (!Array.isArray(value)) throw new Error('Wise Old Man group hiscores returned an invalid payload.');
  return value.flatMap((entry) => {
    const row = record(entry) ?? {};
    const player = record(row.player) ?? {};
    const snapshot = record(row.data);
    try { return [parseSnapshot(player, snapshot, stringValue(player.displayName) || stringValue(player.username))]; }
    catch { return []; }
  });
}

function parseSnapshot(player: Record<string, unknown>, snapshot: Record<string, unknown> | null, fallbackName: string) {
  if (!snapshot) throw new Error('Wise Old Man has no snapshot for this player yet.');
  const data = record(snapshot.data) ?? {};
  const displayName = stringValue(player.displayName) || stringValue(player.username) || fallbackName.trim();
  if (!displayName) throw new Error('Wise Old Man did not return a player name.');
  const snapshotAt = isoDate(snapshot.createdAt) ?? isoDate(player.updatedAt);
  if (!snapshotAt) throw new Error('Wise Old Man did not return a valid snapshot time.');
  const skills = Object.fromEntries(Object.entries(record(data.skills) ?? {}).flatMap(([key, raw]) => {
    const stat = record(raw) ?? {};
    const experience = nonnegative(stat.experience);
    const level = nonnegative(stat.level);
    return experience === null || level === null ? [] : [[metricKey(key), { experience, level }]];
  }).filter(([key]) => Boolean(key)));
  const bosses = Object.fromEntries(Object.entries(record(data.bosses) ?? {}).flatMap(([key, raw]) => {
    const kills = nonnegative(record(raw)?.kills);
    const metric = metricKey(key);
    return kills === null || !metric ? [] : [[metric, kills]];
  }));
  if (!Object.keys(skills).length) throw new Error('Wise Old Man snapshot has no skill data.');
  return {
    schemaVersion: 1 as const,
    playerId: integerOrNull(player.id) ?? integerOrNull(snapshot.playerId),
    displayName,
    normalizedName: normalizeRsn(displayName),
    providerUpdatedAt: isoDate(player.updatedAt),
    snapshotAt,
    skills,
    bosses,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function stringValue(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function nonnegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function integerOrNull(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function isoDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function metricKey(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); }
