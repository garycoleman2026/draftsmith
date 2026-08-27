import { bingoErrorResponse } from '@/lib/bingo';
import { buildRuneliteOverlay, requireRuneliteDevice } from '@/lib/bingo-runelite';
import { ensureSchema, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const device = await requireRuneliteDevice(request);
    await enforceRateLimit({ request, scope: 'runelite-overlay', limit: 150, windowSeconds: 600, subject: device.id });
    const etag = `W/\"rl-${device.eventId}-${device.teamId}-${device.revision}\"`;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'private, no-cache' } });
    }
    const response = json(await buildRuneliteOverlay(device, new URL(request.url).origin));
    response.headers.set('ETag', etag);
    response.headers.set('Cache-Control', 'private, no-cache');
    return response;
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('RuneLite overlay load failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
