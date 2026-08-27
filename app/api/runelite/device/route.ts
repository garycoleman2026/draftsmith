import { bingoErrorResponse } from '@/lib/bingo';
import { requireRuneliteDevice, revokeRuneliteDevice } from '@/lib/bingo-runelite';
import { ensureSchema, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const device = await requireRuneliteDevice(request);
    await enforceRateLimit({ request, scope: 'runelite-device', limit: 10, windowSeconds: 3600, subject: device.id });
    return json(await revokeRuneliteDevice({ deviceId: device.id, eventId: device.eventId, actor: 'device' }));
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('RuneLite device disconnect failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
