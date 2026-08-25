'use client';

import { useState } from 'react';
import { copyText } from '../lib/client';
import { DRAFT_TYPE_LABELS, type DraftResult } from '../lib/types';

const TEAM_COLORS = ['#e16948', '#2d6f5e', '#d2a632', '#6f5ca8', '#3677a7', '#a95572', '#627338', '#ab6a2e'];

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
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d25839]">Draft complete</p>
          <h2 id="team-results-heading" className="mt-1 text-3xl font-black tracking-[-0.04em]">
            Your teams are set.
          </h2>
          <p className="mt-2 text-sm text-[#63736c]">
            {DRAFT_TYPE_LABELS[result.draftType]} · Generated {new Date(result.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={copyTeams}
          className="rounded-xl border border-[#173f35]/15 bg-white px-4 py-2.5 text-sm font-black text-[#173f35] transition hover:-translate-y-0.5 hover:border-[#173f35]/35"
        >
          {copied ? 'Copied all teams' : 'Copy all teams'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.teams.map((team, index) => (
          <article
            key={team.teamIndex}
            className="overflow-hidden rounded-[24px] border border-[#173f35]/12 bg-[#fffdf7] shadow-[0_14px_38px_rgba(23,63,53,.07)]"
          >
            <div className="h-2" style={{ background: TEAM_COLORS[index % TEAM_COLORS.length] }} />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#78857f]">Team {team.teamIndex + 1}</p>
                  <h3 className="mt-1 text-xl font-black tracking-[-0.03em]">{team.captain.name}</h3>
                </div>
                <span className="rounded-full bg-[#f2e4ad] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#5a4510]">Captain</span>
              </div>
              <ol className="mt-5 space-y-2 border-t border-[#173f35]/10 pt-4">
                {team.players.map((player, playerIndex) => (
                  <li className="flex items-center gap-3 rounded-xl bg-[#f6f2e8] px-3 py-2.5" key={player.id}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-[#6b7973]">{playerIndex + 1}</span>
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
