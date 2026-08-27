import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../components/ContentPage';

export const metadata: Metadata = {
  title: 'About Terry’s Drafting',
  description: 'Why Terry’s Drafting exists, how it approaches fair clan teams and OSRS bingo evidence, and where the open-source RuneLite beta fits.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return <ContentPage eyebrow="About the project" title="Clan events deserve better than a maze of sheets." intro="Terry’s Drafting brings team formation, private captain input, custom bingo design, evidence review, and spectator scoring into one independent community tool.">
    <h2>The problem it solves.</h2>
    <p>Clan organizers often assemble the same fragile workflow: one form for sign-ups, one spreadsheet per captain, a private channel for avoids, another sheet for teams, image uploads for bingo tasks, and a manually updated scoreboard. The tools work, but the organizer becomes the integration.</p>
    <p>Terry’s Drafting keeps each role separate. Participants submit only their own information. Captains receive private ranking areas. Organizers control constraints and run the draft. Bingo teams receive private claim boards. Spectators see only the publishable score.</p>

    <h2>Design principles.</h2>
    <ul>
      <li><strong>Private by role:</strong> captain rankings, avoids, survey answers, and evidence are not placed on the spectator board.</li>
      <li><strong>Explicit rules:</strong> a tile records its target, amount, scope, proof sources, and prerequisites instead of relying on a Discord interpretation.</li>
      <li><strong>Human override:</strong> automation creates evidence and candidates; organizers retain the final event decision.</li>
      <li><strong>Data minimization:</strong> integrations request the smallest task-relevant signal and ignore unrelated gameplay.</li>
      <li><strong>Reusable work:</strong> useful boards become clan templates instead of being rebuilt from scratch.</li>
    </ul>

    <h2>Independent and open where it matters.</h2>
    <p>Terry’s Drafting is not affiliated with Jagex, RuneLite, or Wise Old Man. It uses original presentation rather than copied game branding. The standalone RuneLite beta is public so organizers and Plugin Hub reviewers can inspect exactly what it sends.</p>

    <h2>Current stage.</h2>
    <p>The hosted service includes drafting, sign-ups and surveys, together/apart constraints, private numeric captain scores, live captain picking, custom bingo formats, team claims, spectator scoring, Wise Old Man reconciliation, and the RuneLite service bridge. The plugin source is in beta pending a confirmed in-game test before Plugin Hub submission.</p>

    <p>Start with the <Link href="/guides">organizer guides</Link>, explore the <Link href="/bingo">bingo hall</Link>, or view the <a href="https://github.com/garycoleman2026/draftsmith" target="_blank" rel="noreferrer">website source on GitHub</a>.</p>
  </ContentPage>;
}
