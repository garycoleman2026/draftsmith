import type { ReactNode } from 'react';

export function BingoOrganizerDisclosure({ eyebrow, title, description, children, className = '' }: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`organizer-disclosure parchment-panel text-[#392d1b] ${className}`}>
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#80642b]">{eyebrow}</p>
          <h2 className="fantasy-title mt-1 text-2xl font-bold sm:text-3xl">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-relaxed text-[#6e5e43]">{description}</p> : null}
        </div>
        <span className="disclosure-toggle shrink-0 rounded border border-[#8b6a32]/35 bg-[#f5e5b8]/65 px-3 py-2 text-[10px] font-black uppercase text-[#5f4925]"><span className="disclosure-closed">Open</span><span className="disclosure-open">Close</span> <span aria-hidden="true" className="disclosure-arrow">⌄</span></span>
      </summary>
      <div className="border-t border-[#8b6a32]/25 p-4 sm:p-6">{children}</div>
    </details>
  );
}
