import { bingoEventRole, requireSessionUser } from '@/lib/auth';
import { ensureSchema, getDatabase, json } from '@/lib/db';
import { hashToken } from '@/lib/security';
import type { BingoEventRole } from '@/lib/types';

type Context = { params: Promise<{ token: string }> };
type InviteRow = { id: string; event_id: string; role: BingoEventRole; expires_at: string; max_uses: number; use_count: number; revoked_at: string | null; title: string };

async function inviteFor(token: string) {
  return getDatabase().prepare(`SELECT bei.id, bei.event_id, bei.role, bei.expires_at, bei.max_uses, bei.use_count, bei.revoked_at, be.title
    FROM bingo_event_invites bei JOIN bingo_events be ON be.id = bei.event_id WHERE bei.token_hash = ?`)
    .bind(await hashToken(token)).first<InviteRow>();
}

export async function GET(_request: Request, context: Context) {
  try {
    await ensureSchema();
    const invite = await inviteFor((await context.params).token);
    if (!valid(invite)) return json({ error: 'This helper invitation has expired or is no longer available.' }, { status: 404 });
    return json({ eventId: invite!.event_id, title: invite!.title, role: invite!.role, expiresAt: invite!.expires_at });
  } catch { return json({ error: 'This helper invitation could not be opened.' }, { status: 500 }); }
}

export async function POST(request: Request, context: Context) {
  try {
    await ensureSchema();
    const user = await requireSessionUser(request);
    const invite = await inviteFor((await context.params).token);
    if (!valid(invite)) return json({ error: 'This helper invitation has expired or is no longer available.' }, { status: 404 });
    const existingRole = await bingoEventRole(user.id, invite!.event_id);
    if (!existingRole) {
      const now = new Date().toISOString();
      const claimed = await getDatabase().prepare(`UPDATE bingo_event_invites SET use_count = use_count + 1
        WHERE id = ? AND revoked_at IS NULL AND expires_at > ? AND use_count < max_uses`).bind(invite!.id, now).run();
      if (!claimed.meta.changes) return json({ error: 'This helper invitation is no longer available.' }, { status: 409 });
      await getDatabase().prepare(`INSERT INTO bingo_event_collaborators
        (event_id, user_id, role, invited_by_user_id, created_at)
        SELECT event_id, ?, role, created_by_user_id, ? FROM bingo_event_invites WHERE id = ?
        ON CONFLICT(event_id, user_id) DO UPDATE SET role = excluded.role`)
        .bind(user.id, now, invite!.id).run();
    }
    return json({ accepted: true, eventId: invite!.event_id, role: existingRole ?? invite!.role });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return json({ error: error instanceof Error && status < 500 ? error.message : 'The invitation could not be accepted.' }, { status });
  }
}

function valid(invite: InviteRow | null): invite is InviteRow {
  return Boolean(invite && !invite.revoked_at && invite.use_count < invite.max_uses && invite.expires_at > new Date().toISOString());
}
