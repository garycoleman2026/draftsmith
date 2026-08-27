import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function ContentPage({ eyebrow, title, intro, children }: {
  eyebrow: string; title: string; intro: string; children: ReactNode;
}) {
  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader />
      <article className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <header className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">{eyebrow}</p>
          <h1 className="fantasy-title mt-3 text-4xl font-bold leading-none text-[#f5df9b] sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#bfb18f]">{intro}</p>
        </header>
        <div className="content-prose mt-10">{children}</div>
      </article>
      <SiteFooter />
    </main>
  );
}
