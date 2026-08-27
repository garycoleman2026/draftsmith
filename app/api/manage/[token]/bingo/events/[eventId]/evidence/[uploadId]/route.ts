import { env } from 'cloudflare:workers';
import { BingoError, bingoErrorResponse, requireManagedBingoEvent } from '@/lib/bingo';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function GET(_request: Request, context: { params: Promise<{ token: string; eventId: string; uploadId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId, uploadId } = await context.params;
    await requireManagedBingoEvent(token, eventId);
    const upload = await getDatabase().prepare(
      'SELECT object_key, content_type, filename FROM bingo_evidence_uploads WHERE id = ? AND event_id = ?',
    ).bind(uploadId, eventId).first<{ object_key: string; content_type: string; filename: string }>();
    if (!upload) throw new BingoError('That evidence image was not found.', 404);
    const object = await env.FILES.get(upload.object_key);
    if (!object) throw new BingoError('That evidence image is no longer available.', 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': safeImageType(upload.content_type),
        'Content-Disposition': `inline; filename="${safeFilename(upload.filename)}"`,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('load bingo evidence failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

function safeImageType(value: string) { return ['image/jpeg', 'image/png', 'image/webp'].includes(value) ? value : 'application/octet-stream'; }
function safeFilename(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'evidence'; }
