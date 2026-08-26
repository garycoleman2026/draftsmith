import { discordConfiguration } from '../../../../../lib/auth';
import { ensureSchema, getDatabase, json } from '../../../../../lib/db';
import { enforceRateLimit, RateLimitError, rateLimitResponse } from '../../../../../lib/rate-limit';
import { hashToken, randomToken, safeReturnTo } from '../../../../../lib/security';

export async function GET(request: Request) {
  try {
    await ensureSchema();
    await enforceRateLimit({ request, scope: 'discord-auth-start', limit: 12, windowSeconds: 300 });
    const configuration = discordConfiguration(request);
    if (!configuration) {
      return json({ error: 'Discord sign-in is not configured yet.' }, { status: 503 });
    }
    const requestUrl = new URL(request.url);
    const state = randomToken(24);
    const verifier = randomToken(48);
    const stateHash = await hashToken(state);
    const challenge = await hashToken(verifier);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const db = getDatabase();
    await db.batch([
      db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').bind(now.toISOString()),
      db
        .prepare(
          `INSERT INTO oauth_states
            (id, state_hash, verifier, return_to, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          stateHash,
          verifier,
          safeReturnTo(requestUrl.searchParams.get('returnTo')),
          expiresAt.toISOString(),
          now.toISOString(),
        ),
    ]);
    const authorization = new URL('https://discord.com/oauth2/authorize');
    authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('client_id', configuration.clientId);
    authorization.searchParams.set('scope', 'identify email');
    authorization.searchParams.set('state', state);
    authorization.searchParams.set('redirect_uri', configuration.redirectUri);
    authorization.searchParams.set('code_challenge', challenge);
    authorization.searchParams.set('code_challenge_method', 'S256');
    return Response.redirect(authorization.toString(), 302);
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    console.error('start Discord authentication failed', error);
    return json({ error: 'Discord sign-in could not be started.' }, { status: 500 });
  }
}
