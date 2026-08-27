'use client';

import { useCallback, useEffect, useState } from 'react';
import { copyText } from '../lib/client';
import type { RuneliteScope } from '../lib/bingo-runelite-core';

type Member = { id: string; name: string };
type Device = { id: string; memberId: string; memberName: string; deviceName: string; pluginVersion: string; lastSeenAt: string };
type Status = { enabled: boolean; scopes: RuneliteScope[]; rawChatStored: false; devices: Device[] };
type Pairing = { code: string; memberId: string; memberName: string; expiresAt: string };

const SCOPE_NAMES: Record<RuneliteScope, string> = {
  xp: 'XP/levels', loot: 'loot/log slots', kills: 'boss kills', raids: 'raids/times', achievements: 'achievements/clues',
};

export function BingoRuneliteTeamPanel({ token, members, onNotice, onError }: {
  token: string; members: Member[]; onNotice: (message: string) => void; onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [working, setWorking] = useState('');
  const base = `/api/bingo/team/${encodeURIComponent(token)}/runelite`;
  const load = useCallback(async () => {
    const response = await fetch(base, { cache: 'no-store' });
    const result = await response.json() as Status & { error?: string };
    if (!response.ok) throw new Error(result.error || 'RuneLite devices could not be loaded.');
    setStatus(result);
  }, [base]);
  useEffect(() => { const initial = window.setTimeout(() => void load().catch((cause) => onError(cause.message)), 0); const timer = window.setInterval(() => void load().catch(() => undefined), 15_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load, onError]);

  async function action(body: Record<string, unknown>) {
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json() as Pairing & { error?: string };
    if (!response.ok) throw new Error(result.error || 'RuneLite pairing could not be updated.');
    return result;
  }
  async function issue(memberId: string) {
    setWorking(`pair-${memberId}`); onError(''); setPairing(null);
    try { const result = await action({ action: 'issue', memberId }); setPairing(result); onNotice(`One-time RuneLite code issued for ${result.memberName}.`); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'RuneLite pairing code could not be issued.'); }
    finally { setWorking(''); }
  }
  async function revoke(deviceId: string) {
    setWorking(`revoke-${deviceId}`); onError('');
    try { await action({ action: 'revoke', deviceId }); await load(); onNotice('RuneLite device disconnected.'); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'That device could not be disconnected.'); }
    finally { setWorking(''); }
  }
  async function copyCode() { if (!pairing) return; await copyText(pairing.code); onNotice('Pairing code copied.'); }

  return (
    <section className="wood-panel p-5">
      <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">RuneLite pairing</p><h3 className="fantasy-title mt-1 text-2xl font-bold text-[#f2d98f]">Connect each adventurer.</h3></div><span className={`rounded px-2 py-1 text-[9px] font-black uppercase ${status?.enabled ? 'bg-[#83a267] text-[#15220f]' : 'bg-white/10 text-[#b8aa87]'}`}>{status?.enabled ? 'Open' : 'Organizer off'}</span></div>
      {!status?.enabled ? <p className="mt-3 text-xs leading-relaxed text-[#b8aa87]">The organizer has not enabled RuneLite for this event. Manual claims and screenshots still work.</p> : <>
        <p className="mt-3 text-[10px] leading-relaxed text-[#b8aa87]">Issue a 10-minute code, log into that exact RSN, then enter it in the Terry’s Drafting plugin. One code can connect one device once.</p>
        <p className="mt-2 text-[9px] leading-relaxed text-[#9f9272]">Allowed: {status.scopes.map((scope) => SCOPE_NAMES[scope]).join(', ')}. Raw chat and other players’ names are never sent or stored.</p>
        <div className="mt-4 space-y-2">{members.map((member) => { const devices = status.devices.filter((device) => device.memberId === member.id); return <article className="rounded border border-white/10 bg-black/20 p-3" key={member.id}><div className="flex items-center justify-between gap-2"><div><b className="block text-xs text-[#f2d98f]">{member.name}</b><span className="text-[9px] text-[#9f9272]">{devices.length ? `${devices.length} paired device${devices.length === 1 ? '' : 's'}` : 'Not paired'}</span></div><button className="scroll-button px-2 py-1.5 text-[9px]" disabled={Boolean(working)} onClick={() => void issue(member.id)}>{working === `pair-${member.id}` ? 'Issuing…' : 'Issue code'}</button></div>{devices.map((device) => <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[9px]" key={device.id}><span className="text-[#b8aa87]">{device.deviceName} · v{device.pluginVersion}</span><button className="font-black text-[#e7b296] underline" disabled={Boolean(working)} onClick={() => void revoke(device.id)}>{working === `revoke-${device.id}` ? 'Disconnecting…' : 'Disconnect'}</button></div>)}</article>; })}</div>
        {pairing ? <div className="mt-4 rounded border border-[#d7ae50]/60 bg-black/30 p-4 text-center"><p className="text-[9px] font-black uppercase text-[#d7ae50]">{pairing.memberName} · one-time code</p><button className="mt-2 font-mono text-2xl font-black tracking-[0.12em] text-[#f5df9b]" onClick={() => void copyCode()}>{pairing.code}</button><p className="mt-2 text-[9px] text-[#b8aa87]">Expires {new Date(pairing.expiresAt).toLocaleTimeString()} · click to copy</p></div> : null}
        <a className="mt-3 inline-block text-[10px] font-black text-[#c9d894] underline" href="/runelite" target="_blank" rel="noreferrer">Setup and privacy guide ↗</a>
      </>}
    </section>
  );
}
