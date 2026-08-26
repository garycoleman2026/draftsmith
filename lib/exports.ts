import type { DraftResult } from './types';

export function resultMarkdown(title: string, result: DraftResult) {
  return [`# ${title}`, '', ...result.teams.flatMap((team) => [
    `## Team ${team.teamIndex + 1} — ${team.captain.name} (Captain)`,
    ...team.players.map((player) => `- ${player.name}`), '',
  ])].join('\n').trim();
}

export function resultCsv(result: DraftResult) {
  const rows = [['team', 'role', 'player', 'average_score', 'composite_score']];
  for (const team of result.teams) {
    rows.push([String(team.teamIndex + 1), 'captain', team.captain.name, '', '']);
    for (const player of team.players) rows.push([
      String(team.teamIndex + 1), 'player', player.name,
      player.averageScore == null ? '' : String(player.averageScore),
      player.compositeScore == null ? '' : String(player.compositeScore),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function resultSvg(title: string, result: DraftResult) {
  const width = 1200;
  const columns = result.teams.length <= 4 ? 2 : 3;
  const cardWidth = Math.floor((width - 80 - (columns - 1) * 24) / columns);
  const rows = Math.ceil(result.teams.length / columns);
  const maxPlayers = Math.max(1, ...result.teams.map((team) => team.players.length));
  const cardHeight = 112 + maxPlayers * 30;
  const height = 150 + rows * (cardHeight + 24);
  const cards = result.teams.map((team, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 40 + column * (cardWidth + 24);
    const y = 110 + row * (cardHeight + 24);
    const players = team.players.map((player, playerIndex) =>
      `<text x="${x + 24}" y="${y + 96 + playerIndex * 30}" font-size="18" fill="#342716">${playerIndex + 1}. ${escapeXml(player.name)}</text>`).join('');
    return `<g><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#efdba8" stroke="#8b6a32" stroke-width="2"/>
      <rect x="${x}" y="${y}" width="${cardWidth}" height="8" rx="4" fill="#c99632"/>
      <text x="${x + 24}" y="${y + 42}" font-size="16" font-weight="700" fill="#6d5630">TEAM ${team.teamIndex + 1}</text>
      <text x="${x + 24}" y="${y + 70}" font-size="24" font-weight="800" fill="#23180d">${escapeXml(team.captain.name)} · Captain</text>${players}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#17160e"/>
    <text x="40" y="52" font-size="34" font-family="Georgia,serif" font-weight="800" fill="#f4d77c">${escapeXml(title)}</text>
    <text x="40" y="82" font-size="16" font-family="Arial,sans-serif" fill="#c5b78e">Terry's Drafting · ${escapeXml(result.draftType)} · ${escapeXml(new Date(result.generatedAt).toISOString())}</text>
    <g font-family="Arial,sans-serif">${cards}</g></svg>`;
}

function csvCell(value: string) { return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }
function escapeXml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!); }
