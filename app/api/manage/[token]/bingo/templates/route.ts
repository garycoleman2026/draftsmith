import { resolveManagerDraftId } from '@/lib/access-tokens';
import { recordAudit, requestId } from '@/lib/audit';
import { BingoError, bingoErrorResponse, parseJson } from '@/lib/bingo';
import { BUILTIN_BINGO_TEMPLATES, type BingoTaskDefinition } from '@/lib/bingo-types';
import {
  sanitizeTemplateCategory, sanitizeTemplateSummary, sanitizeTemplateTags, sanitizeTemplateVisibility,
  uniquePublicTemplateSlug,
} from '@/lib/bingo-gallery';
import { sanitizeBingoEventRules, sanitizeBingoTaskRule } from '@/lib/bingo-rules';
import { getSessionUser, requireClanRole } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

type Context = { params: Promise<{ token: string }> };
type CustomTemplateRow = {
  id: string; owner_draft_id: string | null; clan_id: string | null; name: string; mode: string; board_scope: string;
  configuration_json: string; public_slug: string | null; visibility: string; category: string;
  clone_count: number; rating_count: number; rating_total: number; created_at: string; updated_at: string;
};

export async function GET(_request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) throw new BingoError('This organizer link is not valid.', 404);
    const draft = await getDatabase().prepare('SELECT clan_id FROM drafts WHERE id = ?').bind(draftId).first<{ clan_id: string | null }>();
    const custom = await getDatabase().prepare(
      `SELECT id, owner_draft_id, clan_id, name, mode, board_scope, configuration_json, public_slug, visibility, category,
              clone_count, rating_count, rating_total, created_at, updated_at
       FROM bingo_templates
       WHERE owner_draft_id = ? OR (clan_id IS NOT NULL AND clan_id = ?) OR visibility = 'public'
       ORDER BY CASE WHEN owner_draft_id = ? THEN 0 WHEN clan_id IS NOT NULL AND clan_id = ? THEN 1 ELSE 2 END,
                updated_at DESC LIMIT 100`,
    ).bind(draftId, draft?.clan_id ?? null, draftId, draft?.clan_id ?? null).all<CustomTemplateRow>();
    return json({
      builtin: BUILTIN_BINGO_TEMPLATES.map((template) => ({
        key: template.key, name: template.name, description: template.description,
        mode: template.mode, boardScope: template.boardScope, gridSize: template.gridSize,
      })),
      custom: custom.results.map((template) => ({
        id: template.id, name: template.name, mode: template.mode, boardScope: template.board_scope,
        description: parseJson<{ description?: string }>(template.configuration_json, {}).description ?? 'Saved custom board',
        gridSize: parseJson<{ gridSize?: number }>(template.configuration_json, {}).gridSize ?? 5,
        visibility: template.visibility,
        category: template.category,
        publicPath: template.public_slug ? `/templates/${template.public_slug}` : null,
        source: template.owner_draft_id === draftId
          ? 'saved'
          : draft?.clan_id && template.clan_id === draft.clan_id ? 'clan' : 'community',
        cloneCount: Number(template.clone_count) || 0,
        ratingAverage: Number(template.rating_count) > 0 ? Number(template.rating_total) / Number(template.rating_count) : null,
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
    const body = await request.json().catch(() => ({})) as {
      eventId?: unknown; name?: unknown; summary?: unknown; category?: unknown; tags?: unknown; visibility?: unknown;
    };
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 70) : '';
    if (!name) throw new BingoError('Give the reusable board a name.');
    const visibility = sanitizeTemplateVisibility(body.visibility);
    const category = sanitizeTemplateCategory(body.category);
    const tags = sanitizeTemplateTags(body.tags);
    const db = getDatabase();
    const [event, draft, taskRows, sessionUser] = await Promise.all([
      db.prepare(`SELECT id, mode, board_scope, grid_size, win_condition, target_value, rules_json
                  FROM bingo_events WHERE id = ? AND draft_id = ?`).bind(eventId, draftId)
        .first<{ id: string; mode: string; board_scope: string; grid_size: number; win_condition: string; target_value: number; rules_json: string | null }>(),
      db.prepare('SELECT clan_id FROM drafts WHERE id = ?').bind(draftId).first<{ clan_id: string | null }>(),
      db.prepare(`SELECT title, description, points, category, difficulty, verification_mode, repeatable,
                         max_completions, hidden, free_space, icon_key, rule_json
                  FROM bingo_tasks WHERE event_id = ? ORDER BY sort_order`).bind(eventId).all<Record<string, string | number>>(),
      getSessionUser(request),
    ]);
    if (!event) throw new BingoError('That bingo event is not part of this organizer board.', 404);
    if (taskRows.results.length !== event.grid_size * event.grid_size) throw new BingoError('Complete the task board before saving it as a template.', 409);
    await enforceRateLimit({ request, scope: 'save-bingo-template', limit: 30, windowSeconds: 86_400, subject: draftId });
    let publishingUserId = sessionUser?.id ?? null;
    if (visibility === 'public') {
      await enforceRateLimit({ request, scope: 'publish-community-template', limit: 3, windowSeconds: 86_400 });
      publishingUserId = sessionUser?.id ?? null;
    }
    const tasks: BingoTaskDefinition[] = taskRows.results.map((task) => ({
      title: String(task.title), description: String(task.description), points: Number(task.points), category: String(task.category),
      difficulty: String(task.difficulty) as BingoTaskDefinition['difficulty'],
      verificationMode: String(task.verification_mode) as BingoTaskDefinition['verificationMode'],
      repeatable: Boolean(task.repeatable), maxCompletions: Number(task.max_completions), hidden: Boolean(task.hidden),
      freeSpace: Boolean(task.free_space), iconKey: String(task.icon_key),
      rule: sanitizeBingoTaskRule(parseJson(String(task.rule_json ?? '{}'), {}), String(task.verification_mode) as BingoTaskDefinition['verificationMode']),
    }));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const summary = sanitizeTemplateSummary(body.summary, `A ${event.grid_size} × ${event.grid_size} ${event.mode} board shared by an OSRS clan organizer.`);
    const publicSlug = visibility === 'public' ? await uniquePublicTemplateSlug(name) : null;
    const rules = sanitizeBingoEventRules(parseJson(event.rules_json, {}), event.grid_size,
      ['lines', 'points', 'blackout', 'categories'].includes(event.win_condition)
        ? event.win_condition as 'lines' | 'points' | 'blackout' | 'categories' : 'points');
    const configuration = {
      schemaVersion: 1,
      key: id, name, description: summary, mode: event.mode, boardScope: event.board_scope,
      gridSize: event.grid_size, winCondition: event.win_condition, targetValue: event.target_value, rules, tasks,
    };
    await db.prepare(
      `INSERT INTO bingo_templates
        (id, owner_draft_id, clan_id, owner_user_id, name, mode, board_scope, configuration_json,
         public_slug, visibility, summary, category, tags_json, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, draftId, draft?.clan_id ?? null, publishingUserId, name, event.mode, event.board_scope,
      JSON.stringify(configuration), publicSlug, visibility, summary, category, JSON.stringify(tags),
      visibility === 'public' ? now : null, now, now).run();
    await recordAudit(db, {
      draftId, clanId: draft?.clan_id ?? null, actorUserId: sessionUser?.id ?? null, actorType: 'organizer',
      eventType: 'bingo.template_saved', metadata: { eventId, templateId: id, visibility, category }, requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json({ id, name, visibility, publicPath: publicSlug ? `/templates/${publicSlug}` : null }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('save bingo template failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) throw new BingoError('This organizer link is not valid.', 404);
    const body = await request.json().catch(() => ({})) as { templateId?: unknown };
    const templateId = typeof body.templateId === 'string' ? body.templateId : '';
    if (!templateId) throw new BingoError('Choose a saved template to remove.');
    const db = getDatabase();
    const draft = await db.prepare('SELECT clan_id FROM drafts WHERE id = ?').bind(draftId).first<{ clan_id: string | null }>();
    const template = await db.prepare(
      `SELECT id, owner_draft_id, clan_id, name, visibility FROM bingo_templates
       WHERE id = ? AND (owner_draft_id = ? OR (clan_id IS NOT NULL AND clan_id = ?))`,
    ).bind(templateId, draftId, draft?.clan_id ?? null).first<{
      id: string; owner_draft_id: string | null; clan_id: string | null; name: string; visibility: string;
    }>();
    if (!template) throw new BingoError('That saved template is not managed by this organizer room.', 404);
    if (template.owner_draft_id !== draftId) {
      if (!template.clan_id) throw new BingoError('That saved template is not managed by this organizer room.', 404);
      await requireClanRole(request, template.clan_id, ['owner', 'admin']);
    }
    await enforceRateLimit({ request, scope: 'delete-bingo-template', limit: 30, windowSeconds: 3_600, subject: draftId });
    await db.prepare('DELETE FROM bingo_templates WHERE id = ?').bind(template.id).run();
    await recordAudit(db, {
      draftId, clanId: draft?.clan_id ?? null, actorType: 'organizer', eventType: 'bingo.template_removed',
      metadata: { templateId: template.id, name: template.name, visibility: template.visibility },
      requestId: requestId(request), createdAt: new Date().toISOString(),
    }).catch(() => undefined);
    return json({ removed: true });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('remove bingo template failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
