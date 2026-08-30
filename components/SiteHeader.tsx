import Link from 'next/link';
import { AccountNav } from './AccountNav';

export function SiteHeader({ badge }: { badge?: string }) {
  return (
    <header className="border-b border-[#9b792f]/50 bg-[#17120d]/95 shadow-[0_5px_18px_rgba(0,0,0,.38)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="brand-rune grid h-11 w-11 place-items-center rounded-full text-xl font-black text-[#f4d77c]">
            T
          </span>
          <span>
            <span className="fantasy-title block text-lg font-bold tracking-[0.01em] text-[#f5d98d]">Terry&apos;s Drafting</span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.13em] text-[#a99a78]">Clan bingo team forge</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <nav aria-label="Main navigation" className="hidden items-center gap-4 2xl:flex">
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/">Home</Link>
            <Link className="text-xs font-black text-[#f2d98f] hover:text-white" href="/events/new">New event</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/draft">Draft teams</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/bingo">Bingo hall</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/bingo/studio">Board studio</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/templates">Templates</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/presets">Task library</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/clans">Clans</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/guides">Guides</Link>
            <Link className="text-xs font-black text-[#cbb77f] hover:text-[#f5df9b]" href="/about">About</Link>
          </nav>
          <details className="relative 2xl:hidden">
            <summary className="scroll-button list-none px-3 py-2 text-xs">Menu</summary>
            <nav aria-label="Mobile navigation" className="absolute right-0 z-50 mt-2 grid w-44 gap-1 rounded border border-[#9b792f] bg-[#1c1710] p-2 shadow-2xl">
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/">Home</Link>
              <Link className="rounded bg-[#d7ae50]/15 px-3 py-2 text-xs font-black text-[#f2d98f] hover:bg-white/10" href="/events/new">New event</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/draft">Draft teams</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/bingo">Bingo hall</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/bingo/studio">Board studio</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/templates">Templates</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/presets">Task library</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/clans">Clans</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/guides">Guides</Link>
              <Link className="rounded px-3 py-2 text-xs font-black text-[#e3cf96] hover:bg-white/10" href="/about">About</Link>
            </nav>
          </details>
          {badge ? (
            <span className="hidden rounded border border-[#8b6d2c] bg-[#2c2417] px-3 py-1.5 text-xs font-bold text-[#ddc27b] shadow-inner sm:inline-flex">
              {badge}
            </span>
          ) : null}
          <AccountNav />
        </div>
      </div>
    </header>
  );
}
