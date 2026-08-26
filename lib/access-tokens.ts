import { getDatabase } from './db';
import { hashToken, randomToken } from './security';

export async function resolveManagerDraftId(token: string) {
  const tokenHash = await hashToken(token);
  const db = getDatabase();
  const now = new Date().toISOString();
  const draft = await db
    .prepare(
      `SELECT d.id, d.admin_token_hash, d.admin_token
       FROM drafts d
       WHERE d.admin_token_hash = ? OR d.admin_token = ?
          OR EXISTS (
            SELECT 1 FROM draft_access_tokens dat
            WHERE dat.draft_id = d.id AND dat.token_hash = ?
              AND dat.revoked_at IS NULL
              AND (dat.expires_at IS NULL OR dat.expires_at > ?)
          )`,
    )
    .bind(tokenHash, token, tokenHash, now)
    .first<{ id: string; admin_token_hash: string | null; admin_token: string }>();
  if (!draft) return null;
  if (!draft.admin_token_hash && draft.admin_token === token) {
    await db
      .prepare('UPDATE drafts SET admin_token_hash = ?, admin_token = ? WHERE id = ? AND admin_token_hash IS NULL')
      .bind(tokenHash, retiredCredential(), draft.id)
      .run();
  }
  return draft.id;
}

export async function resolveSignupDraftId(token: string) {
  const tokenHash = await hashToken(token);
  const db = getDatabase();
  const draft = await db
    .prepare(
      `SELECT id, signup_token_hash, signup_token
       FROM drafts WHERE signup_token_hash = ? OR signup_token = ? OR public_slug = ?`,
    )
    .bind(tokenHash, token, token)
    .first<{ id: string; signup_token_hash: string | null; signup_token: string | null }>();
  if (!draft) return null;
  if (!draft.signup_token_hash && draft.signup_token === token) {
    await db
      .prepare('UPDATE drafts SET signup_token_hash = ?, signup_token = NULL WHERE id = ? AND signup_token_hash IS NULL')
      .bind(tokenHash, draft.id)
      .run();
  }
  return draft.id;
}

export async function resolveCaptainId(token: string) {
  const tokenHash = await hashToken(token);
  const db = getDatabase();
  const captain = await db
    .prepare('SELECT id, token_hash, token FROM captains WHERE token_hash = ? OR token = ?')
    .bind(tokenHash, token)
    .first<{ id: string; token_hash: string | null; token: string }>();
  if (!captain) return null;
  if (!captain.token_hash && captain.token === token) {
    await db
      .prepare('UPDATE captains SET token_hash = ?, token = ? WHERE id = ? AND token_hash IS NULL')
      .bind(tokenHash, retiredCredential(), captain.id)
      .run();
  }
  return captain.id;
}

export async function resolveParticipantId(token: string) {
  const tokenHash = await hashToken(token);
  const row = await getDatabase()
    .prepare('SELECT id FROM players WHERE participant_token_hash = ? AND withdrawn_at IS NULL')
    .bind(tokenHash)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function createHashedCredential() {
  const token = randomToken(24);
  return { token, hash: await hashToken(token), retired: retiredCredential() };
}

export async function createTemporaryManagerToken(input: {
  draftId: string;
  userId: string;
  lifetimeSeconds?: number;
}) {
  const credential = await createHashedCredential();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.lifetimeSeconds ?? 600) * 1000);
  await getDatabase()
    .prepare(
      `INSERT INTO draft_access_tokens
        (id, draft_id, token_hash, purpose, created_by_user_id, expires_at, created_at)
       VALUES (?, ?, ?, 'manage', ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.draftId,
      credential.hash,
      input.userId,
      expiresAt.toISOString(),
      now.toISOString(),
    )
    .run();
  return { token: credential.token, expiresAt: expiresAt.toISOString() };
}

function retiredCredential() {
  return `retired:${crypto.randomUUID()}`;
}
