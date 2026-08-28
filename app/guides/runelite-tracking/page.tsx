import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../../components/ContentPage';

export const metadata: Metadata = {
  title: 'RuneLite and Wise Old Man bingo tracking — Terry’s Drafting',
  description: 'Understand OSRS bingo update speed, RuneLite pairing, Wise Old Man snapshots, evidence confidence, privacy, and organizer review.',
  alternates: { canonical: '/guides/runelite-tracking' },
};

export default function TrackingGuidePage() {
  return <ContentPage eyebrow="Bingo verification guide" title="Fast signals, durable evidence, human judgment." intro="No single source can prove every OSRS bingo condition. Terry combines near-live plugin observations, public stat snapshots, screenshots, and organizer review without pretending that client data is cryptographic proof.">
    <h2>How often does the board update?</h2>
    <table><thead><tr><th>Source</th><th>Typical cadence</th><th>Good for</th></tr></thead><tbody>
      <tr><td>RuneLite overlay</td><td>Polls the event revision about every 5 seconds while logged in and sharing is enabled.</td><td>Team score, standing, open tasks, and capture plan.</td></tr>
      <tr><td>RuneLite observations</td><td>Queued in memory and sent in batches within about 10 seconds, or sooner when a batch fills.</td><td>Relevant XP, levels, loot, boss kills, supported raid messages, and clues.</td></tr>
      <tr><td>Wise Old Man</td><td>Organizer baseline/checkpoint/final runs; optional interval from 1–24 hours, default 6.</td><td>Public XP, levels, and supported kill-count deltas across a roster.</td></tr>
      <tr><td>Manual/screenshot</td><td>Visible immediately as pending; score changes after organizer approval.</td><td>Visual conditions, unusual rules, or integration gaps.</td></tr>
    </tbody></table>

    <h2>The RuneLite pairing flow.</h2>
    <ol>
      <li>The organizer enables only the data categories needed for the event.</li>
      <li>A private team board issues a one-use code for one roster member. It expires after ten minutes.</li>
      <li>The player enables sharing after RuneLite shows the third-party-server warning, reviews the disclosure, and enters the code while logged into the exact character.</li>
      <li>The service returns a revocable event credential. It is not a Jagex or RuneLite account token.</li>
      <li>The plugin downloads a capture plan and ignores gameplay events that are irrelevant to the current board.</li>
    </ol>

    <h2>What leaves the client—and what does not.</h2>
    <p>A normalized observation may contain the paired character, event-specific target such as a skill/item/boss, an amount or duration, a timestamp, a stable retry identifier, and an anonymous party size when the task requires one. Raw chat is parsed locally and discarded. Other players’ names are rejected at the service boundary.</p>
    <p>The plugin does not request passwords, launcher tokens, bank contents, full inventory/equipment, friends lists, private messages, clan chat, or continuous location history. Sharing is off by default, stops outside a live paired event, and can be revoked by the player, team, or organizer.</p>

    <h2>Why retries do not double-score.</h2>
    <p>Every local observation receives a stable client event ID. A batch retains the same key until the server acknowledges it. The service namespaces local IDs by device and also supports an anonymous shared-encounter fingerprint for boss/raid reports from several paired clients. Database uniqueness and the verification event history make repeated requests idempotent.</p>

    <h2>Confidence is a ladder, not a green check.</h2>
    <ul>
      <li><strong>Reported:</strong> a player submitted the condition for review.</li>
      <li><strong>Observed:</strong> one RuneLite signal matched the task rule.</li>
      <li><strong>Verified:</strong> a supported Wise Old Man change reached the threshold.</li>
      <li><strong>Corroborated:</strong> more than one independent source supports completion.</li>
      <li><strong>Reviewed:</strong> an organizer made the final decision.</li>
    </ul>
    <p>Events can require review for all completions. Automatic candidates remain inspectable, and a rejected candidate does not erase its source history.</p>

    <h2>Known beta boundaries.</h2>
    <p>Client messages and game APIs change. Some encounter conditions cannot be identified reliably without collecting more than the task needs, so the plugin deliberately declines to guess. Pet notices are automatically attributed only when one relevant pet target is unambiguous. Exact-party raid rules depend on the player’s anonymous party-size setting. Screenshot-only tasks remain on the web board.</p>
    <p>That conservative behavior is a feature: a missed automatic claim can be reviewed manually; an invented completion can damage the event.</p>

    <h2>How to test the beta safely.</h2>
    <ol>
      <li>Clone the <a href="https://github.com/garycoleman2026/terrys-drafting-runelite" target="_blank" rel="noreferrer">public plugin repository</a> and use Java 11.</li>
      <li>Run the unit suite with <code>./gradlew test</code>, then launch developer mode with <code>./gradlew run</code>.</li>
      <li>Use a disposable event and test one XP task, one matching drop, one manual claim, one disconnect, and one switched-character rejection.</li>
      <li>Confirm the overlay in real gameplay before any Plugin Hub submission.</li>
    </ol>
    <p>See the concise <Link href="/runelite">pairing and privacy page</Link>, or return to the <Link href="/guides/osrs-clan-bingo">event organizer guide</Link>.</p>
  </ContentPage>;
}
