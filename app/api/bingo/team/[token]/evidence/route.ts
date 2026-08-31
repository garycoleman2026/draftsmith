import { env } from 'cloudflare:workers';
import { BingoError, bingoErrorResponse, resolveBingoTeam } from '@/lib/bingo';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    const uploadId = new URL(request.url).searchParams.get('uploadId') ?? '';
    if (!uploadId) throw new BingoError('Choose an evidence image.');
    const upload = await getDatabase().prepare(
      'SELECT object_key, content_type, filename FROM bingo_evidence_uploads WHERE id = ? AND event_id = ? AND team_id = ?',
    ).bind(uploadId, team.event_id, team.id).first<{ object_key: string; content_type: string; filename: string }>();
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
    if (result.status >= 500) console.error('load team bingo evidence failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  let objectKey: string | null = null;
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    await enforceRateLimit({ request, scope: 'bingo-evidence', limit: 12, windowSeconds: 600, subject: team.id });
    const event = await getDatabase().prepare('SELECT status FROM bingo_events WHERE id = ?').bind(team.event_id).first<{ status: string }>();
    if (event?.status !== 'live') throw new BingoError('Evidence can only be uploaded while the bingo is live.', 409);
    const form = await request.formData();
    const value = form.get('file');
    if (!(value instanceof File)) throw new BingoError('Choose a screenshot to upload.');
    if (!ALLOWED_TYPES.has(value.type)) throw new BingoError('Screenshots must be PNG, JPEG, or WebP images.');
    if (value.size < 1 || value.size > MAX_EVIDENCE_BYTES) throw new BingoError('Screenshots must be 5 MB or smaller.');
    const bytes = await value.arrayBuffer();
    if (!matchesImageSignature(new Uint8Array(bytes), value.type)) throw new BingoError('That file does not appear to be a valid image.');
    const id = crypto.randomUUID();
    objectKey = `bingo/${team.event_id}/${team.id}/${id}`;
    await env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: value.type } });
    const now = new Date().toISOString();
    await getDatabase().prepare(
      `INSERT INTO bingo_evidence_uploads
        (id, event_id, team_id, object_key, filename, content_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, team.event_id, team.id, objectKey, value.name.slice(0, 120) || 'evidence', value.type, value.size, now).run();
    return json({ id, filename: value.name.slice(0, 120), sizeBytes: value.size }, { status: 201 });
  } catch (error) {
    if (objectKey) await env.FILES.delete(objectKey).catch(() => undefined);
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('upload bingo evidence failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}

function matchesImageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function safeImageType(value: string) { return ALLOWED_TYPES.has(value) ? value : 'application/octet-stream'; }
function safeFilename(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'evidence'; }
