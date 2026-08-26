import { discordConfiguration, getSessionUser } from '../../../../lib/auth';
import { ensureSchema, getDatabase, json } from '../../../../lib/db';

export async function GET(request: Request) {
  await ensureSchema();
  const user = await getSessionUser(request);
  const configured = Boolean(discordConfiguration(request));
  if (!user) return json({ configured, user: null, clans: [] });
  const clans = await getDatabase()
    .prepare(
      `SELECT c.id, c.name, c.slug, cm.role
       FROM clan_memberships cm JOIN clans c ON c.id = cm.clan_id
       WHERE cm.user_id = ? ORDER BY c.name`,
    )
    .bind(user.id)
    .all<{ id: string; name: string; slug: string; role: string }>();
  return json({ configured, user, clans: clans.results });
}
