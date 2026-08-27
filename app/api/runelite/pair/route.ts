import { BingoError, bingoErrorResponse } from '@/lib/bingo';
import { readBoundedJson } from '@/lib/bingo-runelite-core';
import { redeemRunelitePairing } from '@/lib/bingo-runelite';
import { ensureSchema, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    await enforceRateLimit({ request, scope: 'runelite-pair', limit: 30, windowSeconds: 3600 });
    let body: unknown;
    try { body = await readBoundedJson(request, 16_384); }
    catch (error) { throw new BingoError(error instanceof Error ? error.message : 'The pairing request is invalid.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BingoError('Provide pairing details.');
    const input = body as Record<string, unknown>;
    return json(await redeemRunelitePairing({
      code: input.code, rsn: input.rsn, deviceName: input.deviceName, pluginVersion: input.pluginVersion,
      scopes: input.scopes, consent: input.consent, disclosureVersion: input.disclosureVersion,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('RuneLite pairing failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
