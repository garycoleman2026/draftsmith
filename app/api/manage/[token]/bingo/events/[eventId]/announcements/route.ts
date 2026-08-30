import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoActivityInsert, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { scheduleDiscordEvent } from '@/lib/discord-webhooks';

export async function POST(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId, ['owner', 'organizer']);
    const body = await request.json().catch(() => ({})) as { message?: unknown };
    const message = typeof body.message === 'string' ? body.message.trim().replace(/\s+/g, ' ').slice(0, 500) : '';
    if (!message) throw new BingoError('Write an announcement first.');
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.batch([
      bingoActivityInsert({ eventId, type: 'event.announcement', message, metadata: { announcement: true }, now }),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
    ]);
    scheduleDiscordEvent(event.draft_id, 'bingo.announcement', {
      username: "Terry's Drafting", embeds: [{ title: event.title, description: message, color: 0xd0a23d }],
    });
    await recordAudit(db, { draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.announcement', metadata: { eventId, message }, requestId: requestId(request), createdAt: now }).catch(() => undefined);
    return json({ posted: true, createdAt: now });
  } catch (error) {
    const result = bingoErrorResponse(error);
    return json({ error: result.message }, { status: result.status });
  }
}
