import { resolveCaptainId } from '../../../../../lib/access-tokens';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { autoPickCurrent, commitLivePick, LiveDraftError } from '../../../../../lib/live-service';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../../../lib/rate-limit';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    await enforceRateLimit({ request, scope: 'live-pick', limit: 30, windowSeconds: 60 });
    const { token } = await context.params;
    const captainId = await resolveCaptainId(token);
    if (!captainId) return json({ error: 'This captain link is not valid.' }, { status: 404 });
    const captain = await getDatabase().prepare('SELECT draft_id FROM captains WHERE id = ?')
      .bind(captainId).first<{ draft_id: string }>();
    if (!captain) return json({ error: 'This captain link is not valid.' }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { playerId?: unknown; action?: unknown };
    if (body.action === 'tick') {
      const outcome = await autoPickCurrent(captain.draft_id);
      return json({ advanced: Boolean(outcome), outcome });
    }
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    if (!playerId) return json({ error: 'Choose an available player.' }, { status: 400 });
    return json(await commitLivePick({ draftId: captain.draft_id, requestedByCaptainId: captainId, playerId }));
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof LiveDraftError) return json({ error: error.message }, { status: error.status });
    console.error('save live pick failed', error);
    return json({ error: 'That pick could not be saved. Refresh and try again.' }, { status: 500 });
  }
}
