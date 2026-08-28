import type { Metadata } from 'next';
import Link from 'next/link';
import { StandaloneBingoCreator, type StandaloneBingoTemplateOption } from '../../components/StandaloneBingoCreator';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';
import { listGalleryTemplates } from '../../lib/bingo-gallery';

export const metadata: Metadata = {
  title: 'Custom OSRS bingo maker and live tracker — Terry’s Drafting',
  description: 'Paste pre-made teams or use a Terry draft, then build 3×3 to 7×7 OSRS bingo boards with custom rules, team claims, evidence review, and live spectators.',
  alternates: { canonical: '/bingo' },
};

const previewTiles = [
  ['Get an Oathplate helm', 180, 'verified'], ['Complete a master clue', 90, 'open'], ['Receive a Berserker ring', 80, 'pending'], ['Gain 1m Runecraft XP', 150, 'open'], ['Mystery finale', 600, 'hidden'],
  ['Full-team GE photo', 40, 'open'], ['Complete one Chambers raid', 100, 'verified'], ['Receive a Twisted kit', 650, 'locked'], ['Receive 3rd age platebody', 700, 'open'], ['Gain 10m Agility XP', 500, 'open'],
  ['Receive an abyssal whip', 65, 'open'], ['Perfect Vardorvis', 55, 'pending'], ['Terry\'s choice', 0, 'free'], ['100 Sepulchre laps', 180, 'open'], ['Receive a skeletal visage', 220, 'verified'],
  ['Sub-17 solo Chambers', 140, 'open'], ['25 Nex kill count', 180, 'open'], ['Complete an Armadyl godsword', 220, 'locked'], ['Reach 99 Agility', 180, 'open'], ['Obtain the Baby mole pet', 900, 'open'],
  ['Receive a Fish barrel', 75, 'open'], ['Gain 2m Mining XP', 180, 'verified'], ['Perfect Theatre', 250, 'open'], ['Receive an imp champion scroll', 240, 'open'], ['GM ToB trio time', 750, 'hidden'],
] as const;

const stateClasses: Record<string, string> = {
  verified: 'border-[#4e7d52] bg-[#d6e1bd] shadow-[inset_0_0_0_2px_rgba(67,108,68,.18)]',
  pending: 'border-[#b27b2e] bg-[#f1d79a]',
  locked: 'border-[#756d61] bg-[#bdb3a0] opacity-80',
  hidden: 'border-[#4f473d] bg-[#625746]',
  free: 'border-[#b08a30] bg-[#f6e6ac]',
  open: 'border-[#9c7933] bg-[#efe0b6]',
};

export default async function BingoHallPage() {
  const gallery = await listGalleryTemplates({ sort: 'popular' });
  const templates: StandaloneBingoTemplateOption[] = [...gallery]
    .sort((left, right) => {
      const leftPriority = left.official && left.configuration.key === 'points' ? 0 : left.official ? 1 : 2;
      const rightPriority = right.official && right.configuration.key === 'points' ? 0 : right.official ? 1 : 2;
      return leftPriority - rightPriority || left.name.localeCompare(right.name);
    })
    .map((template) => ({
      value: template.official ? `builtin:${template.configuration.key}` : `community:${template.id}`,
      name: template.name,
      summary: template.summary,
      meta: `${template.gridSize}×${template.gridSize} · ${template.mode.replaceAll('_', ' ')}`,
      configuration: template.configuration,
    }));
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Live bingo tracker" />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">The next stage after drafting</p>
            <h1 className="fantasy-title mt-3 max-w-4xl text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">Run the whole clan bingo from one great hall.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#b5a888]">Design a custom OSRS bingo, run live scoring and private team claims, review evidence, and publish a spectator board—using teams Terry drafted or rosters your clan already formed.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link className="gold-button inline-flex justify-center px-5 py-3 text-sm" href="#create">Create from existing teams ↓</Link><Link className="scroll-button inline-flex justify-center px-5 py-3 text-sm" href="/bingo/studio">Design a board only →</Link></div>
        </div>

        <StandaloneBingoCreator templates={templates} />

        <div className="mt-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="parchment-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#9b792f]/35 pb-4">
              <div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#876925]">Weekend clan lockout</p><h2 className="fantasy-title mt-1 text-3xl font-bold">The Great Hall board</h2></div>
              <div className="flex gap-2 text-xs font-black"><span className="rounded bg-[#3f6a45] px-3 py-2 text-white">Dragon · 240</span><span className="rounded bg-[#714a79] px-3 py-2 text-white">Raven · 185</span></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {previewTiles.map(([name, points, state], index) => (
                <article className={`relative min-h-28 rounded border p-3 ${state === 'hidden' ? 'text-[#fff0c9]' : 'text-[#392d1b]'} ${stateClasses[state]}`} key={`${name}-${index}`}>
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
              <p className="mt-3 text-sm leading-relaxed text-[#c7b995]">Classic · Points · Lockout · Blackout · Progression · Center-out · Categories</p>
              <p className="mt-2 text-xs leading-relaxed text-[#9f9272]">Build 3 × 3 through 7 × 7 boards from 250+ specific OSRS presets, custom proof rules, unlock paths, and reusable community templates.</p>
            </div>
          </aside>
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="parchment-panel p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#80642b]">The custom maker</p>
            <h2 className="fantasy-title mt-2 text-3xl font-bold sm:text-4xl">Build the rules without waiting for a code change.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#66563d]">Drag presets onto the board, edit the points and target, choose who contributes, require RuneLite, Wise Old Man, screenshots, or organizer review, and make later tiles depend on earlier ones.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {['Get an Oathplate helm', 'Obtain the Baby mole pet', 'Beat the GM ToB trio time', 'Gain 10m team Agility XP'].map((task) => <article className="parchment-card p-4" key={task}><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#80642b]">Editable preset</p><p className="mt-2 text-sm font-black text-[#392d1b]">{task}</p></article>)}
            </div>
          </div>
          <div className="wood-panel p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#d7ae50]">One event, three views</p>
            <div className="mt-5 space-y-4">
              <article className="rounded border border-white/10 bg-black/20 p-4"><p className="font-black text-[#f2d98f]">Organizer room</p><p className="mt-1 text-xs leading-relaxed text-[#b8aa87]">Design the board, issue team links, review claims, and watch verification status.</p></article>
              <article className="rounded border border-white/10 bg-black/20 p-4"><p className="font-black text-[#f2d98f]">Private team board</p><p className="mt-1 text-xs leading-relaxed text-[#b8aa87]">See unlocks, submit proof, and follow live progress without exposing private evidence.</p></article>
              <article className="rounded border border-white/10 bg-black/20 p-4"><p className="font-black text-[#f2d98f]">Spectator board</p><p className="mt-1 text-xs leading-relaxed text-[#b8aa87]">Share a public scoreboard with optional delay, activity, ownership, and standings.</p></article>
            </div>
          </div>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
