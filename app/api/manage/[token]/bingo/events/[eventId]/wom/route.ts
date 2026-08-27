import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { configureWiseOldMan, continueWiseOldManSync, startWiseOldManSync } from '@/lib/bingo-wom';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    await enforceRateLimit({ request, scope: 'bingo-wom-sync', limit: 240, windowSeconds: 3600, subject: eventId });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action === 'configure') {
      const rawGroupId = body.groupId;
      const groupId = rawGroupId === null || rawGroupId === '' || rawGroupId === undefined ? null : Number(rawGroupId);
      const result = await configureWiseOldMan({
        eventId, groupId, syncIntervalHours: Number(body.syncIntervalHours), autoSync: body.autoSync === true,
      });
      await audit(event.draft_id, request, 'bingo.wom_configured', {
        eventId, groupId, syncIntervalHours: result.syncIntervalHours, autoSync: result.autoSync,
      });
      return json(result);
    }
    if (body.action === 'start') {
      const phase = ['baseline', 'checkpoint', 'final'].includes(String(body.phase))
        ? String(body.phase) as 'baseline' | 'checkpoint' | 'final' : null;
      if (!phase) throw new BingoError('Choose a baseline, checkpoint, or final sync.');
      const result = await startWiseOldManSync({ eventId, phase });
      await audit(event.draft_id, request, 'bingo.wom_sync_started', { eventId, phase, runId: result.run.id });
      return json(result, { status: result.resumed ? 200 : 201 });
    }
    if (body.action === 'continue') {
      const runId = typeof body.runId === 'string' ? body.runId : '';
      if (!runId) throw new BingoError('Choose a Wise Old Man sync to continue.');
      return json(await continueWiseOldManSync({ eventId, runId }));
    }
    throw new BingoError('Choose configure, start, or continue.');
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('Wise Old Man bingo sync failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

async function audit(draftId: string, request: Request, eventType: string, metadata: Record<string, unknown>) {
  await recordAudit(getDatabase(), {
    draftId, actorType: 'organizer', eventType, metadata,
    requestId: requestId(request), createdAt: new Date().toISOString(),
  }).catch(() => undefined);
}
