import type { Metadata } from 'next';
import Link from 'next/link';
import { BingoTaskArtwork } from '../../components/BingoTaskArtwork';
import { ContentPage } from '../../components/ContentPage';
import { bingoSpeedTargetSeconds, formatTaskTime } from '../../lib/bingo-rules';
import { OSRS_BINGO_PRESETS } from '../../lib/bingo-types';

export const metadata: Metadata = {
  title: 'OSRS bingo task preset library — Terry’s Drafting',
  description: 'Browse 250+ editable OSRS clan bingo tasks across boss uniques, raids, skilling, clues, pets, gear, collection, teamwork, and speed.',
  alternates: { canonical: '/presets' },
};

const sourceNames: Record<string, string> = {
  runelite: 'RuneLite', wise_old_man: 'Wise Old Man', screenshot: 'Screenshot', organizer: 'Organizer',
};

const PAGE_SIZE = 24;

export default async function PresetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = first(params.q).trim().toLocaleLowerCase('en-US').slice(0, 80);
  const requestedCategory = first(params.category);
  const categories = [...new Set(OSRS_BINGO_PRESETS.map((task) => task.category))].sort();
  const category = categories.includes(requestedCategory) ? requestedCategory : 'All';
  const filtered = OSRS_BINGO_PRESETS.filter((task) => {
    if (category !== 'All' && task.category !== category) return false;
    if (!query) return true;
    return [task.title, task.category, task.rule.verifier.target, task.rule.details.notes]
      .join(' ').toLocaleLowerCase('en-US').includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(pageCount, Number(first(params.page)) || 1));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <ContentPage eyebrow="Editable preset library" title={`${OSRS_BINGO_PRESETS.length} starting points for a custom board.`} intro="Every preset can be renamed, re-scored, re-targeted, or combined with a different contributor scope and proof rule. Treat these as design ingredients, not universal point values.">
    <form className="wood-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto]" method="get">
      <label className="text-[10px] font-black uppercase text-[#d8c99e]">Search tasks<input className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={first(params.q)} name="q" placeholder="Bandos chestplate, elite clue, Yama…" /></label>
      <label className="text-[10px] font-black uppercase text-[#d8c99e]">Category<select className="dark-field mt-1 h-11 w-full px-3 text-sm normal-case" defaultValue={category} name="category"><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button className="gold-button self-end px-5 py-3 text-sm" type="submit">Find tasks</button>
    </form>
    <div className="flex flex-wrap gap-2"><Link className="scroll-button px-3 py-2 text-xs no-underline" href="/presets">All</Link>{categories.map((item) => <Link className="scroll-button px-3 py-2 text-xs no-underline" href={`/presets?category=${encodeURIComponent(item)}`} key={item}>{item}</Link>)}</div>
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2>{category === 'All' ? 'Matching tasks' : category}</h2><p className="mt-1 text-sm">{filtered.length} result{filtered.length === 1 ? '' : 's'} · page {page} of {pageCount}</p></div>{(query || category !== 'All') ? <Link href="/presets">Clear filters</Link> : null}</div>
      <div className="grid gap-4 md:grid-cols-2">{visible.map((task) => <article className="parchment-card p-5 text-[#392d1b]" key={task.title}>
        <div className="flex items-start gap-3"><BingoTaskArtwork alt="" className="h-14 w-14 shrink-0" rule={task.rule} /><div className="min-w-0 flex-1"><h3 className="mt-0 text-base text-[#392d1b]">{task.title}</h3>{task.rule.verifier.type === 'collection_log' ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#8a5527]">Optional only · excluded from starter boards</p> : null}</div><span className="seal-badge shrink-0 px-2 py-1 text-[10px] font-black">{task.points} pts</span></div>
        <p className="mt-3 text-xs leading-relaxed text-[#66563d]">{task.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="font-black uppercase text-[#80642b]">Difficulty</dt><dd className="mt-1 capitalize">{task.difficulty}</dd></div><div><dt className="font-black uppercase text-[#80642b]">{bingoSpeedTargetSeconds(task.rule) !== null ? 'Speed target' : 'Expected solo'}</dt><dd className="mt-1 font-black text-[#315b39]">{formatTaskTime(task.rule)}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Signal</dt><dd className="mt-1">{task.rule.verifier.type.replaceAll('_', ' ')}</dd></div><div><dt className="font-black uppercase text-[#80642b]">Scope</dt><dd className="mt-1">{task.rule.scope.type.replaceAll('_', ' ')}</dd></div><div className="col-span-2"><dt className="font-black uppercase text-[#80642b]">Evidence</dt><dd className="mt-1">{task.rule.proof.sources.map((source) => sourceNames[source] ?? source).join(', ')}</dd></div></dl>
        {task.rule.details.notes || task.rule.details.exclusions ? <details className="mt-4 rounded border border-[#8b6a32]/25 bg-white/20 p-3"><summary className="cursor-pointer text-[10px] font-black uppercase text-[#5d4828]">View notes & exclusions</summary>{task.rule.details.notes ? <p className="mt-2 text-xs leading-relaxed text-[#4f402a]"><b>Notes:</b> {task.rule.details.notes}</p> : null}{task.rule.details.exclusions ? <p className="mt-2 text-xs leading-relaxed text-[#4f402a]"><b>Exclusions:</b> {task.rule.details.exclusions}</p> : null}</details> : null}
      </article>)}</div>
      {!visible.length ? <div className="parchment-panel p-8 text-center"><h3>No task matches that search.</h3><p>Try an item name, boss, or broader category.</p></div> : null}
      {pageCount > 1 ? <nav aria-label="Preset pages" className="mt-6 flex items-center justify-center gap-3">{page > 1 ? <Link className="scroll-button px-4 py-2 text-xs no-underline" href={pageHref(page - 1, query, category)}>← Previous</Link> : null}<span className="text-sm font-black">{page} / {pageCount}</span>{page < pageCount ? <Link className="scroll-button px-4 py-2 text-xs no-underline" href={pageHref(page + 1, query, category)}>Next →</Link> : null}</nav> : null}
    </section>
    <h2>Use a preset in a real event.</h2>
    <p>Open the <Link href="/bingo/studio">draft-free board studio</Link> to design, save, and optionally publish a board without creating an event. When teams are ready, use the <Link href="/bingo#create">bingo creator</Link> to launch it. The <Link href="/guides/custom-bingo-maker">board design guide</Link> explains exact targets, artwork, notes, drop rates, party sizes, and proof sources.</p>
  </ContentPage>;
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function pageHref(page: number, query: string, category: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category !== 'All') params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const value = params.toString();
  return value ? `/presets?${value}` : '/presets';
}
