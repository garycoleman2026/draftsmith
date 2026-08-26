import { resolveManagerDraftId } from '../../../../../lib/access-tokens';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { resultCsv, resultMarkdown, resultSvg } from '../../../../../lib/exports';
import type { DraftResult } from '../../../../../lib/types';

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  await ensureSchema();
  const { token } = await context.params;
  const draftId = await resolveManagerDraftId(token);
  if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
  const draft = await getDatabase().prepare('SELECT title, result_json FROM drafts WHERE id = ?').bind(draftId)
    .first<{ title: string; result_json: string | null }>();
  if (!draft?.result_json) return json({ error: 'Generate teams before exporting.' }, { status: 409 });
  const result = JSON.parse(draft.result_json) as DraftResult;
  const format = new URL(request.url).searchParams.get('format') ?? 'json';
  const slug = draft.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'terrys-draft';
  if (format === 'csv') return download(resultCsv(result), 'text/csv; charset=utf-8', `${slug}-teams.csv`);
  if (format === 'discord' || format === 'markdown') return download(resultMarkdown(draft.title, result), 'text/markdown; charset=utf-8', `${slug}-teams.md`);
  if (format === 'svg' || format === 'image') return download(resultSvg(draft.title, result), 'image/svg+xml; charset=utf-8', `${slug}-teams.svg`);
  return download(JSON.stringify({ title: draft.title, result }, null, 2), 'application/json; charset=utf-8', `${slug}-teams.json`);
}

function download(body: string, contentType: string, filename: string) {
  return new Response(body, { headers: {
    'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  } });
}
