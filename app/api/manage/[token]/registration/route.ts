import { ensureSchema, getDatabase, json } from '../../../../../lib/db';

export async function PUT(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const body = (await request.json()) as { open?: unknown };
    if (typeof body.open !== 'boolean') {
      return json({ error: 'Choose whether registration is open or closed.' }, { status: 400 });
    }
    const db = getDatabase();
    const draft = await db
      .prepare('SELECT id, signup_token FROM drafts WHERE admin_token = ?')
      .bind(token)
      .first<{ id: string; signup_token: string | null }>();
    if (!draft) return json({ error: 'This organizer link is not valid.' }, { status: 404 });
    if (!draft.signup_token) return json({ error: 'This event does not use public registration.' }, { status: 409 });
    const now = new Date().toISOString();
    await db
      .prepare('UPDATE drafts SET registration_open = ?, updated_at = ? WHERE id = ?')
      .bind(body.open ? 1 : 0, now, draft.id)
      .run();
    return json({ registrationOpen: body.open });
  } catch (error) {
    console.error('update registration failed', error);
    return json({ error: 'Registration could not be updated.' }, { status: 500 });
  }
}
