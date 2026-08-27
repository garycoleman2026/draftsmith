import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/ContentPage';

export const metadata: Metadata = {
  title: 'Frequently asked questions — Terry’s Drafting',
  description: 'Answers about clan drafts, captain privacy, custom OSRS bingo rules, RuneLite, Wise Old Man, public boards, and pricing.',
  alternates: { canonical: '/faq' },
};

const questions = [
  ['Is Terry’s Drafting free?', 'The hosted beta is currently free. There is no paid tier or guarantee that every future feature will remain free. Any pricing or advertising change will be disclosed before it affects organizers.'],
  ['Can captains see one another’s rankings or avoids?', 'No. Each captain receives a separate private link. The organizer can see completion status and manage the event; captain inputs are not published on the team result or spectator pages.'],
  ['Do I need to upload a player list?', 'No. Organizers can paste/import a roster or open a sign-up link with a custom survey. Sign-ups can collect fields such as Discord name, expected playtime, game knowledge, gear band, or raid experience.'],
  ['Which draft styles are available?', 'Consensus balance, simulated captain snake, random draw, and real-time captain picking are built in. Live picking supports configurable order, timers, and optional auto-picks.'],
  ['Can two players be kept together or apart?', 'Yes. Organizers can create together/apart constraints. They should use them deliberately because too many hard constraints can make a fair assignment impossible.'],
  ['Can I make a custom OSRS bingo?', 'Yes. Boards can be 3 × 3 through 7 × 7 with classic, points, lockout, blackout, progression, or category scoring. Presets are editable, and custom rows can be pasted in bulk.'],
  ['Do I have to run a draft before making a bingo?', 'No. If your clan already has teams, paste each team name and roster into the bingo hall. Terry creates the same organizer room, private team links, custom board editor, spectator page, Wise Old Man controls, and RuneLite pairing flow.'],
  ['Does RuneLite automatically prove every tile?', 'No. The beta sends only supported, task-relevant observations. Those reports are useful evidence but not cryptographic proof. Unsupported or ambiguous tasks remain manual, screenshot-based, or organizer-reviewed.'],
  ['Does the RuneLite plugin send chat or teammate names?', 'No raw chat is transmitted or stored. Supported game messages are parsed locally and discarded. Other players’ names are not sent; exact-party rules use only an anonymous party count.'],
  ['How does Wise Old Man fit in?', 'An organizer may connect a Wise Old Man group and capture baseline, checkpoint, or final snapshots. Terry turns supported public changes into versioned verification signals and records coverage or failures for review.'],
  ['Are private links passwords?', 'They are bearer links: anyone who receives one can use that role. Treat organizer, captain, participant, and team links as secrets. Revoke RuneLite devices when they are no longer needed and avoid posting private links publicly.'],
] as const;

export default function FaqPage() {
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) };
  return <ContentPage eyebrow="Questions & answers" title="What organizers and players usually ask." intro="These answers describe the current hosted beta. Event-specific rules set by a clan organizer still control that clan’s competition.">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c') }} />
    <section className="grid gap-3">{questions.map(([question, answer]) => <details className="wood-panel p-5" key={question}><summary className="cursor-pointer font-black text-[#f2d98f]">{question}</summary><p className="mt-3 text-sm leading-relaxed text-[#c5b794]">{answer}</p></details>)}</section>
    <p>Need a workflow rather than a short answer? Visit the <Link href="/guides">organizer guides</Link>.</p>
  </ContentPage>;
}
