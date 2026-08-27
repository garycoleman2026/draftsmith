'use client';

import { useCallback, useEffect, useState } from 'react';
import { RUNELITE_SCOPES, type RuneliteScope } from '../lib/bingo-runelite-core';

type Device = {
  id: string; memberName: string; deviceName: string; pluginVersion: string; scopes: RuneliteScope[];
  lastSeenAt: string; expiresAt: string;
};
type Status = {
  enabled: boolean; scopes: RuneliteScope[]; rawChatStored: false; activeDeviceCount: number; devices: Device[];
};

const LABELS: Record<RuneliteScope, { name: string; detail: string }> = {
  xp: { name: 'XP & levels', detail: 'Skill XP deltas and level milestones.' },
  loot: { name: 'Loot & collection log', detail: 'Item IDs/names, quantities, pets, and new log slots.' },
  kills: { name: 'Boss kills', detail: 'Supported boss kill-count observations.' },
  raids: { name: 'Raids & times', detail: 'Raid completions, anonymous party size, and completion seconds.' },
  achievements: { name: 'Achievements & clues', detail: 'Combat achievements and clue completions.' },
};

export function BingoRuneliteOrganizerPanel({ base, onNotice, onError }: {
  base: string; onNotice: (message: string) => void; onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [scopes, setScopes] = useState<RuneliteScope[]>([...RUNELITE_SCOPES]);
  const [working, setWorking] = useState('');
  const load = useCallback(async () => {
    const response = await fetch(`${base}/runelite`, { cache: 'no-store' });
    const result = await response.json() as Status & { error?: string };
    if (!response.ok) throw new Error(result.error || 'RuneLite settings could not be loaded.');
    setStatus(result); setEnabled(result.enabled); setScopes(result.scopes);
  }, [base]);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch((cause) => onError(cause.message)), 0); return () => window.clearTimeout(timer); }, [load, onError]);

  function toggle(scope: RuneliteScope) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }
  async function save() {
    setWorking('save'); onError('');
    try {
      const response = await fetch(`${base}/runelite`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, scopes }),
      });
      const result = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(result.error || 'RuneLite settings could not be saved.');
      setStatus(result); setEnabled(result.enabled); setScopes(result.scopes);
      onNotice(result.enabled ? 'RuneLite pairing is enabled with the selected data scopes.' : 'RuneLite pairing is disabled and active device credentials were revoked.');
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'RuneLite settings could not be saved.'); }
    finally { setWorking(''); }
  }
  async function revoke(deviceId: string) {
    setWorking(deviceId); onError('');
    try {
      const response = await fetch(`${base}/runelite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', deviceId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'That device could not be disconnected.');
      await load(); onNotice('RuneLite device disconnected.');
    } catch (cause) { onError(cause instanceof Error ? cause.message : 'That device could not be disconnected.'); }
    finally { setWorking(''); }
  }

  return (
    <section className="wood-panel p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">RuneLite bridge</p><h3 className="fantasy-title mt-1 text-2xl font-bold text-[#f2d98f]">Near-live, permissioned signals.</h3></div><span className={`rounded px-2 py-1 text-[9px] font-black uppercase ${enabled ? 'bg-[#83a267] text-[#15220f]' : 'bg-white/10 text-[#b8aa87]'}`}>{enabled ? 'Enabled' : 'Off'}</span></div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#b8aa87]">Players pair with a one-time code from their private team board. Terry accepts only the categories below and never asks the plugin to upload raw chat text.</p>
      <label className="mt-4 flex items-center gap-2 text-xs font-black text-[#ead18d]"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Allow players to pair RuneLite</label>
      <div className="mt-3 space-y-2">{RUNELITE_SCOPES.map((scope) => <label className="flex items-start gap-2 rounded border border-white/10 bg-black/20 p-2" key={scope}><input className="mt-0.5" type="checkbox" disabled={!enabled} checked={scopes.includes(scope)} onChange={() => toggle(scope)} /><span><b className="block text-[10px] text-[#ead18d]">{LABELS[scope].name}</b><span className="block text-[9px] leading-relaxed text-[#9f9272]">{LABELS[scope].detail}</span></span></label>)}</div>
      <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={Boolean(working) || (enabled && !scopes.length)} onClick={() => void save()}>{working === 'save' ? 'Saving…' : 'Save RuneLite permissions'}</button>
      <div className="mt-4 border-t border-white/10 pt-3"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-[#d7ae50]">Paired devices</p><span className="text-[10px] text-[#b8aa87]">{status?.activeDeviceCount ?? 0} active</span></div><div className="mt-2 space-y-2">{status?.devices.map((device) => <article className="rounded border border-white/10 bg-black/20 p-2" key={device.id}><div className="flex items-start justify-between gap-2"><div><b className="block text-[10px] text-[#f2d98f]">{device.memberName} · {device.deviceName}</b><span className="text-[9px] text-[#9f9272]">v{device.pluginVersion} · seen {relative(device.lastSeenAt)}</span></div><button className="text-[9px] font-black text-[#e7b296] underline" disabled={Boolean(working)} onClick={() => void revoke(device.id)}>{working === device.id ? 'Disconnecting…' : 'Disconnect'}</button></div></article>)}{status && !status.devices.length ? <p className="text-[10px] text-[#9f9272]">No players have paired yet.</p> : null}</div></div>
      <a className="mt-3 inline-block text-[10px] font-black text-[#c9d894] underline" href="/runelite" target="_blank" rel="noreferrer">Read the data disclosure & integration guide ↗</a>
    </section>
  );
}

function relative(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}
