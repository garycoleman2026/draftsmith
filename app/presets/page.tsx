import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/ContentPage';
import { OSRS_BINGO_PRESETS } from '../../lib/bingo-types';

export const metadata: Metadata = {
  title: 'OSRS bingo task preset library — Terry’s Drafting',
  description: 'Browse more than 60 editable OSRS clan bingo tasks across raids, bosses, skilling, clues, pets, gear, collection, teamwork, and speed.',
  alternates: { canonical: '/presets' },
};

const sourceNames: Record<string, string> = {
  runelite: 'RuneLite', wise_old_man: 'Wise Old Man', screenshot: 'Screenshot', organizer: 'Organizer',
};

export default function PresetsPage() {
  const categories = [...new Set(OSRS_BINGO_PRESETS.map((task) => task.category))].sort();
  return <ContentPage eyebrow="Editable preset library" title={`${OSRS_BINGO_PRESETS.length} starting points for a custom board.`} intro="Every preset can be renamed, re-scored, re-targeted, or combined with a different contributor scope and proof rule. Treat these as design ingredients, not universal point values.">
    <div className="flex flex-wrap gap-2">{categories.map((category) => <a className="scroll-button px-3 py-2 text-xs no-underline" href={`#${slug(category)}`} key={category}>{category}</a>)}</div>
    {categories.map((category) => <section id={slug(category)} key={category}>
      <h2>{category}</h2>
      <div className="grid gap-4 md:grid-cols-2">{OSRS_BINGO_PRESETS.filter((task) => task.category === category).map((task) => <article className="parchment-card p-5 text-[#392d1b]" key={task.title}>
        <div className="flex items-start justify-between gap-3"><h3 className="mt-0 text-base text-[#392d1b]">{task.title}</h3><span className="seal-badge shrink-0 px-2 py-1 text-[10px] font-black">{task.points} pts</span></div>
        <p className="mt-3 text-xs leading-relaxed text-[#66563d]">{task.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="font-black uppercase text-[#80642b]">Difficulty</dt><dd className="mt-1 capitalize">{task.difficulty}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Signal</dt><dd className="mt-1">{task.rule.verifier.type.replaceAll('_', ' ')}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Scope</dt><dd className="mt-1">{task.rule.scope.type.replaceAll('_', ' ')}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Evidence</dt><dd className="mt-1">{task.rule.proof.sources.map((source) => sourceNames[source] ?? source).join(', ')}</dd></div></dl>
      </article>)}</div>
    </section>)}
    <h2>Use a preset in a real event.</h2>
    <p>Draft the roster first, open the bingo hall from the organizer board, choose a built-in format, then replace or edit tiles in the custom maker. The <Link href="/guides/custom-bingo-maker">board design guide</Link> explains how to set exact targets, amounts, party sizes, and proof sources.</p>
  </ContentPage>;
}

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
