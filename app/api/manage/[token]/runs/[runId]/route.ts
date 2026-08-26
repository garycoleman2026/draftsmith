import { resolveManagerDraftId } from '../../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../../lib/db';
import type { DraftResult } from '../../../../../../lib/types';

export async function GET(_request: Request, context: { params: Promise<{ token: string; runId: string }> }) {
  await ensureSchema();
  const { token, runId } = await context.params;
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
  const row = await getDatabase().prepare(
    'SELECT id, run_number, source, seed, configuration_json, result_json, fairness_json, created_at FROM draft_runs WHERE id = ? AND draft_id = ?',
  ).bind(runId, draftId).first<Record<string, string | number>>();
  if (!row) return json({ error: 'That draft run was not found.' }, { status: 404 });
  return json({ run: { ...row, configuration: parse(row.configuration_json), result: parse(row.result_json), fairness: parse(row.fairness_json) } });
}

export async function PUT(_request: Request, context: { params: Promise<{ token: string; runId: string }> }) {
  await ensureSchema();
  const { token, runId } = await context.params;
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
  const db = getDatabase();
  const row = await db.prepare('SELECT result_json FROM draft_runs WHERE id = ? AND draft_id = ?').bind(runId, draftId)
    .first<{ result_json: string }>();
  if (!row) return json({ error: 'That draft run was not found.' }, { status: 404 });
  const result = JSON.parse(row.result_json) as DraftResult;
  const now = new Date().toISOString();
  await db.prepare("UPDATE drafts SET result_json = ?, status = 'complete', updated_at = ? WHERE id = ?")
    .bind(row.result_json, now, draftId).run();
  await recordAudit(db, { draftId, actorType: 'organizer', eventType: 'draft.run_restored', metadata: { runId }, createdAt: now });
  return json({ result });
}

function parse(value: unknown) {
  if (typeof value !== 'string') return {};
  try { return JSON.parse(value) as unknown; } catch { return {}; }
}
