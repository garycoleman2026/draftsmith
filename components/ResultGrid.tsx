'use client';

import { useState } from 'react';
import { copyText } from '../lib/client';
import { DRAFT_TYPE_LABELS, type DraftResult } from '../lib/types';

const TEAM_COLORS = ['#9f4f32', '#3f6a45', '#b18a31', '#66527d', '#3f6577', '#7c4554', '#60733e', '#9a622c'];

export function ResultGrid({ result, title }: { result: DraftResult; title: string }) {
  const [copied, setCopied] = useState(false);
  const formatted = result.teams
    .map(
      (team) =>
        `TEAM ${team.teamIndex + 1} — ${team.captain.name} (Captain)\n${team.players
          .map((player) => player.name)
          .join('\n')}`,
    )
    .join('\n\n');

  async function copyTeams() {
    await copyText(`${title}\n${DRAFT_TYPE_LABELS[result.draftType]}\n\n${formatted}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadPng() {
    const scale = 2;
    const width = 1200;
    const columns = result.teams.length <= 4 ? 2 : 3;
    const cardWidth = Math.floor((width - 80 - (columns - 1) * 24) / columns);
    const maxPlayers = Math.max(1, ...result.teams.map((team) => team.players.length));
    const cardHeight = 112 + maxPlayers * 30;
    const height = 150 + Math.ceil(result.teams.length / columns) * (cardHeight + 24);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(scale, scale);
    context.fillStyle = '#17160e'; context.fillRect(0, 0, width, height);
    context.fillStyle = '#f4d77c'; context.font = 'bold 34px Georgia'; context.fillText(title, 40, 52);
    context.fillStyle = '#c5b78e'; context.font = '16px Arial'; context.fillText("Terry's Drafting · team results", 40, 82);
    result.teams.forEach((team, index) => {
      const x = 40 + (index % columns) * (cardWidth + 24);
      const y = 110 + Math.floor(index / columns) * (cardHeight + 24);
      context.fillStyle = '#efdba8'; context.fillRect(x, y, cardWidth, cardHeight);
      context.fillStyle = TEAM_COLORS[index % TEAM_COLORS.length]; context.fillRect(x, y, cardWidth, 8);
      context.fillStyle = '#6d5630'; context.font = 'bold 16px Arial'; context.fillText(`TEAM ${team.teamIndex + 1}`, x + 24, y + 42);
      context.fillStyle = '#23180d'; context.font = 'bold 23px Arial'; context.fillText(`${team.captain.name} · Captain`, x + 24, y + 70, cardWidth - 48);
      context.font = '18px Arial';
      team.players.forEach((player, playerIndex) => context.fillText(`${playerIndex + 1}. ${player.name}`, x + 24, y + 100 + playerIndex * 30, cardWidth - 48));
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'terrys-draft'}-teams.png`;
      link.click(); URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return (
    <section aria-labelledby="team-results-heading">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#c69b3c]">Draft complete</p>
          <h2 id="team-results-heading" className="fantasy-title mt-1 text-3xl font-bold text-[#f5df9b]">
            Your teams are set.
          </h2>
          <p className="mt-2 text-sm text-[#b5a888]">
            {DRAFT_TYPE_LABELS[result.draftType]} · Generated {new Date(result.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={copyTeams} className="scroll-button px-4 py-2.5 text-sm">{copied ? 'Copied all teams' : 'Copy all teams'}</button><button type="button" onClick={downloadPng} className="scroll-button px-4 py-2.5 text-sm">Download PNG</button></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.teams.map((team, index) => (
          <article
            key={team.teamIndex}
            className="parchment-panel overflow-hidden"
          >
            <div className="h-2" style={{ background: TEAM_COLORS[index % TEAM_COLORS.length] }} />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#78857f]">Team {team.teamIndex + 1}</p>
                  <h3 className="fantasy-title mt-1 text-xl font-bold">{team.captain.name}</h3>
                </div>
                <span className="seal-badge px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em]">Captain</span>
              </div>
              <ol className="mt-5 space-y-2 border-t border-[#173f35]/10 pt-4">
                {team.players.map((player, playerIndex) => (
                  <li className="flex items-center gap-3 rounded border border-[#8b6a32]/30 bg-[#f6e5b6]/72 px-3 py-2.5" key={player.id}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#8b6a32]/45 bg-[#fff2c9] text-xs font-black text-[#675333]">{playerIndex + 1}</span>
                    <span className="font-bold">{player.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </div>
      {result.avoidOverrides > 0 ? (
        <p className="mt-4 rounded-xl border border-[#d2a632]/30 bg-[#fff6d8] px-4 py-3 text-sm text-[#66520e]">
          {result.avoidOverrides} avoid preference{result.avoidOverrides === 1 ? '' : 's'} could not be satisfied without leaving a team short.
        </p>
      ) : null}
      {(result.constraintOverrides ?? 0) > 0 ? (
        <p className="mt-4 rounded-xl border border-[#b65a3a]/30 bg-[#f8d7c2] px-4 py-3 text-sm text-[#74301f]">
          {result.constraintOverrides} roster rule{result.constraintOverrides === 1 ? '' : 's'} could not be satisfied because of team capacity or a conflicting rule.
        </p>
      ) : null}
      {result.fairness ? <div className="mt-5 grid gap-3 rounded border border-[#8b6a32]/40 bg-[#ead8a8]/90 p-4 text-[#332617] sm:grid-cols-4"><FairnessStat label="Strength spread" value={result.fairness.strengthSpread} /><FairnessStat label="Std. deviation" value={result.fairness.standardDeviation} /><FairnessStat label="Soft violations" value={result.fairness.softViolations} /><FairnessStat label="Avoid conflicts" value={result.fairness.avoidViolations} /></div> : null}
    </section>
  );
}

function FairnessStat({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#756748]">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}
