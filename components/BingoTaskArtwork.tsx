'use client';

import { useState } from 'react';
import { bingoTaskImageUrl, type BingoTaskRule } from '../lib/bingo-rules';

export function BingoTaskArtwork({
  rule,
  alt,
  className = '',
}: {
  rule: BingoTaskRule;
  alt: string;
  className?: string;
}) {
  const url = bingoTaskImageUrl(rule);
  const proxyUrl = rule.presentation.imageKey ? `/api/osrs/artwork?name=${encodeURIComponent(rule.presentation.imageKey)}` : null;
  const urls = [proxyUrl, url].filter((item): item is string => Boolean(item));
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const activeUrl = urls.find((item) => !failedUrls.includes(item));

  if (rule.presentation.imageKind === 'none') return null;

  if (!activeUrl) {
    const label = rule.presentation.imageKind === 'boss' ? 'Boss art unavailable' : 'Item art unavailable';
    return (
      <span
        aria-hidden={alt ? undefined : true}
        aria-label={alt || undefined}
        className={`grid place-items-center rounded border border-[#8b6a32]/35 bg-[#e2d19e]/65 text-center text-[7px] font-black uppercase leading-tight tracking-[0.05em] text-[#655338] ${className}`}
        role={alt ? 'img' : undefined}
        title={label}
      >
        {rule.presentation.imageKind === 'boss' ? 'Boss art' : 'Item art'}
      </span>
    );
  }

  return (
    // Wiki artwork is chosen by organizers at runtime, so a fixed remote Image allowlist is not appropriate.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={`object-contain drop-shadow-[0_2px_1px_rgba(45,30,12,.35)] ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={activeUrl}
      onError={() => setFailedUrls((current) => [...current, activeUrl])}
    />
  );
}
