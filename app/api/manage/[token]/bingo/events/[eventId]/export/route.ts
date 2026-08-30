import { bingoErrorResponse, loadBingoView, requireManagedBingoEvent } from '@/lib/bingo';
import { ensureSchema, json } from '@/lib/db';

export async function GET(request: Request, context: { params: Promise<{ token: string; eventId: string }> }) {
  try {
    await ensureSchema();
    const { token, eventId } = await context.params;
    await requireManagedBingoEvent(token, eventId);
    const data = await loadBingoView({ eventId, viewer: 'organizer' });
    const format = new URL(request.url).searchParams.get('format') === 'discord' ? 'discord' : 'csv';
    const safeName = data.event.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'bingo-results';
    if (format === 'discord') {
      const lines = [`**${data.event.title} — standings**`, ...data.teams.sort((a, b) => a.rank - b.rank).map((team) =>
        `${team.rank}. **${team.name}** — ${team.score} points, ${team.completedCount} tiles`), '',
      `Status: ${data.event.status} · ${data.completions.length} verified completions`];
      return file(lines.join('\n'), 'text/plain; charset=utf-8', `${safeName}-discord.txt`);
    }
    const rows = [['Rank', 'Team', 'Score', 'Completed tiles', 'Lines', 'Categories'], ...data.teams
      .sort((a, b) => a.rank - b.rank)
      .map((team) => [team.rank, team.name, team.score, team.completedCount, team.lineCount, team.categoryCount])];
    return file(rows.map((row) => row.map(csv).join(',')).join('\r\n'), 'text/csv; charset=utf-8', `${safeName}-standings.csv`);
  } catch (error) {
    const result = bingoErrorResponse(error);
    return json({ error: result.message }, { status: result.status });
  }
}

function csv(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function file(body: string, type: string, name: string) {
  return new Response(body, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });
}
