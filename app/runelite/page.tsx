import type { Metadata } from 'next';
import Link from 'next/link';
import { RunelitePluginPreview } from '../../components/RunelitePluginPreview';
import { SiteFooter } from '../../components/SiteFooter';
import { SiteHeader } from '../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Terry’s Drafting RuneLite plugin preview',
  description: 'Preview the Terry’s Drafting RuneLite side panel, learn how event pairing works, and follow the beta and Plugin Hub plan.',
  alternates: { canonical: '/runelite' },
};

const steps = [
  ['1', 'Join the event', 'Open your private team board and ask for a pairing code.'],
  ['2', 'Pair your character', 'Enter the one-use code in the plugin while logged into that character.'],
  ['3', 'Play normally', 'The panel shows your team, score, open tasks, and progress.'],
  ['4', 'Review the claim', 'Matching activity reaches Terry. The organizer stays in control of approval.'],
] as const;

export default function RunelitePage() {
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="RuneLite beta" />
      <section className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-8">
        <div className="grid gap-8 xl:grid-cols-[.8fr_1.2fr] xl:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">The bingo beside the game</p>
            <h1 className="fantasy-title mt-3 text-5xl font-bold leading-none text-[#f5df9b] sm:text-7xl">Your team, tasks, and score in one panel.</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#b9ab89]">Pair your character to an event, keep the next tasks in view, and send useful progress without leaving the game.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="gold-button px-5 py-3 text-sm" href="https://github.com/garycoleman2026/terrys-drafting-runelite" target="_blank" rel="noreferrer">Open the beta code ↗</a>
              <Link className="scroll-button px-5 py-3 text-sm" href="/guides/runelite-tracking">Read the tracking guide</Link>
            </div>
          </div>
          <RunelitePluginPreview />
        </div>

        <section className="mt-12">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#c69b3c]">How it works</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map(([number, title, body]) => (
              <article className="parchment-card p-5 text-[#392d1b]" key={number}>
                <span className="seal-badge grid h-9 w-9 place-items-center rounded-full text-sm font-black">{number}</span>
                <h2 className="fantasy-title mt-4 text-2xl font-bold">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#66563d]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="wood-panel p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Try the source beta</p>
            <h2 className="fantasy-title mt-2 text-3xl font-bold text-[#f2d98f]">First, prove it in real play.</h2>
            <ol className="mt-5 space-y-3 text-sm leading-relaxed text-[#c8b990]">
              <li><b>1.</b> Install Java 11 and clone the plugin repository.</li>
              <li><b>2.</b> Run <code>gradlew.bat test</code> on Windows.</li>
              <li><b>3.</b> Run <code>gradlew.bat run</code> to open RuneLite in developer mode.</li>
              <li><b>4.</b> Test pairing, XP, one drop, a manual claim, disconnect, and character switching.</li>
            </ol>
          </div>
          <div className="parchment-panel p-6 text-[#433520] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#80642b]">What the beta sends</p>
            <h2 className="fantasy-title mt-2 text-3xl font-bold">Only event-sized signals.</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#6e5e43]">Relevant XP, levels, loot, boss or raid completions, clue tiers, timestamps, and an anonymous party size when a task needs it.</p>
            <p className="mt-3 text-sm leading-relaxed text-[#6e5e43]">No passwords, account sessions, bank contents, chat archive, friends list, or always-on location history. Sharing can be turned off at any time.</p>
          </div>
        </section>

        <section className="parchment-panel mt-8 p-6 text-[#433520] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#80642b]">Builder notes</p>
          <h2 className="fantasy-title mt-2 text-3xl font-bold">Technical details and Plugin Hub path.</h2>
          <div className="mt-5 space-y-3">
            <details className="rounded border border-[#8b6a32]/30 bg-white/20 p-4">
              <summary className="cursor-pointer text-sm font-black">Plugin shape</summary>
              <p className="mt-3 text-xs leading-relaxed text-[#5f5038]">A Java 11 RuneLite plugin with a plugin class, configuration, Swing side panel, small overlay, event subscribers, and the injected RuneLite HTTP client. It keeps raw game messages on the client and turns supported activity into small event observations.</p>
            </details>
            <details className="rounded border border-[#8b6a32]/30 bg-white/20 p-4">
              <summary className="cursor-pointer text-sm font-black">Updates and retries</summary>
              <p className="mt-3 text-xs leading-relaxed text-[#5f5038]">The panel checks the event revision about every five seconds. New observations are batched within roughly ten seconds. Every observation keeps a stable retry key, so a reconnect does not add the same progress twice.</p>
            </details>
            <details className="rounded border border-[#8b6a32]/30 bg-white/20 p-4">
              <summary className="cursor-pointer text-sm font-black">Pairing and security</summary>
              <p className="mt-3 text-xs leading-relaxed text-[#5f5038]">A private team board creates a ten-minute, one-use code. The server returns a revocable event credential stored as a one-way hash. The plugin receives a capture plan and ignores activity the current board does not need.</p>
            </details>
            <details className="rounded border border-[#8b6a32]/30 bg-white/20 p-4">
              <summary className="cursor-pointer text-sm font-black">Plugin Hub submission checklist</summary>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-[#5f5038]">
                <li><b>1.</b> Finish the gameplay test and keep the repository public, licensed, and free of secrets.</li>
                <li><b>2.</b> Show a clear warning in the plugin or settings that event data goes to Terry’s third-party server.</li>
                <li><b>3.</b> Fork the official Plugin Hub repository and add a file under <code>plugins/</code> with the plugin repository URL and a full 40-character commit hash.</li>
                <li><b>4.</b> Open a pull request, pass CI and the RuneLite Plugin Hub checks, then address reviewer feedback.</li>
                <li><b>5.</b> If code changes during review, update the commit hash in the Hub pull request and wait for approval and merge.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-3"><a className="text-xs font-black text-[#315d45] underline" href="https://github.com/runelite/plugin-hub/blob/master/README.md" target="_blank" rel="noreferrer">Official submission guide ↗</a><a className="text-xs font-black text-[#315d45] underline" href="https://github.com/runelite/runelite/wiki/Information-about-the-Plugin-Hub" target="_blank" rel="noreferrer">Third-party server rules ↗</a></div>
            </details>
          </div>
        </section>

        <p className="mt-8 text-[10px] leading-relaxed text-[#8f8267]">Terry’s Drafting is an independent community tool and is not affiliated with or endorsed by RuneLite, Jagex, or Wise Old Man.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
