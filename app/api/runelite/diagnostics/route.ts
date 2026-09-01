import { BingoError, bingoErrorResponse } from '@/lib/bingo';
import { readBoundedJson } from '@/lib/bingo-runelite-core';
import { requireRuneliteDevice, testRuneliteConnection } from '@/lib/bingo-runelite';
import { ensureSchema, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const device = await requireRuneliteDevice(request, { requireRsn: true });
    await enforceRateLimit({ request, scope: 'runelite-diagnostics', limit: 20, windowSeconds: 3_600, subject: device.id });
    let body: unknown;
    try { body = await readBoundedJson(request, 2_048); }
    catch (error) { throw new BingoError(error instanceof Error ? error.message : 'The connection test is invalid.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || (body as Record<string, unknown>).action !== 'test') {
      throw new BingoError('Choose the RuneLite connection test.');
    }
    return json(await testRuneliteConnection(device));
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('RuneLite connection test failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
