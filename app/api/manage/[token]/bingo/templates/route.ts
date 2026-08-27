import { resolveManagerDraftId } from '@/lib/access-tokens';
import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, parseJson } from '@/lib/bingo';
import { BUILTIN_BINGO_TEMPLATES, type BingoTaskDefinition } from '@/lib/bingo-types';
import { getSessionUser } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) throw new BingoError('This organizer link is not valid.', 404);
    const draft = await getDatabase().prepare('SELECT clan_id FROM drafts WHERE id = ?').bind(draftId).first<{ clan_id: string | null }>();
    const custom = await getDatabase().prepare(
      `SELECT id, name, mode, board_scope, configuration_json, created_at, updated_at
       FROM bingo_templates WHERE owner_draft_id = ? OR (clan_id IS NOT NULL AND clan_id = ?)
       ORDER BY updated_at DESC LIMIT 50`,
    ).bind(draftId, draft?.clan_id ?? null).all<Record<string, string | null>>();
    return json({
      builtin: BUILTIN_BINGO_TEMPLATES.map((template) => ({
        key: template.key, name: template.name, description: template.description,
        mode: template.mode, boardScope: template.boardScope,
      })),
      custom: custom.results.map((template) => ({
        id: template.id, name: template.name, mode: template.mode, boardScope: template.board_scope,
        description: parseJson<{ description?: string }>(template.configuration_json, {}).description ?? 'Saved custom board',
        updatedAt: template.updated_at,
      })),
    });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('list bingo templates failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) throw new BingoError('This organizer link is not valid.', 404);
    const body = await request.json().catch(() => ({})) as { eventId?: unknown; name?: unknown };
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 70) : '';
    if (!name) throw new BingoError('Give the reusable board a name.');
    const db = getDatabase();
    const [event, draft, taskRows, sessionUser] = await Promise.all([
      db.prepare(`SELECT id, mode, board_scope, grid_size, win_condition, target_value, rules_json
                  FROM bingo_events WHERE id = ? AND draft_id = ?`).bind(eventId, draftId)
        .first<{ id: string; mode: string; board_scope: string; grid_size: number; win_condition: string; target_value: number; rules_json: string | null }>(),
      db.prepare('SELECT clan_id FROM drafts WHERE id = ?').bind(draftId).first<{ clan_id: string | null }>(),
      db.prepare(`SELECT title, description, points, category, difficulty, verification_mode, repeatable,
                         max_completions, hidden, free_space, icon_key
                  FROM bingo_tasks WHERE event_id = ? ORDER BY sort_order`).bind(eventId).all<Record<string, string | number>>(),
      getSessionUser(request),
    ]);
    if (!event) throw new BingoError('That bingo event is not part of this organizer board.', 404);
    if (taskRows.results.length !== event.grid_size * event.grid_size) throw new BingoError('Complete the task board before saving it as a template.', 409);
    const tasks: BingoTaskDefinition[] = taskRows.results.map((task) => ({
      title: String(task.title), description: String(task.description), points: Number(task.points), category: String(task.category),
      difficulty: String(task.difficulty) as BingoTaskDefinition['difficulty'],
      verificationMode: String(task.verification_mode) as BingoTaskDefinition['verificationMode'],
      repeatable: Boolean(task.repeatable), maxCompletions: Number(task.max_completions), hidden: Boolean(task.hidden),
      freeSpace: Boolean(task.free_space), iconKey: String(task.icon_key),
    }));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const configuration = {
      key: id, name, description: `Saved from ${name}`, mode: event.mode, boardScope: event.board_scope,
      gridSize: event.grid_size, winCondition: event.win_condition, targetValue: event.target_value, tasks,
    };
    await db.prepare(
      `INSERT INTO bingo_templates
        (id, owner_draft_id, clan_id, owner_user_id, name, mode, board_scope, configuration_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, draftId, draft?.clan_id ?? null, sessionUser?.id ?? null, name, event.mode, event.board_scope,
      JSON.stringify(configuration), now, now).run();
    await recordAudit(db, {
      draftId, clanId: draft?.clan_id ?? null, actorUserId: sessionUser?.id ?? null, actorType: 'organizer',
      eventType: 'bingo.template_saved', metadata: { eventId, templateId: id }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json({ id, name }, { status: 201 });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('save bingo template failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
