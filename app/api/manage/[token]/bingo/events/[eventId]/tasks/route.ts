import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, loadBingoView, requireManagedBingoEvent } from '@/lib/bingo';
import { sanitizeBingoTasks } from '@/lib/bingo-types';
import { sanitizeBingoEventRules, validateBingoBoard } from '@/lib/bingo-rules';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function PUT(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    const event = await requireManagedBingoEvent(token, eventId, ['owner', 'organizer']);
    if (!['draft', 'scheduled'].includes(event.status)) throw new BingoError('The task board is locked once the event starts.', 409);
    const existingClaim = await getDatabase().prepare('SELECT id FROM bingo_claims WHERE event_id = ? LIMIT 1').bind(eventId).first();
    if (existingClaim) throw new BingoError('The task board cannot be replaced after claims have been submitted.', 409);
    const body = await request.json().catch(() => ({})) as { tasks?: unknown; gridSize?: unknown; rules?: unknown };
    const requestedSize = clampInteger(body.gridSize, 3, 7, event.grid_size);
    const rules = sanitizeBingoEventRules(body.rules, requestedSize,
      ['lines', 'points', 'blackout', 'categories'].includes(event.win_condition)
        ? event.win_condition as 'lines' | 'points' | 'blackout' | 'categories' : 'points');
    if (rules.layout.rows !== rules.layout.columns) throw new BingoError('The first custom-maker release supports square boards only.');
    const expected = rules.layout.rows * rules.layout.columns;
    const tasks = sanitizeBingoTasks(body.tasks, expected);
    if (tasks.length !== expected) throw new BingoError(`Paste exactly ${expected} valid task rows.`);
    const validation = validateBingoBoard(tasks, rules);
    if (!validation.valid) throw new BingoError(validation.errors[0] ?? 'The board rules are not valid.');
    const now = new Date().toISOString();
    const db = getDatabase();
    await db.batch([
      db.prepare('DELETE FROM bingo_tasks WHERE event_id = ?').bind(eventId),
      ...tasks.map((task, sortOrder) => db.prepare(
        `INSERT INTO bingo_tasks
          (id, event_id, title, description, points, category, difficulty, verification_mode, repeatable,
           max_completions, hidden, free_space, icon_key, rule_json, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), eventId, task.title, task.description, task.points, task.category, task.difficulty,
        task.verificationMode, task.repeatable ? 1 : 0, task.maxCompletions, task.hidden ? 1 : 0,
        task.freeSpace ? 1 : 0, task.iconKey, JSON.stringify(task.rule), sortOrder, now, now)),
      db.prepare(`UPDATE bingo_events SET grid_size = ?, win_condition = ?, target_value = ?, rules_json = ?,
          revision = revision + 1, updated_at = ? WHERE id = ?`)
        .bind(rules.layout.rows, rules.scoring.winCondition, rules.scoring.targetValue, JSON.stringify(rules), now, eventId),
    ]);
    await recordAudit(db, {
      draftId: event.draft_id, actorType: 'organizer', eventType: 'bingo.tasks_replaced',
      metadata: { eventId, taskCount: tasks.length, gridSize: rules.layout.rows, schemaVersion: rules.schemaVersion }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json(await loadBingoView({ eventId, viewer: 'organizer' }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('replace bingo tasks failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}
