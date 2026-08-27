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
          <Link className="hidden text-xs font-black text-[#cbb77f] underline decoration-[#8b6d2c] underline-offset-4 md:inline" href="/bingo">Bingo hall</Link>
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
