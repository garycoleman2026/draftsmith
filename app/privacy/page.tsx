import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/ContentPage';

export const metadata: Metadata = {
  title: 'Privacy policy — Terry’s Drafting',
  description: 'How Terry’s Drafting handles draft, survey, bingo, Wise Old Man, Discord sign-in, evidence, and RuneLite data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <ContentPage eyebrow="Privacy policy" title="Collect what the event needs. Keep roles separate." intro="Effective August 27, 2026. This policy describes the hosted Terry’s Drafting service and its open-source RuneLite companion.">
    <h2>Information the service processes.</h2>
    <ul>
      <li><strong>Draft and roster data:</strong> event title, in-game display names, team choices, private captain rankings/scores, avoid preferences, and together/apart constraints.</li>
      <li><strong>Sign-up data:</strong> answers to organizer-created survey fields, which may include Discord name, availability, experience, or gear band. Organizers should not request sensitive personal information.</li>
      <li><strong>Account data:</strong> when Discord sign-in is used, the service processes the profile identifiers needed to create a session and administer a clan workspace.</li>
      <li><strong>Bingo data:</strong> boards, claims, notes, evidence links or uploaded screenshots, decisions, scores, and activity history.</li>
      <li><strong>Community discovery:</strong> clan owners may opt a clan profile into the public directory, organizers may separately list individual spectator boards, and signed-in clan administrators may publish reusable templates. Private workspaces, private templates, and unlisted events are excluded.</li>
      <li><strong>Board votes:</strong> a random browser token is stored as an essential cookie and saved only as a hash so one browser can change or remove its own vote without creating a public identity.</li>
      <li><strong>Public OSRS data:</strong> official Hiscores and Wise Old Man information requested for roster insights or event snapshots.</li>
      <li><strong>RuneLite data:</strong> the paired character, task-relevant normalized observations, timestamps, anonymous party size when needed, plugin version, and revocable device information. Raw chat and other players’ names are rejected.</li>
      <li><strong>Operational data:</strong> request metadata such as IP address may be processed by hosting, rate-limiting, and security infrastructure.</li>
    </ul>

    <h2>How information is used.</h2>
    <p>Data is used to create and balance teams, administer sign-ups, enforce event rules, display role-appropriate boards, review evidence, prevent duplicate or abusive requests, operate integrations, diagnose failures, and preserve an event audit trail. Terry’s Drafting does not sell participant information.</p>

    <h2>Who can see what.</h2>
    <p>Private link holders can access the role attached to that link. Captains receive their own input areas. Team links show that team’s board and evidence status. Organizers can review event configuration, survey information authorized for their role, claims, and evidence. Spectator pages receive publishable scores and activity, not private notes or uploaded evidence.</p>

    <h2>Cookies and third parties.</h2>
    <p>The service uses an essential session cookie when a user signs in and an essential browser-scoped token after someone rates a community template. Integrations may send task-specific requests to Discord, Wise Old Man, official Hiscores, and the hosting providers required to run the site. The site does not currently load Google advertising or behavioral analytics cookies. This policy and a consent mechanism will be updated before personalized advertising is enabled.</p>

    <h2>Retention and security.</h2>
    <p>Event records may be retained to keep organizer history and audit decisions available. One-time codes and device credentials are hashed; raw secrets are not stored. RuneLite credentials expire and can be revoked. No internet service can promise perfect security, so organizers should limit survey questions, protect role links, and remove sensitive material from claim notes.</p>

    <h2>Choices and requests.</h2>
    <p>Players can decline RuneLite pairing, disable sharing, or ask a team/organizer to revoke a device. Organizers control whether integrations are enabled. To request access, correction, or deletion, use the <Link href="/contact">contact route</Link> without posting private details publicly; a private verification channel may be required.</p>

    <h2>Changes.</h2>
    <p>Material policy changes will update the effective date on this page. Advertising disclosures will be added before ads are activated.</p>
  </ContentPage>;
}
