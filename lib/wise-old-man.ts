import { parseWiseOldManGroup, parseWiseOldManPlayer, type WiseOldManSnapshot } from './wise-old-man-core';

const API_ROOT = 'https://api.wiseoldman.net/v2';
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

export async function fetchWiseOldManPlayer(name: string): Promise<WiseOldManSnapshot> {
  const payload = await fetchJson(`${API_ROOT}/players/${encodeURIComponent(name)}`);
  return parseWiseOldManPlayer(payload, name);
}

export async function fetchWiseOldManGroup(groupId: number): Promise<WiseOldManSnapshot[]> {
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new WiseOldManError('Enter a valid Wise Old Man group ID.', 400);
  const payload = await fetchJson(`${API_ROOT}/groups/${groupId}/bulk-hiscores`);
  return parseWiseOldManGroup(payload);
}

async function fetchJson(url: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Terrys-Drafting/3.0' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new WiseOldManError('Wise Old Man did not respond in time.', 503);
  }
  if (response.status === 404) throw new WiseOldManError('Wise Old Man could not find that player or group.', 404);
  if (response.status === 429) throw new WiseOldManError('Wise Old Man is rate limiting requests. Wait a minute and continue the sync.', 429);
  if (!response.ok) throw new WiseOldManError(`Wise Old Man returned HTTP ${response.status}.`, 502);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new WiseOldManError('Wise Old Man returned more data than this sync can safely process.', 502);
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new WiseOldManError('Wise Old Man returned more data than this sync can safely process.', 502);
  try { return JSON.parse(text) as unknown; }
  catch { throw new WiseOldManError('Wise Old Man returned invalid JSON.', 502); }
}

export class WiseOldManError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
