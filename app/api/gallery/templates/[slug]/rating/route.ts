import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import { hashToken, parseCookies, randomToken } from '@/lib/security';

const COOKIE_NAME = 'terrys_template_rater';
type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { slug } = await context.params;
    const template = await getDatabase().prepare(
      `SELECT id, rating_count, rating_total FROM bingo_templates
       WHERE public_slug = ? AND visibility = 'public'`,
    ).bind(slug).first<{ id: string; rating_count: number; rating_total: number }>();
    if (!template) return json({ error: 'That community template was not found.' }, { status: 404 });
    const token = parseCookies(request).get(COOKIE_NAME);
    const vote = token ? await getDatabase().prepare(
      'SELECT rating FROM bingo_template_ratings WHERE template_id = ? AND rater_hash = ?',
    ).bind(template.id, await hashToken(token)).first<{ rating: number }>() : null;
    return json({
      ratingCount: template.rating_count,
      ratingAverage: template.rating_count ? template.rating_total / template.rating_count : null,
      userRating: vote?.rating ?? null,
    });
  } catch (error) {
    console.error('load template rating failed', error);
    return json({ error: 'The rating could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    await enforceRateLimit({ request, scope: 'rate-bingo-template', limit: 20, windowSeconds: 3_600 });
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({})) as { rating?: unknown };
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: 'Choose a rating from one to five.' }, { status: 400 });
    }
    const db = getDatabase();
    const template = await db.prepare(
      `SELECT id FROM bingo_templates WHERE public_slug = ? AND visibility = 'public'`,
    ).bind(slug).first<{ id: string }>();
    if (!template) return json({ error: 'That community template was not found.' }, { status: 404 });
    const existingToken = parseCookies(request).get(COOKIE_NAME);
    const token = existingToken && existingToken.length >= 20 ? existingToken : randomToken(24);
    const raterHash = await hashToken(token);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(
        `INSERT INTO bingo_template_ratings (template_id, rater_hash, rating, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(template_id, rater_hash) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at`,
      ).bind(template.id, raterHash, rating, now, now),
      db.prepare(
        `UPDATE bingo_templates SET
           rating_count = (SELECT COUNT(*) FROM bingo_template_ratings WHERE template_id = ?),
           rating_total = COALESCE((SELECT SUM(rating) FROM bingo_template_ratings WHERE template_id = ?), 0),
           updated_at = ?
         WHERE id = ?`,
      ).bind(template.id, template.id, now, template.id),
    ]);
    const aggregate = await db.prepare(
      'SELECT rating_count, rating_total FROM bingo_templates WHERE id = ?',
    ).bind(template.id).first<{ rating_count: number; rating_total: number }>();
    const headers = new Headers();
    if (!existingToken) headers.set('Set-Cookie', ratingCookie(token, request.url));
    return json({
      ratingCount: aggregate?.rating_count ?? 1,
      ratingAverage: aggregate?.rating_count ? aggregate.rating_total / aggregate.rating_count : rating,
      userRating: rating,
    }, { headers });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    console.error('save template rating failed', error);
    return json({ error: 'The rating could not be saved.' }, { status: 500 });
  }
}

function ratingCookie(token: string, url: string) {
  const secure = new URL(url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=31536000`;
}
