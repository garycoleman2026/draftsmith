import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '../../../components/ContentPage';

export const metadata: Metadata = {
  title: 'How to run an OSRS clan bingo — Terry’s Drafting',
  description: 'A practical organizer guide to OSRS clan bingo sign-ups, fair teams, board design, proof rules, live scoring, and event closeout.',
  alternates: { canonical: '/guides/osrs-clan-bingo' },
};

export default function ClanBingoGuidePage() {
  return <ContentPage eyebrow="OSRS clan bingo guide" title="From sign-up form to final tile." intro="The best clan bingos feel competitive without becoming an unpaid moderation job. This workflow keeps the rules visible, the teams balanced, and disputed completions reviewable.">
    <h2>1. Write the event promise first.</h2>
    <p>Before choosing tasks, write one sentence that explains the event: who it is for, how long it runs, and what wins. “A three-day points hunt for mixed-account teams” produces a very different board from “a month-long end-game PvM lockout.” That sentence becomes the test for every later decision.</p>
    <ul>
      <li><strong>Duration:</strong> short events need more reachable tiles and fewer extreme RNG gates.</li>
      <li><strong>Audience:</strong> mixed-level clans need alternate paths so a new player can contribute meaningfully.</li>
      <li><strong>Availability:</strong> decide whether overnight progress, substitutes, and late sign-ups are allowed.</li>
      <li><strong>Winner:</strong> choose lines, points, blackout, category breadth, or first ownership before balancing task values.</li>
    </ul>

    <h2>2. Collect information you will actually use.</h2>
    <p>A sign-up survey should improve team balance or event communication. Useful fields include Discord name, expected playtime, preferred activities, game knowledge, gear band, raid experience, and willingness to teach. Avoid collecting personal information that the event does not need.</p>
    <p>Terry’s sign-up mode gives every participant a private form. Captains can receive only the fields the organizer marks visible. If your roster already exists, a pasted list remains the fastest path.</p>

    <h2>3. Balance captains’ judgment with explicit constraints.</h2>
    <p>Private captain scores capture information no public stat service can see: communication, reliability, niche knowledge, or how well someone fits a weekend schedule. Use a numeric score as the strength signal and the ordered ranking as the tie-break. “Avoid” should be rare and treated as a preference, not a public label.</p>
    <p>Together/apart constraints solve a different problem. Together is useful for a mentor and learner or shared-account schedule; apart can separate household members, known conflicts, or two specialists who would otherwise overload one team. Record why a constraint exists outside the public result.</p>

    <h2>4. Build a board with several ways to matter.</h2>
    <p>A durable 5 × 5 points board might use roughly eight accessible tasks, ten medium tasks, five difficult tasks, and two headline challenges. That is a starting shape, not a formula. Every team should see useful work in skilling, PvM, clues, collection, and cooperative play.</p>
    <table><thead><tr><th>Task role</th><th>Example</th><th>Why it exists</th></tr></thead><tbody>
      <tr><td>Quick win</td><td>Complete a hard clue</td><td>Gets every team moving and teaches the claim flow.</td></tr>
      <tr><td>Progress</td><td>As a team, gain 10m Agility XP</td><td>Rewards steady contribution from several members.</td></tr>
      <tr><td>Specialist</td><td>Obtain a Twisted kit</td><td>Lets an experienced subgroup create a meaningful swing.</td></tr>
      <tr><td>RNG headline</td><td>Obtain the Mole pet</td><td>Creates excitement, but should not be the only route to victory.</td></tr>
      <tr><td>Execution</td><td>Beat the GM Theatre of Blood trio time</td><td>Rewards coordination with a clear numerical threshold.</td></tr>
    </tbody></table>

    <h2>5. Match evidence to the thing being claimed.</h2>
    <p>Use Wise Old Man for changes that can be measured from public snapshots, such as XP, levels, and supported kill counts. Use RuneLite for near-live, task-relevant observations such as a matching drop or supported completion message. Use screenshots for visual conditions that the integrations cannot represent. Keep organizer review available because every external source can be delayed, incomplete, or misunderstood.</p>

    <h2>6. Test the event like a player.</h2>
    <ol>
      <li>Create a small test draft and generate two teams.</li>
      <li>Open every captain, participant, team, organizer, and spectator link in the role that will use it.</li>
      <li>Start a test bingo, submit one manual claim, one screenshot claim, and one automated signal.</li>
      <li>Confirm lockout collisions, repeat limits, prerequisites, hidden-task reveals, and spectator delay.</li>
      <li>Export or copy the final rules into your clan announcement before the real start.</li>
    </ol>

    <h2>7. Run a predictable review rhythm.</h2>
    <p>Publish when claims are reviewed—for example every hour during waking hours—and identify the escalation path for disputes. A rejected claim should explain what is missing. A corrected claim should not become a public argument. For very competitive events, use a second organizer for headline tiles.</p>

    <h2>8. Close the event deliberately.</h2>
    <p>Stop new claims, run the final Wise Old Man capture, resolve every pending item, then mark the bingo complete. Share the final spectator board and a short recap: closest race, memorable drop, strongest comeback, and one rule you would change next time. Save the board as a clan template so the next event starts from evidence rather than memory.</p>

    <p><Link href="/">Draft the teams</Link> or continue with the <Link href="/guides/custom-bingo-maker">custom board design guide</Link>.</p>
  </ContentPage>;
}
