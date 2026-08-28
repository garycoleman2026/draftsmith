import { ensureSchema, getDatabase, json } from '@/lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '@/lib/rate-limit';
import { hashToken, parseCookies, randomToken } from '@/lib/security';

const COOKIE_NAME = 'terrys_template_voter';
type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await ensureSchema();
    const { slug } = await context.params;
    const db = getDatabase();
    const template = await db.prepare(
      `SELECT id FROM bingo_templates WHERE public_slug = ? AND visibility = 'public'`,
    ).bind(slug).first<{ id: string }>();
    if (!template) return json({ error: 'That community board was not found.' }, { status: 404 });
    const token = parseCookies(request).get(COOKIE_NAME);
    const ownVote = token ? await db.prepare(
      'SELECT vote FROM bingo_template_votes WHERE template_id = ? AND voter_hash = ?',
    ).bind(template.id, await hashToken(token)).first<{ vote: number }>() : null;
    return json({ ...await voteSummary(template.id), userVote: ownVote?.vote ?? 0 });
  } catch (error) {
    console.error('load template votes failed', error);
    return json({ error: 'The votes could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    await enforceRateLimit({ request, scope: 'vote-bingo-template', limit: 30, windowSeconds: 3_600 });
    const { slug } = await context.params;
    const body = await request.json().catch(() => ({})) as { vote?: unknown };
    const vote = Number(body.vote);
    if (vote !== 1 && vote !== -1) return json({ error: 'Choose an upvote or downvote.' }, { status: 400 });

    const db = getDatabase();
    const template = await db.prepare(
      `SELECT id FROM bingo_templates WHERE public_slug = ? AND visibility = 'public'`,
    ).bind(slug).first<{ id: string }>();
    if (!template) return json({ error: 'That community board was not found.' }, { status: 404 });

    const existingToken = parseCookies(request).get(COOKIE_NAME);
    const token = existingToken && existingToken.length >= 20 ? existingToken : randomToken(24);
    const voterHash = await hashToken(token);
    const previous = await db.prepare(
      'SELECT vote FROM bingo_template_votes WHERE template_id = ? AND voter_hash = ?',
    ).bind(template.id, voterHash).first<{ vote: number }>();
    const now = new Date().toISOString();
    let userVote = vote;

    if (previous?.vote === vote) {
      await db.prepare('DELETE FROM bingo_template_votes WHERE template_id = ? AND voter_hash = ?')
        .bind(template.id, voterHash).run();
      userVote = 0;
    } else {
      await db.prepare(
        `INSERT INTO bingo_template_votes (template_id, voter_hash, vote, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(template_id, voter_hash) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at`,
      ).bind(template.id, voterHash, vote, now, now).run();
    }

    const headers = new Headers();
    if (!existingToken) headers.set('Set-Cookie', voterCookie(token, request.url));
    return json({ ...await voteSummary(template.id), userVote }, { headers });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    console.error('save template vote failed', error);
    return json({ error: 'The vote could not be saved.' }, { status: 500 });
  }
}

async function voteSummary(templateId: string) {
  const aggregate = await getDatabase().prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) AS upvote_count,
       COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) AS downvote_count
     FROM bingo_template_votes WHERE template_id = ?`,
  ).bind(templateId).first<{ upvote_count: number; downvote_count: number }>();
  const upvoteCount = Number(aggregate?.upvote_count) || 0;
  const downvoteCount = Number(aggregate?.downvote_count) || 0;
  return { upvoteCount, downvoteCount, voteScore: upvoteCount - downvoteCount };
}

function voterCookie(token: string, url: string) {
  const secure = new URL(url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=31536000`;
}
