export const MAX_ROSTER_SIZE = 120;
export const MIN_TEAM_COUNT = 2;
export const MAX_TEAM_COUNT = 8;

export function cleanRsn(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeRsn(value: string) {
  return cleanRsn(value).toLocaleLowerCase('en-US');
}

export function validateRsn(value: string) {
  const name = cleanRsn(value);
  if (!name || name.length > 12 || !/^[A-Za-z0-9 _-]+$/.test(name)) {
    return 'Use a valid in-game name with up to 12 letters, numbers, spaces, - or _.';
  }
  return null;
}

export function parseRsnList(values: unknown[]) {
  const unique = new Map<string, string>();
  const invalid: string[] = [];
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const name = cleanRsn(raw);
    if (!name) continue;
    if (validateRsn(name)) {
      invalid.push(name);
      continue;
    }
    unique.set(normalizeRsn(name), name);
  }
  return { names: [...unique.values()], invalid };
}

export function isExpired(value: string | null | undefined, now = Date.now()) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now;
}

export function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

export function hasBotTrap(body: Record<string, unknown>) {
  return typeof body.website === 'string' && body.website.trim().length > 0;
}
