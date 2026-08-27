import type { Metadata } from 'next';
import { ContentPage } from '../../components/ContentPage';

export const metadata: Metadata = {
  title: 'Contact and support — Terry’s Drafting',
  description: 'Report a bug, request a bingo verifier, ask a privacy question, or follow Terry’s Drafting development on GitHub.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return <ContentPage eyebrow="Contact & support" title="Bring the exact event, rule, or failure." intro="The fastest useful report includes what role you were using, what you expected, what happened, and whether the problem can be reproduced on a disposable event.">
    <section className="grid gap-5 md:grid-cols-2">
      <div className="wood-panel p-6"><h2 className="mt-0 text-2xl">Website issues</h2><p>Use the public issue tracker for bugs and feature requests. Remove organizer, captain, participant, team, pairing, or device tokens before posting.</p><a href="https://github.com/garycoleman2026/draftsmith/issues" target="_blank" rel="noreferrer">Draftsmith issue tracker ↗</a></div>
      <div className="wood-panel p-6"><h2 className="mt-0 text-2xl">RuneLite beta</h2><p>Report detector messages, build failures, overlay behavior, or privacy concerns in the standalone plugin repository.</p><a href="https://github.com/garycoleman2026/terrys-drafting-runelite/issues" target="_blank" rel="noreferrer">RuneLite plugin issues ↗</a></div>
    </section>

    <h2>Requesting a new automatic bingo rule.</h2>
    <p>Include the exact task, the exact local in-game trigger, examples of success and failure, whether it concerns only the signed-in player, the minimum data that must leave the client, and the manual fallback. New item names or thresholds usually belong in the custom maker; new evidence signals may require code.</p>

    <h2>Privacy or security reports.</h2>
    <p>Do not place personal data, private links, unredacted screenshots, access tokens, or exploit details in a public issue. Open a minimal issue requesting a private follow-up with the maintainer’s GitHub account, or use GitHub’s private vulnerability reporting if it is available on the relevant repository.</p>

    <h2>What not to send.</h2>
    <ul><li>Jagex, RuneLite, Discord, or email passwords.</li><li>Session cookies, device credentials, bearer links, or pairing codes.</li><li>Another player’s private messages or personal information.</li><li>A production exploit demonstration against someone else’s event.</li></ul>
  </ContentPage>;
}
