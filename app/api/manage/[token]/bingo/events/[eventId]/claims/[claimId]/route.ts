import { requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { reviewBingoClaim } from '@/lib/bingo-claims';
import { ensureSchema, json } from '@/lib/db';

export async function POST(request: Request, context: { params: Promise<{ token: string; eventId: string; claimId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId, claimId } = await context.params;
    await requireManagedBingoEvent(token, eventId);
    const body = await request.json().catch(() => ({})) as { action?: unknown; reviewNote?: unknown };
    if (body.action !== 'approve' && body.action !== 'reject') throw new BingoError('Choose approve or reject.');
    const result = await reviewBingoClaim({
      claimId, eventId, action: body.action,
      reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : '', actorType: 'organizer',
    });
    return json({ ...result, requestId: requestId(request) });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('review bingo claim failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
