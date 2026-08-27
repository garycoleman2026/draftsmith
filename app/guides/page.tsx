import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/ContentPage';

export const metadata: Metadata = {
  title: 'OSRS clan drafting and bingo guides — Terry’s Drafting',
  description: 'Practical guides for planning an OSRS clan bingo, designing fair custom boards, and combining RuneLite, Wise Old Man, and organizer review.',
  alternates: { canonical: '/guides' },
};

const guides = [
  { href: '/guides/osrs-clan-bingo', label: 'Event planning', title: 'How to run an OSRS clan bingo', detail: 'A start-to-finish organizer playbook: sign-ups, captain rankings, board balance, evidence, scoring, and event closeout.' },
  { href: '/guides/custom-bingo-maker', label: 'Board design', title: 'Build a custom bingo that stays fun', detail: 'Turn tasks such as an Oathplate helm, Mole pet, Twisted kit, raid speed, or 10m team Agility XP into precise, testable rules.' },
  { href: '/guides/runelite-tracking', label: 'Verification', title: 'RuneLite and Wise Old Man tracking', detail: 'Choose the right source for each task, understand update speed, protect player privacy, and keep organizers in control.' },
] as const;

export default function GuidesPage() {
  return <ContentPage eyebrow="Organizer field manual" title="Run better clan events." intro="Terry’s guides focus on the decisions that make an event fair, understandable, and manageable—not just the buttons in the app.">
    <section className="grid gap-5 md:grid-cols-3">
      {guides.map((guide) => <Link className="wood-panel block p-5 no-underline transition hover:-translate-y-1" href={guide.href} key={guide.href}><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d7ae50]">{guide.label}</p><h2 className="fantasy-title mt-3 text-2xl font-bold text-[#f2d98f]">{guide.title}</h2><p className="mt-3 text-xs leading-relaxed text-[#c5b794]">{guide.detail}</p><span className="mt-5 inline-block text-xs font-black text-[#d9e7aa]">Read guide →</span></Link>)}
    </section>
    <h2>Start with a format, then customize the pressure.</h2>
    <p>A good bingo is not simply a board of rare drops. It mixes quick wins, steady progress, specialist challenges, team moments, and a small number of headline tiles. The format determines how teams interact: a points hunt rewards breadth, lockout creates direct competition, progression controls pacing, and category conquest prevents one strong specialty from deciding the whole event.</p>
    <p>The custom maker supports each of those patterns. Use the guides to decide what a completion means, who may contribute, which evidence source is appropriate, and what should happen when automation is uncertain.</p>
  </ContentPage>;
}
