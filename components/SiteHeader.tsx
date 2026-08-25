export function SiteHeader({ badge }: { badge?: string }) {
  return (
    <header className="border-b border-[#14251f]/10 bg-[#f8f5ec]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <a className="flex items-center gap-3" href="/">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173f35] text-lg font-black text-[#f8f5ec] shadow-[3px_3px_0_#e16948]">
            D
          </span>
          <span>
            <span className="block font-black tracking-[-0.03em]">DraftSmith</span>
            <span className="block text-xs font-medium text-[#597067]">Captain-ranked team maker</span>
          </span>
        </a>
        {badge ? (
          <span className="rounded-full border border-[#173f35]/15 bg-white/70 px-3 py-1.5 text-xs font-bold text-[#35574d]">
            {badge}
          </span>
        ) : null}
      </div>
    </header>
  );
}
