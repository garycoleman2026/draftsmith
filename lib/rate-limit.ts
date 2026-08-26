import { getDatabase } from './db';
import { clientFingerprint, hashToken } from './security';

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many requests. Wait a moment and try again.');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function enforceRateLimit(input: {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  subject?: string;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.windowSeconds * 1000);
  const subject = input.subject
    ? await hashToken(input.subject)
    : await clientFingerprint(input.request);
  const key = `${input.scope}:${subject}`;
  const db = getDatabase();
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_started_at, expires_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.expires_at <= excluded.window_started_at THEN 1 ELSE rate_limits.count + 1 END,
         window_started_at = CASE WHEN rate_limits.expires_at <= excluded.window_started_at THEN excluded.window_started_at ELSE rate_limits.window_started_at END,
         expires_at = CASE WHEN rate_limits.expires_at <= excluded.window_started_at THEN excluded.expires_at ELSE rate_limits.expires_at END
       RETURNING count, expires_at`,
    )
    .bind(key, now.toISOString(), expiresAt.toISOString())
    .first<{ count: number; expires_at: string }>();
  if (row && row.count > input.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(row.expires_at) - now.getTime()) / 1000));
    throw new RateLimitError(retryAfterSeconds);
  }
  if (crypto.getRandomValues(new Uint8Array(1))[0] < 4) {
    await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now.toISOString()).run();
  }
}

export function rateLimitResponse(error: RateLimitError) {
  return new Response(JSON.stringify({ error: error.message }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': String(error.retryAfterSeconds),
    },
  });
}
