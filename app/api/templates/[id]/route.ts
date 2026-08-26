import { requireClanRole } from '../../../../lib/auth';
import { ensureSchema, getDatabase, json } from '../../../../lib/db';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const db = getDatabase();
  const template = await db.prepare('SELECT clan_id FROM event_templates WHERE id = ?').bind(id).first<{ clan_id: string }>();
  if (!template) return json({ error: 'That template was not found.' }, { status: 404 });
  try { await requireClanRole(request, template.clan_id, ['owner', 'admin']); }
  catch (error) { const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 403; return json({ error: error instanceof Error ? error.message : 'Not allowed.' }, { status }); }
  await db.prepare('DELETE FROM event_templates WHERE id = ?').bind(id).run();
  return json({ deleted: true });
}
