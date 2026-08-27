import { BingoError, bingoErrorResponse, loadBingoView, resolveBingoTeam } from '@/lib/bingo';
import { ensureSchema, json } from '@/lib/db';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await ensureSchema();
    const { token } = await context.params;
    const team = await resolveBingoTeam(token);
    if (!team) throw new BingoError('This private team link is not valid.', 404);
    return json(await loadBingoView({ eventId: team.event_id, viewer: 'team', teamId: team.id }));
  } catch (error) {
    const result = bingoErrorResponse(error);
    if (result.status >= 500) console.error('load team bingo failed', error);
    return json({ error: result.message }, { status: result.status });
  }
}
