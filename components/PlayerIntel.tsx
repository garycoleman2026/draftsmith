'use client';

import { useState } from 'react';
import type { PlayerAnswer } from '../lib/types';

type InsightData = {
  links: { officialHiscores: string; wiseOldMan: string };
  official: { rank: number | null; level: number | null; experience: number | null } | null;
  wiseOldMan: {
    displayName: string;
    accountType: string | null;
    combatLevel: number | null;
    totalLevel: number | null;
    experience: number | null;
    ehp: number | null;
    ehb: number | null;
    updatedAt: string | null;
    weeklyExperience: number | null;
    weeklyEhp: number | null;
  } | null;
};

export function PlayerIntel({
  name,
  answers = [],
  className = 'col-span-full sm:col-start-2',
}: {
  name: string;
  answers?: PlayerAnswer[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InsightData | null>(null);
  const [error, setError] = useState('');

  async function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || data || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/player-insights?name=${encodeURIComponent(name)}`);
      const next = (await response.json()) as InsightData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'Player intelligence is unavailable.');
      setData(next);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Player intelligence is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  const officialUrl = `https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=${encodeURIComponent(name)}`;
  const womUrl = `https://wiseoldman.net/players/${encodeURIComponent(name)}`;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
        <button type="button" className="scroll-button px-2.5 py-1.5" onClick={() => void toggle()}>
          {open ? 'Hide player intel' : 'View player intel'}
        </button>
        <a className="text-[#38562f] underline decoration-[#8b6a32]/55 underline-offset-2" href={officialUrl} target="_blank" rel="noreferrer">Official Hiscores ↗</a>
        <a className="text-[#38562f] underline decoration-[#8b6a32]/55 underline-offset-2" href={womUrl} target="_blank" rel="noreferrer">Wise Old Man ↗</a>
      </div>
      {open ? (
        <div className="mt-3 rounded border border-[#8b6a32]/35 bg-[#ead7a6]/55 p-3 text-xs">
          {answers.length ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {answers.map((answer) => (
                <div key={answer.questionId}>
                  <dt className="font-black text-[#6b5b3c]">{answer.label}</dt>
                  <dd className="mt-0.5 font-semibold text-[#2d2316]">{answer.value}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-[#6b5b3c]">No signup survey answers were collected for this player.</p>}
          <div className={answers.length ? 'mt-3 border-t border-[#8b6a32]/25 pt-3' : 'mt-3'}>
            {loading ? <p className="font-bold text-[#6b5b3c]">Checking live player data…</p> : null}
            {error ? <p className="font-bold text-[#8f3522]">{error}</p> : null}
            {data ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Total level" value={data.official?.level ?? data.wiseOldMan?.totalLevel} />
                <Stat label="Combat" value={data.wiseOldMan?.combatLevel} />
                <Stat label="EHP" value={data.wiseOldMan?.ehp} decimals={1} />
                <Stat label="EHB" value={data.wiseOldMan?.ehb} decimals={1} />
                <Stat label="Total XP" value={data.official?.experience ?? data.wiseOldMan?.experience} compact />
                <Stat label="7-day XP" value={data.wiseOldMan?.weeklyExperience} compact />
                <Stat label="7-day EHP" value={data.wiseOldMan?.weeklyEhp} decimals={2} />
                <Stat label="Overall rank" value={data.official?.rank} compact />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, decimals, compact = false }: { label: string; value: number | null | undefined; decimals?: number; compact?: boolean }) {
  const formatted = value == null
    ? '—'
    : compact
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
      : decimals == null
        ? new Intl.NumberFormat('en').format(value)
        : value.toFixed(decimals);
  return (
    <div className="rounded border border-[#8b6a32]/25 bg-[#fff1c9]/65 px-2.5 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#756748]">{label}</p>
      <p className="mt-1 font-black text-[#2d2316]">{formatted}</p>
    </div>
  );
}
