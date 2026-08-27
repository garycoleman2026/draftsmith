import { recordAudit, requestId } from '@/lib/audit';
import { bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import {
  dryRunVerificationSignal, ingestVerificationSignal, replayVerificationEvents,
} from '@/lib/bingo-verification';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    await enforceRateLimit({ request, scope: 'bingo-verification', limit: 120, windowSeconds: 600, subject: eventId });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action === 'replay') {
      const result = await replayVerificationEvents(eventId);
      await recordAudit(getDatabase(), {
        draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.verification_replayed',
        metadata: { eventId, ...result }, requestId: requestId(request), createdAt: new Date().toISOString(),
      }).catch(() => undefined);
      return json(result);
    }
    const teamId = typeof body.teamId === 'string' ? body.teamId : '';
    const memberId = typeof body.memberId === 'string' && body.memberId ? body.memberId : null;
    if (!teamId) return json({ error: 'Choose a team for the verification signal.' }, { status: 400 });
    if (body.action === 'dry_run') {
      return json(await dryRunVerificationSignal({ eventId, teamId, memberId, signal: body.signal }));
    }
    const result = await ingestVerificationSignal({ eventId, teamId, memberId, signal: body.signal });
    await recordAudit(getDatabase(), {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.verification_ingested',
      metadata: {
        eventId, teamId, memberId, duplicate: result.duplicate,
        candidateIds: result.candidates.map((candidate) => candidate.id),
      },
      requestId: requestId(request), createdAt: new Date().toISOString(),
    }).catch(() => undefined);
    return json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('bingo verification signal failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
