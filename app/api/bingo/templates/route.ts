import { recordAudit, requestId } from '@/lib/audit';
import { requireSessionUser } from '@/lib/auth';
import {
  sanitizeTemplateCategory,
  sanitizeTemplateSummary,
  sanitizeTemplateTags,
  sanitizeTemplateVisibility,
  uniquePublicTemplateSlug,
} from '@/lib/bingo-gallery';
import { validateBingoBoard } from '@/lib/bingo-rules';
import { getBuiltinBingoTemplate, sanitizeBingoTemplate } from '@/lib/bingo-types';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

type SavedTemplateRow = {
  id: string; name: string; summary: string; category: string; tags_json: string; mode: string;
  board_scope: string; configuration_json: string; public_slug: string | null; visibility: string;
  clone_count: number; rating_count: number; rating_total: number; created_at: string; updated_at: string;
};

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const rows = await getDatabase().prepare(
      `SELECT id, name, summary, category, tags_json, mode, board_scope, configuration_json,
              public_slug, visibility, clone_count, rating_count, rating_total, created_at, updated_at
       FROM bingo_templates
       WHERE owner_user_id = ? AND owner_draft_id IS NULL
       ORDER BY updated_at DESC LIMIT 100`,
    ).bind(user.id).all<SavedTemplateRow>();
    return json({ templates: rows.results.flatMap(templateResponse) });
  } catch (error) {
    return templateError(error, 'Your saved boards could not be loaded.');
  }
}

export async function POST(request: Request) {
  return saveTemplate(request, null);
}

export async function PUT(request: Request) {
  const body = await request.clone().json().catch(() => ({})) as { id?: unknown };
  return saveTemplate(request, typeof body.id === 'string' ? body.id : '');
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    await enforceRateLimit({ request, scope: 'delete-standalone-bingo-template', limit: 30, windowSeconds: 3_600, subject: user.id });
    const body = await request.json().catch(() => ({})) as { id?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return json({ error: 'Choose a saved board to remove.' }, { status: 400 });
    const result = await getDatabase().prepare(
      'DELETE FROM bingo_templates WHERE id = ? AND owner_user_id = ? AND owner_draft_id IS NULL',
    ).bind(id, user.id).run();
    if (!result.meta.changes) return json({ error: 'That saved board was not found.' }, { status: 404 });
    await recordAudit(getDatabase(), {
      actorUserId: user.id, actorType: 'organizer', eventType: 'bingo.studio_template_removed',
      metadata: { templateId: id }, requestId: requestId(request),
    }).catch(() => undefined);
    return json({ removed: true });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return templateError(error, 'That board could not be removed.');
  }
}

async function saveTemplate(request: Request, requestedId: string | null) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    await enforceRateLimit({ request, scope: 'save-standalone-bingo-template', limit: 40, windowSeconds: 86_400, subject: user.id });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.website) return json({ saved: true });
    const name = text(body.name, 70);
    if (!name) return json({ error: 'Give the reusable board a name.' }, { status: 400 });
    const visibility = sanitizeTemplateVisibility(body.visibility);
    if (visibility === 'public') {
      await enforceRateLimit({ request, scope: 'publish-standalone-bingo-template', limit: 5, windowSeconds: 86_400, subject: user.id });
    }
    const configuration = sanitizeBingoTemplate(body.configuration, getBuiltinBingoTemplate('points'));
    const validation = validateBingoBoard(configuration.tasks, configuration.rules);
    if (!validation.valid) return json({ error: validation.errors[0] ?? 'Finish the board before saving it.' }, { status: 400 });
    const summary = sanitizeTemplateSummary(body.summary, configuration.description || `A ${configuration.gridSize} × ${configuration.gridSize} OSRS bingo board.`);
    const category = sanitizeTemplateCategory(body.category);
    const tags = sanitizeTemplateTags(body.tags);
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = requestedId ? await db.prepare(
      `SELECT id, public_slug FROM bingo_templates
       WHERE id = ? AND owner_user_id = ? AND owner_draft_id IS NULL`,
    ).bind(requestedId, user.id).first<{ id: string; public_slug: string | null }>() : null;
    if (requestedId && !existing) return json({ error: 'That saved board was not found.' }, { status: 404 });
    const id = existing?.id ?? crypto.randomUUID();
    const publicSlug = visibility === 'public' ? existing?.public_slug ?? await uniquePublicTemplateSlug(name) : null;
    const savedConfiguration = {
      ...configuration,
      key: id,
      name,
      description: summary,
    };
    if (existing) {
      await db.prepare(
        `UPDATE bingo_templates
         SET name = ?, mode = ?, board_scope = ?, configuration_json = ?, public_slug = ?, visibility = ?,
             summary = ?, category = ?, tags_json = ?, published_at = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ? AND owner_draft_id IS NULL`,
      ).bind(name, savedConfiguration.mode, savedConfiguration.boardScope, JSON.stringify(savedConfiguration), publicSlug,
        visibility, summary, category, JSON.stringify(tags), visibility === 'public' ? now : null, now, id, user.id).run();
    } else {
      await db.prepare(
        `INSERT INTO bingo_templates
          (id, owner_draft_id, clan_id, owner_user_id, name, mode, board_scope, configuration_json,
           public_slug, visibility, summary, category, tags_json, published_at, created_at, updated_at)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, user.id, name, savedConfiguration.mode, savedConfiguration.boardScope, JSON.stringify(savedConfiguration),
        publicSlug, visibility, summary, category, JSON.stringify(tags), visibility === 'public' ? now : null, now, now).run();
    }
    await recordAudit(db, {
      actorUserId: user.id, actorType: 'organizer', eventType: existing ? 'bingo.studio_template_updated' : 'bingo.studio_template_saved',
      metadata: { templateId: id, visibility, category, taskCount: savedConfiguration.tasks.length },
      requestId: requestId(request), createdAt: now,
    }).catch(() => undefined);
    return json({
      id, name, summary, category, tags, visibility, configuration: savedConfiguration,
      publicPath: publicSlug ? `/templates/${publicSlug}` : null, updatedAt: now,
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return templateError(error, 'That board could not be saved.');
  }
}

function templateResponse(row: SavedTemplateRow) {
  try {
    const configuration = sanitizeBingoTemplate(JSON.parse(row.configuration_json));
    if (configuration.tasks.length !== configuration.gridSize ** 2) return [];
    return [{
      id: row.id, name: row.name, summary: row.summary, category: row.category,
      tags: sanitizeTemplateTags(JSON.parse(row.tags_json)), visibility: row.visibility,
      publicPath: row.public_slug ? `/templates/${row.public_slug}` : null,
      cloneCount: Number(row.clone_count) || 0,
      ratingAverage: row.rating_count > 0 ? row.rating_total / row.rating_count : null,
      configuration, createdAt: row.created_at, updatedAt: row.updated_at,
    }];
  } catch {
    return [];
  }
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function templateError(error: unknown, fallback: string) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  if (status >= 500) console.error(fallback, error);
  return json({ error: error instanceof Error && status < 500 ? error.message : fallback }, { status });
}
