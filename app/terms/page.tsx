import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/ContentPage';

export const metadata: Metadata = {
  title: 'Terms of use — Terry’s Drafting',
  description: 'Rules for using the Terry’s Drafting clan draft, bingo tracker, integrations, private links, and open-source RuneLite beta.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <ContentPage eyebrow="Terms of use" title="Use the hall fairly." intro="Effective August 27, 2026. By using the hosted beta, you agree to these practical rules and acknowledge its current limitations.">
    <h2>Community event service.</h2>
    <p>Terry’s Drafting provides tools for organizing teams and community competitions. It is not affiliated with or endorsed by Jagex, RuneLite, or Wise Old Man, and it does not grant any rights in their names, data, or services.</p>

    <h2>Your responsibilities.</h2>
    <ul>
      <li>Use the service lawfully and follow the rules of the game, community, and third-party services you connect.</li>
      <li>Do not use the site to harass players, publish private information, upload unlawful material, manipulate ad traffic, attack the service, or evade rate limits.</li>
      <li>Ask only necessary survey questions and tell participants how their answers will be used.</li>
      <li>Protect organizer, captain, participant, and team bearer links. Actions taken through a shared link may be treated as authorized for that role.</li>
      <li>Review high-impact or disputed claims instead of treating an integration as infallible.</li>
    </ul>

    <h2>Submitted content.</h2>
    <p>You retain responsibility for event names, surveys, task text, claim notes, links, evidence, public clan descriptions, and community templates you submit. You grant the service permission to store, process, and display that material only as needed to operate the event and its selected public views. Do not submit content you lack permission to use. Public listings or ratings may be limited or removed when they are deceptive, abusive, infringing, unsafe, or manipulated.</p>

    <h2>Beta availability.</h2>
    <p>The service is provided as available. Features, limits, integrations, and free access may change. External services can be delayed or unavailable, and game or client updates can break a detector. You remain responsible for event rules, backups of important information, awards, and final decisions.</p>

    <h2>No gameplay automation.</h2>
    <p>The RuneLite companion reports opted-in event observations and displays information. It does not control gameplay, automate input, or guarantee that a completion is valid.</p>

    <h2>Enforcement and changes.</h2>
    <p>Access may be limited for abuse, security risk, policy violations, or operational necessity. Material term changes update the effective date. Continued use after a change means you accept the revised terms.</p>

    <p>See the <Link href="/privacy">privacy policy</Link> or <Link href="/contact">contact page</Link>.</p>
  </ContentPage>;
}
