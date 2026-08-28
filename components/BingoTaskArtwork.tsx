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
  const [failedUrl, setFailedUrl] = useState('');

  if (!url || failedUrl === url) return null;

  return (
    // Wiki artwork is chosen by organizers at runtime, so a fixed remote Image allowlist is not appropriate.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={`object-contain drop-shadow-[0_2px_1px_rgba(45,30,12,.35)] ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={url}
      onError={() => setFailedUrl(url)}
    />
  );
}
