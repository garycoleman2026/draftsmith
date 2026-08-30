import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Terry’s Drafting — clan drafts and OSRS bingo',
  description: 'Draft fair clan teams, design custom OSRS bingo boards, run live events, and share boards with other organizers.',
  alternates: { canonical: '/' },
};

const paths = [
  {
    eyebrow: 'Gather the clan',
    title: 'Draft teams',
    body: 'Collect sign-ups, let captains rank privately, and make fair teams.',
    href: '/draft',
    action: 'Start a draft',
  },
  {
    eyebrow: 'Build your challenge',
    title: 'Design a bingo board',
    body: 'Choose tasks, set points and rules, then save or share your board.',
    href: '/bingo/studio',
    action: 'Open the board studio',
  },
  {
    eyebrow: 'Light the braziers',
    title: 'Run a bingo',
    body: 'Bring your teams, launch the board, review claims, and follow the score.',
    href: '/events/new',
    action: 'Start an event',
  },
  {
    eyebrow: 'Browse the archives',
    title: 'Find a ready-made board',
    body: 'Explore starter boards and community creations, then make one your own.',
    href: '/templates',
    action: 'Browse boards',
  },
] as const;

export default function Home() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Terry’s Drafting',
    url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site', applicationCategory: 'GameApplication',
    operatingSystem: 'Web', description: 'Clan team drafting and custom OSRS bingo event tools.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c') }} />
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d1ad57]">Welcome to the great hall</p>
          <h1 className="fantasy-title mt-4 text-5xl font-bold leading-none text-[#f5df9b] sm:text-7xl">One home for clan drafts and bingos.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#c7b995]">Form the teams. Forge the board. Run the event. Terry keeps the fiddly parts out of your way.</p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {paths.map((path) => (
            <Link className="parchment-card group block p-6 text-[#392d1b] transition hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(0,0,0,.35)] sm:p-8" href={path.href} key={path.href}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#80642b]">{path.eyebrow}</p>
              <h2 className="fantasy-title mt-2 text-3xl font-bold sm:text-4xl">{path.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#66563d]">{path.body}</p>
              <span className="mt-6 inline-flex text-sm font-black text-[#5b471d] underline decoration-[#b68b2f] decoration-2 underline-offset-4 group-hover:text-[#2f552f]">{path.action} →</span>
            </Link>
          ))}
        </div>

        <section className="wood-panel mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#d7ae50]">Coming to RuneLite</p>
            <h2 className="fantasy-title mt-2 text-2xl font-bold text-[#f2d98f]">Keep your team and bingo beside the game.</h2>
            <p className="mt-2 text-sm text-[#b8aa87]">See the first plugin preview and follow the beta build.</p>
          </div>
          <Link className="scroll-button inline-flex shrink-0 justify-center px-5 py-3 text-sm" href="/runelite">See the RuneLite plugin →</Link>
        </section>
      </section>
      <SiteFooter />
    </main>
  );
}
