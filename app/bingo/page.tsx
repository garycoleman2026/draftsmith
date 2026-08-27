import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';

const previewTiles = [
  ['First blood', 25, 'verified'], ['Treasure trail', 40, 'open'], ['Boss unique', 80, 'pending'], ['Gain a level', 30, 'open'], ['Mystery task', 60, 'hidden'],
  ['Team photo', 25, 'open'], ['Raid clear', 100, 'verified'], ['Collection slot', 75, 'locked'], ['Clue reward', 45, 'open'], ['Million XP', 90, 'open'],
  ['Slayer drop', 55, 'open'], ['Perfect kill', 85, 'pending'], ['Terry\'s choice', 0, 'free'], ['Skill challenge', 50, 'open'], ['Rare catch', 65, 'verified'],
  ['Speed task', 70, 'open'], ['Group boss', 110, 'open'], ['Gear upgrade', 60, 'locked'], ['Diary task', 35, 'open'], ['Pet chance', 125, 'open'],
  ['Minigame win', 40, 'open'], ['Resource stack', 30, 'verified'], ['Combat feat', 95, 'open'], ['Fashion task', 20, 'open'], ['Final challenge', 150, 'hidden'],
] as const;

const stateClasses: Record<string, string> = {
  verified: 'border-[#4e7d52] bg-[#d6e1bd] shadow-[inset_0_0_0_2px_rgba(67,108,68,.18)]',
  pending: 'border-[#b27b2e] bg-[#f1d79a]',
  locked: 'border-[#756d61] bg-[#bdb3a0] opacity-80',
  hidden: 'border-[#4f473d] bg-[#625746] text-[#f0dfb7]',
  free: 'border-[#b08a30] bg-[#f6e6ac]',
  open: 'border-[#9c7933] bg-[#efe0b6]',
};

export default function BingoHallPage() {
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Live bingo tracker" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">The next stage after drafting</p>
            <h1 className="fantasy-title mt-3 max-w-4xl text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">Run the whole clan bingo from one great hall.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#b5a888]">Live scoring, private team claims, evidence review, reusable boards, and a public activity feed—all connected to the teams Terry already forged.</p>
          </div>
          <Link className="gold-button inline-flex justify-center px-5 py-3 text-sm" href="/">Draft the teams first →</Link>
        </div>

        <div className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="parchment-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#9b792f]/35 pb-4">
              <div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#876925]">Weekend clan lockout</p><h2 className="fantasy-title mt-1 text-3xl font-bold">The Great Hall board</h2></div>
              <div className="flex gap-2 text-xs font-black"><span className="rounded bg-[#3f6a45] px-3 py-2 text-white">Dragon · 240</span><span className="rounded bg-[#714a79] px-3 py-2 text-white">Raven · 185</span></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {previewTiles.map(([name, points, state], index) => (
                <article className={`relative min-h-28 rounded border p-3 text-[#392d1b] ${stateClasses[state]}`} key={`${name}-${index}`}>
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] opacity-70">{state === 'verified' ? '✓ Claimed' : state === 'pending' ? '⏳ Review' : state === 'hidden' ? '???' : state}</span>
                  <p className="mt-2 text-sm font-black leading-tight">{state === 'hidden' ? 'Unrevealed task' : name}</p>
                  <p className="absolute bottom-2 right-3 text-xs font-black">{points ? `${points} pts` : 'FREE'}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="wood-panel p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Live activity</p>
            <div className="mt-5 space-y-4 text-sm">
              <div className="border-l-2 border-[#6da270] pl-3"><p className="font-black">Team Dragon claimed Raid clear</p><p className="mt-1 text-xs text-[#b8aa87]">Verified · +100 points</p></div>
              <div className="border-l-2 border-[#d5a34b] pl-3"><p className="font-black">Perfect kill submitted</p><p className="mt-1 text-xs text-[#b8aa87]">Waiting for organizer review</p></div>
              <div className="border-l-2 border-[#8f6b98] pl-3"><p className="font-black">Team Raven claimed Resource stack</p><p className="mt-1 text-xs text-[#b8aa87]">Verified · +30 points</p></div>
            </div>
            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#d7ae50]">Built-in halls</p>
              <p className="mt-3 text-sm leading-relaxed text-[#c7b995]">Classic · Points · Lockout</p>
              <p className="mt-2 text-xs leading-relaxed text-[#9f9272]">Custom 5 × 5 task boards and reusable clan templates are included.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
