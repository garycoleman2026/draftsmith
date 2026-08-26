import { createSession, discordConfiguration } from '../../../../../lib/auth';
import { recordAudit } from '../../../../../lib/audit';
import { ensureSchema, getDatabase } from '../../../../../lib/db';
import { hashToken, safeReturnTo } from '../../../../../lib/security';

type DiscordToken = { access_token?: string; token_type?: string };
type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string | null;
};

export async function GET(request: Request) {
  const configuration = discordConfiguration(request);
  const fallbackOrigin = new URL(request.url).origin;
  const origin = configuration?.origin ?? fallbackOrigin;
  try {
    await ensureSchema();
    if (!configuration) return redirectError(origin, 'Discord sign-in is not configured.');
    const url = new URL(request.url);
    if (url.searchParams.get('error')) return redirectError(origin, 'Discord sign-in was cancelled.');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return redirectError(origin, 'Discord returned an incomplete sign-in response.');
    const stateHash = await hashToken(state);
    const db = getDatabase();
    const stored = await db
      .prepare(
        `SELECT id, verifier, return_to FROM oauth_states
         WHERE state_hash = ? AND expires_at > ?`,
      )
      .bind(stateHash, new Date().toISOString())
      .first<{ id: string; verifier: string; return_to: string }>();
    if (!stored) return redirectError(origin, 'That sign-in request expired. Please try again.');
    await db.prepare('DELETE FROM oauth_states WHERE id = ?').bind(stored.id).run();

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: configuration.redirectUri,
        code_verifier: stored.verifier,
      }),
    });
    const token = (await tokenResponse.json()) as DiscordToken;
    if (!tokenResponse.ok || !token.access_token) throw new Error('Discord token exchange failed.');
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const discordUser = (await userResponse.json()) as DiscordUser;
    if (!userResponse.ok || !discordUser.id || !discordUser.username) {
      throw new Error('Discord profile request failed.');
    }
    const now = new Date().toISOString();
    let user = await db
      .prepare('SELECT id FROM users WHERE discord_id = ?')
      .bind(discordUser.id)
      .first<{ id: string }>();
    const displayName = discordUser.global_name?.trim() || discordUser.username;
    if (user) {
      await db
        .prepare(
          `UPDATE users SET email = ?, username = ?, display_name = ?, avatar_hash = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          discordUser.email ?? null,
          discordUser.username,
          displayName,
          discordUser.avatar ?? null,
          now,
          user.id,
        )
        .run();
    } else {
      user = { id: crypto.randomUUID() };
      const clanId = crypto.randomUUID();
      const clanName = `${displayName}'s Clan`.slice(0, 60);
      const slug = await uniqueClanSlug(clanName);
      await db.batch([
        db
          .prepare(
            `INSERT INTO users
              (id, discord_id, email, username, display_name, avatar_hash, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            user.id,
            discordUser.id,
            discordUser.email ?? null,
            discordUser.username,
            displayName,
            discordUser.avatar ?? null,
            now,
            now,
          ),
        db
          .prepare(
            `INSERT INTO clans (id, name, slug, created_by_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(clanId, clanName, slug, user.id, now, now),
        db
          .prepare(
            `INSERT INTO clan_memberships (clan_id, user_id, role, created_at)
             VALUES (?, ?, 'owner', ?)`,
          )
          .bind(clanId, user.id, now),
      ]);
      await recordAudit(db, {
        clanId,
        actorUserId: user.id,
        actorType: 'organizer',
        eventType: 'account.created',
        metadata: { provider: 'discord' },
      });
    }
    const session = await createSession(user.id);
    const destination = new URL(safeReturnTo(stored.return_to), origin);
    const response = Response.redirect(destination.toString(), 302);
    response.headers.append('Set-Cookie', session.cookie);
    return response;
  } catch (error) {
    console.error('finish Discord authentication failed', error);
    return redirectError(origin, 'Discord sign-in failed. Please try again.');
  }
}

async function uniqueClanSlug(name: string) {
  const base = name
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'clan';
  const db = getDatabase();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt ? `-${attempt + 1}` : '';
    const slug = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    const existing = await db.prepare('SELECT id FROM clans WHERE slug = ?').bind(slug).first();
    if (!existing) return slug;
  }
  return `${base.slice(0, 28)}-${crypto.randomUUID().slice(0, 8)}`;
}

function redirectError(origin: string, message: string) {
  const destination = new URL('/', origin);
  destination.searchParams.set('authError', message);
  return Response.redirect(destination.toString(), 302);
}
