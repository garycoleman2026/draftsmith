import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, loadBingoView, requireManagedBingoEvent } from '@/lib/bingo';
import { sanitizeBingoTasks } from '@/lib/bingo-types';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function PUT(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId);
    if (!['draft', 'scheduled'].includes(event.status)) throw new BingoError('The task board is locked once the event starts.', 409);
    const existingClaim = await getDatabase().prepare('SELECT id FROM bingo_claims WHERE event_id = ? LIMIT 1').bind(eventId).first();
    if (existingClaim) throw new BingoError('The task board cannot be replaced after claims have been submitted.', 409);
    const body = await request.json().catch(() => ({})) as { tasks?: unknown };
    const expected = event.grid_size * event.grid_size;
    const tasks = sanitizeBingoTasks(body.tasks, expected);
    if (tasks.length !== expected) throw new BingoError(`Paste exactly ${expected} valid task rows.`);
    const now = new Date().toISOString();
    const db = getDatabase();
    await db.batch([
      db.prepare('DELETE FROM bingo_tasks WHERE event_id = ?').bind(eventId),
      ...tasks.map((task, sortOrder) => db.prepare(
        `INSERT INTO bingo_tasks
          (id, event_id, title, description, points, category, difficulty, verification_mode, repeatable,
           max_completions, hidden, free_space, icon_key, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), eventId, task.title, task.description, task.points, task.category, task.difficulty,
        task.verificationMode, task.repeatable ? 1 : 0, task.maxCompletions, task.hidden ? 1 : 0,
        task.freeSpace ? 1 : 0, task.iconKey, sortOrder, now, now)),
      db.prepare('UPDATE bingo_events SET revision = revision + 1, updated_at = ? WHERE id = ?').bind(now, eventId),
    ]);
    await recordAudit(db, {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.tasks_replaced',
      metadata: { eventId, taskCount: tasks.length }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json(await loadBingoView({ eventId, viewer: 'organizer' }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('replace bingo tasks failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
