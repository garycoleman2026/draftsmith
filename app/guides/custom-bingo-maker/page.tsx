import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../../components/ContentPage';

export const metadata: Metadata = {
  title: 'OSRS custom bingo maker guide — Terry’s Drafting',
  description: 'Design custom OSRS bingo tasks, layouts, proof rules, unlock paths, scoring, and reusable clan presets with concrete examples.',
  alternates: { canonical: '/guides/custom-bingo-maker' },
};

export default function CustomMakerGuidePage() {
  return <ContentPage eyebrow="Custom bingo maker" title="Make unusual rules without commissioning a new feature." intro="Most custom ideas can be expressed as data: a title, target, amount, contributor scope, evidence source, points value, and relationship to other tiles. Code is reserved for genuinely new kinds of game evidence.">
    <h2>Start with the board—not an event.</h2>
    <p>The <Link href="/bingo/studio">board studio</Link> works without teams, dates, a draft, or a live bingo. Start from an official or community template, edit the entire board, then save it privately or publish it to the marketplace. When the rules are ready, the <Link href="/bingo#create">bingo hall</Link> can launch the design with pre-made rosters, or a Terry draft can provide the teams.</p>

    <h2>What organizers can build today.</h2>
    <p>The maker supports 3 × 3 through 7 × 7 boards, seven official starters, more than 250 editable OSRS presets, item or boss artwork, notes, exclusions, source links, expected-time assumptions, hidden tiles, free spaces, repeat limits, task prerequisites, shared or per-team progression, private saves, and public community templates. You can paste tasks as rows for fast bulk editing or tune each rule in the visual editor.</p>

    <h2>The anatomy of a precise tile.</h2>
    <table><thead><tr><th>Field</th><th>Question it answers</th><th>Example</th></tr></thead><tbody>
      <tr><td>Title</td><td>What should players understand at a glance?</td><td>Get an Oathplate helm</td></tr>
      <tr><td>Verifier</td><td>What normalized event completes it?</td><td>Item acquired</td></tr>
      <tr><td>Target</td><td>Which item, boss, raid, skill, or achievement?</td><td>Oathplate helm</td></tr>
      <tr><td>Amount/comparator</td><td>How much, or how fast?</td><td>1 item; at least 1</td></tr>
      <tr><td>Scope</td><td>One member, any member, exact party, or whole team?</td><td>Any team member</td></tr>
      <tr><td>Proof</td><td>Which sources may support the claim?</td><td>RuneLite plus organizer review</td></tr>
      <tr><td>Artwork/details</td><td>What image, notes, exclusions, and source should players see?</td><td>Oathplate helm image; contract reward excluded</td></tr>
      <tr><td>Planning</td><td>What is the individual drop rate and efficient attempts per hour?</td><td>1/600 at 10 Yama kills/hour</td></tr>
      <tr><td>Scoring</td><td>What is the completion worth and can it repeat?</td><td>150 points, once</td></tr>
    </tbody></table>

    <h2>Plan the board against the event window.</h2>
    <p>For a straightforward drop, Terry estimates an individual average as <strong>drop-rate denominator ÷ numerator ÷ efficient individual attempts per hour</strong>. A 1/600 drop at 10 kills per hour therefore contributes 60 expected player-hours. A five-player team pursuing it in parallel has an idealized 12-hour elapsed estimate. XP and quantity tasks use target amount ÷ efficient individual units per hour; execution tasks can use a fixed practice-and-attempt budget.</p>
    <p>Add a start and end time to compare the sum of estimated player-hours with the team’s available capacity. Choose “no end date” for an open-ended event. These are planning averages, not promises: random drops have long tails, players are not active every hour, and several tasks may compete for the same specialist. Edit the starter assumptions to match your clan.</p>

    <h2>Five concrete preset patterns.</h2>
    <h3>Get an Oathplate helm</h3>
    <p>Use <strong>item acquired</strong>, target “Oathplate helm,” amount 1, any-member scope, and RuneLite plus organizer proof. If the item identifier is known, store it as well as the name so a display-name variation does not break matching.</p>
    <h3>Obtain the Mole pet</h3>
    <p>Use <strong>pet obtained</strong>, target “Baby mole,” amount 1, any-member scope, and RuneLite/organizer proof. Pet detection is intentionally conservative: if several pet tiles are simultaneously relevant and the local message does not identify the pet, the plugin will not guess.</p>
    <h3>Obtain a Twisted kit</h3>
    <p>Use <strong>item acquired</strong> with the exact kit name used by the game, amount 1, and a high but not event-deciding value. If your clan means a family of acceptable kits, create one tile per accepted target or describe the set clearly and require organizer review.</p>
    <h3>Beat the GM ToB trio time</h3>
    <p>Use <strong>raid time</strong>, target “Theatre of Blood,” metric “trio,” an organizer-entered number of seconds, comparator “at most,” and exact-party scope of 3. Players set the anonymous current party size in the plugin; names of the other raiders are not transmitted.</p>
    <h3>As a team, gain 10m Agility XP</h3>
    <p>Use <strong>XP gain</strong>, metric “Agility,” amount 10,000,000, comparator “at least,” and whole-team scope. Wise Old Man snapshots are the strongest primary source; RuneLite can provide near-live progress for paired players.</p>

    <h2>Choose the game style that creates the right interaction.</h2>
    <table><thead><tr><th>Style</th><th>How it plays</th><th>Best use</th></tr></thead><tbody>
      <tr><td>Classic</td><td>Complete a row, column, or diagonal.</td><td>Short events with a legible finish line.</td></tr>
      <tr><td>Points</td><td>Every approved tile adds its value.</td><td>Mixed rosters and broad boards.</td></tr>
      <tr><td>Lockout</td><td>The first approved team owns a shared square.</td><td>High interaction and active organizers.</td></tr>
      <tr><td>Blackout</td><td>Complete the whole board first.</td><td>Long events with carefully reachable tasks.</td></tr>
      <tr><td>Progression</td><td>Tasks reveal or unlock through prerequisites.</td><td>Campaign-like pacing and tiered difficulty.</td></tr>
      <tr><td>Center-out</td><td>Begin in the middle; each completed tile opens its four orthogonal neighbors.</td><td>Exploration boards, fog-of-war, and competing frontiers.</td></tr>
      <tr><td>Categories</td><td>Score breadth across task families.</td><td>Preventing one specialty from dominating.</td></tr>
    </tbody></table>

    <h2>When does a custom idea need code?</h2>
    <p>You do not need code for a new item name, point value, threshold, party size, layout, prerequisite, or evidence combination. Those belong in the maker. A code expansion is appropriate when the task depends on a new signal the integrations cannot currently observe—for example a novel minigame state, a multi-step encounter condition, or a RuneLite event that must be normalized safely.</p>
    <p>When that happens, send a compact specification: the exact in-game trigger, examples of success and failure, whether it concerns only the local player, the minimum data needed, and how an organizer can audit it. That is much safer than asking for “automatic tracking” without defining the evidence.</p>

    <h2>A final fairness pass.</h2>
    <ul>
      <li>Can every team pursue several useful tiles at once?</li>
      <li>Does an RNG tile have a point value proportional to expected time, not excitement?</li>
      <li>Can a task be read only one way?</li>
      <li>Is the proof source capable of observing the actual condition?</li>
      <li>Are prerequisites visible enough that players understand why a tile is locked?</li>
      <li>Would one unavailable specialist make the whole board unwinnable?</li>
    </ul>
    <p>Open the <Link href="/bingo">bingo hall</Link> to see the formats, or read how <Link href="/guides/runelite-tracking">tracking and review work</Link>.</p>
  </ContentPage>;
}
