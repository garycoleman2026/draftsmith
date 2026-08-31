'use client';

import { useState } from 'react';
import { BINGO_TEAM_COLOR_OPTIONS } from '../lib/bingo-team-colors';

export function BingoTeamColourPicker({ value, saving = false, label = 'Team colour', onSave }: {
  value: string;
  saving?: boolean;
  label?: string;
  onSave: (color: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const color = draft ?? value;
  const changed = color.toLocaleLowerCase('en-US') !== value.toLocaleLowerCase('en-US');
  return (
    <div className="w-full rounded border border-[#8b6a32]/25 bg-white/20 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.06em] text-[#65583f]">
          {label}
          <input aria-label={label} className="h-8 w-11 cursor-pointer rounded border border-[#71572c] bg-transparent p-0.5" type="color" value={color} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <div aria-label="Team colour presets" className="flex flex-1 flex-wrap gap-1" role="group">
          {BINGO_TEAM_COLOR_OPTIONS.map((option) => <button
            aria-label={`Use ${option.name}`}
            className={`h-6 w-6 rounded-full border-2 ${color === option.value ? 'border-[#24180d] ring-2 ring-[#f4d77c]' : 'border-white/65'}`}
            key={option.value}
            onClick={() => setDraft(option.value)}
            style={{ backgroundColor: option.value }}
            title={option.name}
            type="button"
          />)}
        </div>
        <button className="iron-button px-3 py-2 text-[10px]" disabled={saving || !changed} onClick={() => void Promise.resolve(onSave(color)).then(() => setDraft(null))} type="button">
          {saving ? 'Saving…' : changed ? 'Save colour' : 'Colour saved'}
        </button>
      </div>
    </div>
  );
}
