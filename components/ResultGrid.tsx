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
        <button
          type="button"
          onClick={copyTeams}
          className="scroll-button px-4 py-2.5 text-sm"
        >
          {copied ? 'Copied all teams' : 'Copy all teams'}
        </button>
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
    </section>
  );
}
