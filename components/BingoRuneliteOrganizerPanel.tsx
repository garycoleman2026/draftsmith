'use client';

import { useCallback, useEffect, useState } from 'react';
import { RUNELITE_SCOPES, type RuneliteScope } from '../lib/bingo-runelite-core';

type Device = {
  id: string; memberName: string; deviceName: string; pluginVersion: string; scopes: RuneliteScope[];
  connectionState: 'online' | 'idle' | 'offline' | 'waiting'; lastSeenAt: string;
  lastBoardSeenAt: string | null; lastBatchAt: string | null; expiresAt: string;
  lastResult: Diagnostic | null;
};
type DiagnosticResult = { status?: string; message?: string; label?: string };
type Diagnostic = {
  id: string; deviceId: string; memberName: string; teamName: string; kind: string; status: string;
  summary: string; details: { results?: DiagnosticResult[] }; createdAt: string;
};
type Status = {
  enabled: boolean; scopes: RuneliteScope[]; rawChatStored: false; activeDeviceCount: number;
  onlineDeviceCount: number; devices: Device[]; activity: Diagnostic[];
};

const LABELS: Record<RuneliteScope, { name: string; detail: string }> = {
  xp: { name: 'XP & levels', detail: 'Skill XP deltas and level milestones.' },
  loot: { name: 'Loot & collection log', detail: 'Item IDs/names, quantities, pets, and new log slots.' },
  kills: { name: 'Boss kills', detail: 'Supported boss kill-count observations.' },
  raids: { name: 'Raids & times', detail: 'Raid completions, anonymous party size, and completion seconds.' },
  achievements: { name: 'Clues', detail: 'Supported clue completions.' },
};
const CONNECTION_LABELS: Record<Device['connectionState'], string> = {
  online: 'Live', idle: 'Recently seen', offline: 'Offline', waiting: 'Awaiting first sync',
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
  useEffect(() => {
    const initial = window.setTimeout(() => void load().catch((cause) => onError(cause.message)), 0);
    const timer = window.setInterval(() => void load().catch(() => undefined), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load, onError]);

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
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">RuneLite bridge</p><h3 className="fantasy-title mt-1 text-2xl font-bold text-[#f2d98f]">Connection watch.</h3></div><span className={`rounded px-2 py-1 text-[9px] font-black uppercase ${enabled ? 'bg-[#83a267] text-[#15220f]' : 'bg-white/10 text-[#b8aa87]'}`}>{enabled ? `${status?.onlineDeviceCount ?? 0} live` : 'Off'}</span></div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#b8aa87]">Players pair with a one-time code from their private team board. Terry accepts only the categories below and never asks the plugin to upload raw chat text.</p>
      <p className="mt-2 rounded border border-[#83a267]/25 bg-[#22311c] p-2.5 text-[10px] leading-relaxed text-[#c9d894]"><b>No logout needed:</b> paired XP and supported events are sent while the player is logged in, usually reaching the board in about 10–15 seconds. Wise Old Man is the slower snapshot backup.</p>
      <details className="mt-4 rounded border border-white/10 bg-black/15 p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase text-[#d7ae50]">Pairing permissions</summary>
        <label className="mt-3 flex items-center gap-2 text-xs font-black text-[#ead18d]"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Allow players to pair RuneLite</label>
        <div className="mt-3 space-y-2">{RUNELITE_SCOPES.map((scope) => <label className="flex items-start gap-2 rounded border border-white/10 bg-black/20 p-2" key={scope}><input className="mt-0.5" type="checkbox" disabled={!enabled} checked={scopes.includes(scope)} onChange={() => toggle(scope)} /><span><b className="block text-[10px] text-[#ead18d]">{LABELS[scope].name}</b><span className="block text-[9px] leading-relaxed text-[#9f9272]">{LABELS[scope].detail}</span></span></label>)}</div>
        <button className="scroll-button mt-3 w-full px-3 py-2 text-xs" disabled={Boolean(working) || (enabled && !scopes.length)} onClick={() => void save()}>{working === 'save' ? 'Saving…' : 'Save RuneLite permissions'}</button>
      </details>
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-[#d7ae50]">Paired devices</p><span className="text-[10px] text-[#b8aa87]">{status?.onlineDeviceCount ?? 0} live · {status?.activeDeviceCount ?? 0} paired</span></div>
        <div className="mt-2 space-y-2">{status?.devices.map((device) => <article className="rounded border border-white/10 bg-black/20 p-3" key={device.id}>
          <div className="flex items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${device.connectionState === 'online' ? 'bg-[#8fc875]' : device.connectionState === 'idle' ? 'bg-[#d8ad4d]' : 'bg-[#8f8265]'}`} /><b className="text-[10px] text-[#f2d98f]">{device.memberName} · {device.deviceName}</b><span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-[#c8bb98]">{CONNECTION_LABELS[device.connectionState]}</span></div><span className="mt-1 block text-[9px] text-[#9f9272]">v{device.pluginVersion} · contact {relative(device.lastSeenAt)} · board {relative(device.lastBoardSeenAt)}</span></div><button className="text-[9px] font-black text-[#e7b296] underline" disabled={Boolean(working)} onClick={() => void revoke(device.id)}>{working === device.id ? 'Disconnecting…' : 'Disconnect'}</button></div>
          {device.lastResult ? <p className="mt-2 rounded border border-white/10 bg-black/20 p-2 text-[9px] leading-relaxed text-[#c8bb98]"><b className="text-[#ead18d]">Latest:</b> {device.lastResult.summary}</p> : <p className="mt-2 text-[9px] text-[#8f8265]">No gameplay signal or connection test received yet.</p>}
        </article>)}{status && !status.devices.length ? <p className="text-[10px] text-[#9f9272]">No players have paired yet.</p> : null}</div>
      </div>
      <details className="mt-4 border-t border-white/10 pt-3" open>
        <summary className="cursor-pointer text-[10px] font-black uppercase text-[#d7ae50]">Live connection & signal feed</summary>
        <p className="mt-2 text-[9px] leading-relaxed text-[#9f9272]">Players can press <b>Test connection</b> in RuneLite. Gameplay signals say whether they scored, need review, counted toward progress, or matched no tile.</p>
        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">{status?.activity.slice(0, 30).map((item) => <details className="rounded border border-white/10 bg-black/20 p-2.5" key={item.id}><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-2"><p className="text-[9px] font-bold leading-relaxed text-[#d8caa6]">{item.summary}</p><span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${diagnosticTone(item.status)}`}>{item.status}</span></div><p className="mt-1 text-[8px] uppercase text-[#887b5f]">{item.teamName} · {relative(item.createdAt)}</p></summary>{item.details.results?.length ? <div className="mt-2 space-y-1 border-t border-white/10 pt-2">{item.details.results.map((result, index) => <p className="text-[9px] leading-relaxed text-[#b8aa87]" key={`${item.id}-${index}`}><b className="uppercase text-[#d7ae50]">{result.status ?? 'signal'}:</b> {result.message ?? result.label ?? 'Signal received.'}</p>)}</div> : null}</details>)}{status && !status.activity.length ? <p className="text-[10px] text-[#9f9272]">No connection tests or gameplay signals yet.</p> : null}</div>
      </details>
      <a className="mt-3 inline-block text-[10px] font-black text-[#c9d894] underline" href="/runelite" target="_blank" rel="noreferrer">Read the data disclosure & integration guide ↗</a>
    </section>
  );
}

function relative(value: string | null) {
  if (!value) return 'never';
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

function diagnosticTone(status: string) {
  if (status === 'success' || status === 'scored') return 'bg-[#83a267] text-[#15220f]';
  if (status === 'attention' || status === 'ignored') return 'bg-[#b66d4d] text-[#25130d]';
  if (status === 'review') return 'bg-[#d8ad4d] text-[#261c08]';
  return 'bg-white/10 text-[#c8bb98]';
}
