import { createHashedCredential, resolveManagerDraftId } from '../../../../../../lib/access-tokens';
import { recordAudit } from '../../../../../../lib/audit';
import { ensureSchema, getDatabase, json } from '../../../../../../lib/db';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const draftId = await resolveManagerDraftId(token);
    if (!draftId) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { captainId?: unknown };
    const captainId = typeof body.captainId === 'string' ? body.captainId : null;
    const db = getDatabase();
    const captainRows = captainId
      ? await db.prepare(`SELECT c.id, p.name FROM captains c JOIN players p ON p.id = c.player_id
                          WHERE c.draft_id = ? AND c.id = ?`).bind(draftId, captainId).all<{ id: string; name: string }>()
      : await db.prepare(`SELECT c.id, p.name FROM captains c JOIN players p ON p.id = c.player_id
                          WHERE c.draft_id = ? ORDER BY c.team_index`).bind(draftId).all<{ id: string; name: string }>();
    if (!captainRows.results.length) return json({ error: 'Choose a captain whose link should be regenerated.' }, { status: 404 });
    const credentials = await Promise.all(captainRows.results.map(() => createHashedCredential()));
    await db.batch(captainRows.results.map((captain, index) =>
      db.prepare('UPDATE captains SET token = ?, token_hash = ? WHERE id = ? AND draft_id = ?')
        .bind(credentials[index].retired, credentials[index].hash, captain.id, draftId),
    ));
    const links = captainRows.results.map((captain, index) => ({
      captainId: captain.id, name: captain.name, path: `/rank/${credentials[index].token}`,
    }));
    await recordAudit(db, {
      draftId, actorType: 'organizer', eventType: 'captain.links_rotated',
      metadata: { captainIds: links.map((link) => link.captainId) },
    });
    return json({ links });
  } catch (error) {
    console.error('rotate captain links failed', error);
    return json({ error: 'Fresh captain links could not be created.' }, { status: 500 });
  }
}
