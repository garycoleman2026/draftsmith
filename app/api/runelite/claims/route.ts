import { BingoError, bingoErrorResponse } from '@/lib/bingo';
import { readBoundedJson } from '@/lib/bingo-runelite-core';
import { requireRuneliteDevice, submitRuneliteClaim } from '@/lib/bingo-runelite';
import { ensureSchema, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const device = await requireRuneliteDevice(request, { requireRsn: true });
    await enforceRateLimit({ request, scope: 'runelite-claims', limit: 20, windowSeconds: 600, subject: device.id });
    let body: unknown;
    try { body = await readBoundedJson(request, 8_192); }
    catch (error) { throw new BingoError(error instanceof Error ? error.message : 'The RuneLite claim is invalid.'); }
    return json(await submitRuneliteClaim(device, body), { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('RuneLite claim failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
