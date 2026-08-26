import { ensureSchema, json } from '../../../lib/db';
import { getPlayerInsight, PlayerInsightError } from '../../../lib/player-insights';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../lib/rate-limit';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    await enforceRateLimit({ request, scope: 'player-insight', limit: 40, windowSeconds: 60 });
    const url = new URL(request.url);
    const name = url.searchParams.get('name') ?? '';
    return json(await getPlayerInsight(name, { force: url.searchParams.get('refresh') === '1' }));
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof PlayerInsightError) return json({ error: error.message }, { status: error.status });
    console.error('load player insight failed', error);
    return json({ error: 'Player intelligence is unavailable.' }, { status: 500 });
  }
}
