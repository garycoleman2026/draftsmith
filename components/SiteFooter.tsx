import Link from 'next/link';

const groups = [
  { title: 'Build', links: [['Draft teams', '/'], ['Bingo hall', '/bingo'], ['Community templates', '/templates'], ['Task library', '/presets'], ['RuneLite beta', '/runelite']] },
  { title: 'Learn', links: [['Guides', '/guides'], ['Clan bingo guide', '/guides/osrs-clan-bingo'], ['Custom board maker', '/guides/custom-bingo-maker'], ['Tracking guide', '/guides/runelite-tracking']] },
  { title: 'Trust', links: [['Public clans', '/clans'], ['About', '/about'], ['FAQ', '/faq'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Contact', '/contact']] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-[#9b792f]/45 bg-[#100d09] text-[#b9ab88]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1.35fr_repeat(3,1fr)]">
        <div>
          <p className="fantasy-title text-xl font-bold text-[#f2d98f]">Terry&apos;s Drafting</p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed">Independent tools and practical guides for fair OSRS clan drafts, custom bingo boards, evidence review, and live event tracking.</p>
          <p className="mt-4 text-[10px] leading-relaxed text-[#81765e]">Not affiliated with or endorsed by Jagex, RuneLite, or Wise Old Man. Game names and references belong to their respective owners.</p>
        </div>
        {groups.map((group) => <nav aria-label={group.title} key={group.title}><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d1ad57]">{group.title}</p><div className="mt-3 grid gap-2">{group.links.map(([label, href]) => <Link className="text-xs hover:text-[#f2d98f] hover:underline" href={href} key={href}>{label}</Link>)}</div></nav>)}
      </div>
      <div className="border-t border-white/5 px-5 py-4 text-center text-[10px] text-[#756b56]">© {new Date().getUTCFullYear()} Terry&apos;s Drafting · Built for clan organizers and bingo teams.</div>
    </footer>
  );
}
