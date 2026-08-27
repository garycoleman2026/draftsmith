import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { resolveVerificationCandidate } from '@/lib/bingo-verification';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function POST(request: Request, context: { params: Promise<{ token: string; eventId: string; candidateId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId, candidateId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    const body = await request.json().catch(() => ({})) as { action?: unknown };
    if (!['accept', 'dismiss', 'reopen'].includes(String(body.action))) throw new BingoError('Choose accept, dismiss, or reopen.');
    const action = String(body.action) as 'accept' | 'dismiss' | 'reopen';
    const result = await resolveVerificationCandidate({ eventId, candidateId, action });
    await recordAudit(getDatabase(), {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.verification_' + action,
      metadata: { eventId, candidateId, taskId: result.taskId, teamId: result.teamId },
      requestId: requestId(request), createdAt: new Date().toISOString(),
    }).catch(() => undefined);
    return json(result);
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('resolve bingo verification candidate failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
