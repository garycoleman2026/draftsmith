import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import type { ConstraintRow } from '../../../../../lib/draft';
import { previewPlayerSwap } from '../../../../../lib/results';
import type { DraftResult } from '../../../../../lib/types';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = (await request.json()) as { playerAId?: unknown; playerBId?: unknown; save?: unknown };
    const playerAId = typeof body.playerAId === 'string' ? body.playerAId : '';
    const playerBId = typeof body.playerBId === 'string' ? body.playerBId : '';
    if (!playerAId || !playerBId || playerAId === playerBId) return json({ error: 'Choose two different players.' }, { status: 400 });
    const db = getDatabase();
    const [draft, constraints, previousRun] = await Promise.all([
      db.prepare('SELECT result_json FROM drafts WHERE id = ?').bind(draftId).first<{ result_json: string | null }>(),
      db.prepare('SELECT constraint_type, enforcement, penalty, player_a_id, player_b_id FROM draft_constraints WHERE draft_id = ?')
        .bind(draftId).all<ConstraintRow>(),
      db.prepare('SELECT COALESCE(MAX(run_number), 0) AS run_number FROM draft_runs WHERE draft_id = ?')
        .bind(draftId).first<{ run_number: number }>(),
    ]);
    if (!draft?.result_json) return json({ error: 'Generate teams before previewing a swap.' }, { status: 409 });
    const current = JSON.parse(draft.result_json) as DraftResult;
    const result = previewPlayerSwap(current, playerAId, playerBId, constraints.results);
    if (body.save === true) {
      const runNumber = (previousRun?.run_number ?? 0) + 1;
      result.runNumber = runNumber;
      const now = new Date().toISOString();
      await db.batch([
        db.prepare(`INSERT INTO draft_runs
          (id, draft_id, run_number, source, seed, configuration_json, result_json, fairness_json, created_at)
          VALUES (?, ?, ?, 'manual_swap', ?, ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), draftId, runNumber, current.seed ?? draftId,
            JSON.stringify({ playerAId, playerBId }), JSON.stringify(result), JSON.stringify(result.fairness ?? {}), now),
        db.prepare("UPDATE drafts SET result_json = ?, status = 'complete', updated_at = ? WHERE id = ?")
          .bind(JSON.stringify(result), now, draftId),
      ]);
      await recordAudit(db, {
        draftId, actorType: 'organizer', eventType: 'draft.manual_swap',
        metadata: { runNumber, playerAId, playerBId }, createdAt: now,
      });
    }
    return json({ result, saved: body.save === true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The swap could not be previewed.';
    return json({ error: message }, { status: message.startsWith('Choose') || message.includes('hard') ? 409 : 500 });
  }
}
