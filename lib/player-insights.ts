import { getDatabase } from './db';
import { cleanRsn, normalizeRsn, validateRsn } from './validation';

const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type PlayerInsight = {
  name: string;
  links: { officialHiscores: string; wiseOldMan: string };
  official: { rank: number | null; level: number | null; experience: number | null } | null;
  wiseOldMan: {
    displayName: string; accountType: string | null; combatLevel: number | null; totalLevel: number | null;
    experience: number | null; ehp: number | null; ehb: number | null; updatedAt: string | null;
    weeklyExperience: number | null; weeklyEhp: number | null; raidsScore: number | null;
    bossHighlights: { name: string; kills: number }[];
  } | null;
  cache: { state: 'fresh' | 'refreshed' | 'stale'; fetchedAt: string; expiresAt: string };
};

export async function getPlayerInsight(rawName: string, options: { force?: boolean } = {}) {
  const name = cleanRsn(rawName);
  const validationError = validateRsn(name);
  if (validationError) throw new PlayerInsightError(validationError, 400);
  const key = normalizeRsn(name);
  const db = getDatabase();
  const cached = await db.prepare(
    `SELECT display_name, payload_json, fetched_at, expires_at, stale_at, failure_count
     FROM player_insight_cache WHERE normalized_name = ?`,
  ).bind(key).first<{
    display_name: string; payload_json: string; fetched_at: string; expires_at: string; stale_at: string; failure_count: number;
  }>();
  const now = Date.now();
  if (!options.force && cached && Date.parse(cached.expires_at) > now) {
    return withCache(parsePayload(cached.payload_json), 'fresh', cached.fetched_at, cached.expires_at);
  }
  try {
    const payload = await fetchInsight(name);
    const fetchedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + FRESH_MS).toISOString();
    const staleAt = new Date(now + STALE_MS).toISOString();
    await db.prepare(
      `INSERT INTO player_insight_cache
        (normalized_name, display_name, payload_json, fetched_at, expires_at, stale_at, failure_count, last_error)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL)
       ON CONFLICT(normalized_name) DO UPDATE SET display_name = excluded.display_name,
         payload_json = excluded.payload_json, fetched_at = excluded.fetched_at,
         expires_at = excluded.expires_at, stale_at = excluded.stale_at,
         failure_count = 0, last_error = NULL`,
    ).bind(key, name, JSON.stringify(payload), fetchedAt, expiresAt, staleAt).run();
    return withCache(payload, 'refreshed', fetchedAt, expiresAt);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    if (cached) {
      await db.prepare('UPDATE player_insight_cache SET failure_count = failure_count + 1, last_error = ? WHERE normalized_name = ?')
        .bind(message, key).run();
      if (Date.parse(cached.stale_at) > now) {
        return withCache(parsePayload(cached.payload_json), 'stale', cached.fetched_at, cached.expires_at);
      }
    }
    throw new PlayerInsightError('Live OSRS data is temporarily unavailable.', 503);
  }
}

async function fetchInsight(name: string): Promise<Omit<PlayerInsight, 'cache'>> {
  const encoded = encodeURIComponent(name);
  const headers = { Accept: 'application/json', 'User-Agent': 'Terrys-Drafting/2.0' };
  const [detailsResult, gainsResult, hiscoresResult] = await Promise.allSettled([
    fetch(`https://api.wiseoldman.net/v2/players/${encoded}`, { headers }),
    fetch(`https://api.wiseoldman.net/v2/players/${encoded}/gained?period=week`, { headers }),
    fetch(`https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encoded}`, {
      headers: { Accept: 'text/plain', 'User-Agent': 'Terrys-Drafting/2.0' },
    }),
  ]);
  let details: Record<string, unknown> | null = null;
  if (detailsResult.status === 'fulfilled' && detailsResult.value.ok) details = await detailsResult.value.json() as Record<string, unknown>;
  let gains: Record<string, unknown> | null = null;
  if (gainsResult.status === 'fulfilled' && gainsResult.value.ok) gains = await gainsResult.value.json() as Record<string, unknown>;
  let official: PlayerInsight['official'] = null;
  if (hiscoresResult.status === 'fulfilled' && hiscoresResult.value.ok) {
    const [rank, level, experience] = (await hiscoresResult.value.text()).split(/\r?\n/, 1)[0].split(',').map(Number);
    official = { rank: validNonnegative(rank), level: validNonnegative(level), experience: validNonnegative(experience) };
  }
  if (!details && !official) throw new Error('Both OSRS upstreams failed.');
  const latest = asRecord(details?.latestSnapshot);
  const data = asRecord(latest?.data);
  const overall = asRecord(asRecord(data?.skills)?.overall);
  const gainsOverall = asRecord(asRecord(asRecord(gains?.data)?.skills)?.overall);
  const bossHighlights = Object.entries(asRecord(data?.bosses) ?? {}).flatMap(([boss, raw]) => {
    const kills = numberOrNull(asRecord(raw)?.kills);
    return kills && kills > 0 ? [{ name: humanize(boss), kills }] : [];
  }).sort((a, b) => b.kills - a.kills).slice(0, 8);
  const raidsScore = bossHighlights
    .filter((boss) => /chambers|theatre|tombs/i.test(boss.name))
    .reduce((sum, boss) => sum + boss.kills, 0);
  const wiseOldMan = details ? {
    displayName: typeof details.displayName === 'string' ? details.displayName : name,
    accountType: typeof details.type === 'string' ? details.type : null,
    combatLevel: numberOrNull(details.combatLevel), totalLevel: numberOrNull(overall?.level),
    experience: numberOrNull(details.exp) ?? numberOrNull(overall?.experience),
    ehp: numberOrNull(details.ehp), ehb: numberOrNull(details.ehb),
    updatedAt: typeof details.updatedAt === 'string' ? details.updatedAt : null,
    weeklyExperience: numberOrNull(asRecord(gainsOverall?.experience)?.gained),
    weeklyEhp: numberOrNull(asRecord(gainsOverall?.ehp)?.gained),
    raidsScore: raidsScore || null, bossHighlights,
  } : null;
  return {
    name,
    links: {
      officialHiscores: `https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=${encoded}`,
      wiseOldMan: `https://wiseoldman.net/players/${encoded}`,
    },
    official,
    wiseOldMan,
  };
}

export class PlayerInsightError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function withCache(payload: Omit<PlayerInsight, 'cache'>, state: PlayerInsight['cache']['state'], fetchedAt: string, expiresAt: string): PlayerInsight {
  return { ...payload, cache: { state, fetchedAt, expiresAt } };
}
function parsePayload(value: string) { return JSON.parse(value) as Omit<PlayerInsight, 'cache'>; }
function asRecord(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function numberOrNull(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function validNonnegative(value: number) { return Number.isFinite(value) && value >= 0 ? value : null; }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
