import { BingoError, bingoErrorResponse, loadBingoView } from '@/lib/bingo';
import { ensureSchema, getDatabase, json } from '@/lib/db';

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await ensureSchema();
    const { slug } = await context.params;
    const event = await getDatabase().prepare('SELECT id FROM bingo_events WHERE public_slug = ?').bind(slug)
      .first<{ id: string }>();
    if (!event) throw new BingoError('That public bingo board was not found.', 404);
    return json(await loadBingoView({ eventId: event.id, viewer: 'public' }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('load public bingo failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
