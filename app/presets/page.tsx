import type { Metadata } from 'next';
import Link from 'next/link';
import { BingoTaskArtwork } from '../../components/BingoTaskArtwork';
import { ContentPage } from '../../components/ContentPage';
import { expectedIndividualHours, formatExpectedHours } from '../../lib/bingo-rules';
import { OSRS_BINGO_PRESETS } from '../../lib/bingo-types';

export const metadata: Metadata = {
  title: 'OSRS bingo task preset library — Terry’s Drafting',
  description: 'Browse 60 editable OSRS clan bingo tasks across raids, bosses, skilling, clues, pets, gear, collection, teamwork, and speed.',
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
        <div className="flex items-start gap-3"><BingoTaskArtwork alt="" className="h-14 w-14 shrink-0" rule={task.rule} /><h3 className="mt-0 min-w-0 flex-1 text-base text-[#392d1b]">{task.title}</h3><span className="seal-badge shrink-0 px-2 py-1 text-[10px] font-black">{task.points} pts</span></div>
        <p className="mt-3 text-xs leading-relaxed text-[#66563d]">{task.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="font-black uppercase text-[#80642b]">Difficulty</dt><dd className="mt-1 capitalize">{task.difficulty}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Expected solo</dt><dd className="mt-1 font-black text-[#315b39]">{formatExpectedHours(expectedIndividualHours(task.rule))}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Signal</dt><dd className="mt-1">{task.rule.verifier.type.replaceAll('_', ' ')}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Scope</dt><dd className="mt-1">{task.rule.scope.type.replaceAll('_', ' ')}</dd></div><div className="col-span-2"><dt className="font-black uppercase text-[#80642b]">Evidence</dt><dd className="mt-1">{task.rule.proof.sources.map((source) => sourceNames[source] ?? source).join(', ')}</dd></div></dl>
        {task.rule.details.notes || task.rule.details.exclusions ? <details className="mt-4 rounded border border-[#8b6a32]/25 bg-white/20 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-[#5d4828]">View notes & exclusions</summary>{task.rule.details.notes ? <p className="mt-2 text-xs leading-relaxed text-[#4f402a]"><b>Notes:</b> {task.rule.details.notes}</p> : null}{task.rule.details.exclusions ? <p className="mt-2 text-xs leading-relaxed text-[#4f402a]"><b>Exclusions:</b> {task.rule.details.exclusions}</p> : null}</details> : null}
      </article>)}</div>
    </section>)}
    <h2>Use a preset in a real event.</h2>
    <p>Open the <Link href="/bingo#create">bingo creator</Link>, paste existing teams, and choose <strong>Customize board before launch</strong>—or draft a roster first and open the same maker from the organizer room. The <Link href="/guides/custom-bingo-maker">board design guide</Link> explains exact targets, artwork, notes, drop rates, party sizes, and proof sources.</p>
  </ContentPage>;
}

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
