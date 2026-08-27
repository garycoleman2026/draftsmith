import { resolveManagerDraftId } from '@/lib/access-tokens';
import { recordAudit, requestId } from '@/lib/audit';
import { bingoErrorResponse, parseJson } from '@/lib/bingo';
import { createBingoEventSnapshot, validBingoDate, validBingoMode, validBingoScope } from '@/lib/bingo-event-creation';
import { getBuiltinBingoTemplate, sanitizeBingoTemplate } from '@/lib/bingo-types';
import { getSessionUser } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import type { DraftResult } from '@/lib/types';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const events = await getDatabase().prepare(
      `SELECT be.id, be.title, be.public_slug, be.mode, be.board_scope, be.status, be.start_at, be.end_at,
              be.started_at, be.ended_at, be.revision, be.created_at,
              (SELECT COUNT(*) FROM bingo_tasks bt WHERE bt.event_id = be.id) AS task_count,
              (SELECT COUNT(*) FROM bingo_claims bc WHERE bc.event_id = be.id AND bc.status = 'pending') AS pending_count
       FROM bingo_events be WHERE be.draft_id = ? ORDER BY be.created_at DESC`,
    ).bind(draftId).all<Record<string, string | number | null>>();
    return json({ events: events.results.map((event) => ({
      ...event,
      managePath: `/bingo/manage/${token}/${event.id}`,
      publicPath: `/bingo/event/${event.public_slug}`,
    })) });
  } catch (error) {
    console.error('list bingo events failed', error);
    return json({ error: 'The bingo events could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  let createdEventId: string | null = null;
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const db = getDatabase();
    const draft = await db.prepare('SELECT title, result_json, clan_id, owner_user_id FROM drafts WHERE id = ?')
      .bind(draftId).first<{ title: string; result_json: string | null; clan_id: string | null; owner_user_id: string | null }>();
    const result = parseJson<DraftResult | null>(draft?.result_json, null);
    if (!draft || !result?.teams?.length) return json({ error: 'Finish the team draft before opening a bingo event.' }, { status: 409 });
    const count = await db.prepare('SELECT COUNT(*) AS count FROM bingo_events WHERE draft_id = ?').bind(draftId).first<{ count: number }>();
    if ((count?.count ?? 0) >= 20) return json({ error: 'This draft already has the maximum of 20 bingo events.' }, { status: 409 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const customTemplate = typeof body.templateId === 'string'
      ? await loadCustomTemplate(body.templateId, draftId, draft.clan_id)
      : null;
    const builtin = getBuiltinBingoTemplate(body.templateKey);
    const configuration = customTemplate
      ? sanitizeBingoTemplate(parseJson(customTemplate.configuration_json, {}), builtin)
      : builtin;
    const mode = validBingoMode(body.mode ?? configuration.mode);
    const boardScope = mode === 'lockout' ? 'shared' : validBingoScope(body.boardScope ?? configuration.boardScope);
    const titleInput = typeof body.title === 'string' ? body.title.trim().slice(0, 90) : '';
    const title = titleInput || `${draft.title} bingo`;
    const startAt = validBingoDate(body.startAt);
    const endAt = validBingoDate(body.endAt);
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) return json({ error: 'The end time must be after the start time.' }, { status: 400 });
    const sessionUser = await getSessionUser(request);
    const now = new Date().toISOString();
    const created = await createBingoEventSnapshot({
      draftId,
      title,
      result,
      configuration,
      mode,
      boardScope,
      startAt,
      endAt,
      createdByUserId: sessionUser?.id ?? draft.owner_user_id,
      templateKey: customTemplate ? null : builtin.key,
    });
    createdEventId = created.id;
    await recordAudit(db, {
      draftId, clanId: draft.clan_id, actorUserId: sessionUser?.id ?? null, actorType: 'organizer',
      eventType: 'bingo.created', metadata: { eventId: created.id, mode, boardScope, taskCount: configuration.tasks.length },
      requestId: requestId(request), createdAt: now,
    });
    if (customTemplate?.visibility === 'public') {
      await db.prepare('UPDATE bingo_templates SET clone_count = clone_count + 1 WHERE id = ? AND visibility = ?')
        .bind(customTemplate.id, 'public').run();
    }
    return json({
      id: created.id,
      managePath: `/bingo/manage/${token}/${created.id}`,
      publicPath: created.publicPath,
      teamLinks: created.teamLinks,
    }, { status: 201 });
  } catch (error) {
    if (createdEventId) await getDatabase().prepare('DELETE FROM bingo_events WHERE id = ?').bind(createdEventId).run().catch(() => undefined);
    const failure = bingoErrorResponse(error);
    if (failure.status < 500) return json({ error: failure.message }, { status: failure.status });
    console.error('create bingo event failed', error);
    return json({ error: 'The bingo event could not be created.' }, { status: 500 });
  }
}

async function loadCustomTemplate(templateId: string, draftId: string, clanId: string | null) {
  return getDatabase().prepare(
    `SELECT id, configuration_json, visibility FROM bingo_templates
     WHERE id = ? AND (owner_draft_id = ? OR (clan_id IS NOT NULL AND clan_id = ?) OR visibility = 'public')`,
  ).bind(templateId, draftId, clanId).first<{ id: string; configuration_json: string; visibility: string }>();
}
