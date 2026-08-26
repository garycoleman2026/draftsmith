import { env } from 'cloudflare:workers';
import { getDatabase } from './db';
import { hashToken, parseCookies, randomToken, sessionCookie } from './security';

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  discordId: string | null;
  email: string | null;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
};

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = parseCookies(request).get('terrys_session');
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const db = getDatabase();
  const user = await db
    .prepare(
      `SELECT u.id, u.discord_id, u.email, u.username, u.display_name, u.avatar_hash
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<{
      id: string;
      discord_id: string | null;
      email: string | null;
      username: string;
      display_name: string | null;
      avatar_hash: string | null;
    }>();
  if (!user) return null;
  void db
    .prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
    .bind(now, tokenHash)
    .run();
  return {
    id: user.id,
    discordId: user.discord_id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    avatarHash: user.avatar_hash,
  };
}

export async function requireSessionUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new AuthorizationError('Sign in with Discord to continue.', 401);
  return user;
}

export async function createSession(userId: string) {
  const token = randomToken(36);
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000);
  await getDatabase()
    .prepare(
      `INSERT INTO sessions
        (id, user_id, token_hash, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
    )
    .run();
  return { token, cookie: sessionCookie(token, SESSION_SECONDS), expiresAt: expiresAt.toISOString() };
}

export async function revokeSession(request: Request) {
  const token = parseCookies(request).get('terrys_session');
  if (!token) return;
  const tokenHash = await hashToken(token);
  await getDatabase()
    .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
    .bind(new Date().toISOString(), tokenHash)
    .run();
}

export function discordConfiguration(request: Request) {
  const clientId = env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const configuredOrigin = env.APP_BASE_URL?.trim().replace(/\/$/, '');
  const requestOrigin = new URL(request.url).origin;
  const origin = configuredOrigin && /^https:\/\//i.test(configuredOrigin) ? configuredOrigin : requestOrigin;
  return {
    clientId,
    clientSecret,
    origin,
    redirectUri: `${origin}/api/auth/discord/callback`,
  };
}

export async function getClanRole(userId: string, clanId: string) {
  return getDatabase()
    .prepare('SELECT role FROM clan_memberships WHERE clan_id = ? AND user_id = ?')
    .bind(clanId, userId)
    .first<{ role: 'owner' | 'admin' | 'captain' | 'member' }>();
}

export async function requireClanRole(
  request: Request,
  clanId: string,
  allowed: Array<'owner' | 'admin' | 'captain' | 'member'>,
) {
  const user = await requireSessionUser(request);
  const membership = await getClanRole(user.id, clanId);
  if (!membership || !allowed.includes(membership.role)) {
    throw new AuthorizationError('You do not have permission to manage this clan.', 403);
  }
  return { user, role: membership.role };
}

export async function canManageDraft(userId: string, draftId: string) {
  const row = await getDatabase()
    .prepare(
      `SELECT d.id
       FROM drafts d
       LEFT JOIN clan_memberships cm ON cm.clan_id = d.clan_id AND cm.user_id = ?
       WHERE d.id = ? AND (
         d.owner_user_id = ? OR cm.role IN ('owner', 'admin')
       )`,
    )
    .bind(userId, draftId, userId)
    .first<{ id: string }>();
  return Boolean(row);
}

export class AuthorizationError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}
