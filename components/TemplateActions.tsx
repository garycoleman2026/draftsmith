'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { copyText } from '../lib/client';

export function TemplateActions({
  slug,
  preferredValue,
  importText,
  official,
  initialRatingAverage,
  initialRatingCount,
}: {
  slug: string;
  preferredValue: string;
  importText: string;
  official: boolean;
  initialRatingAverage: number | null;
  initialRatingCount: number;
}) {
  const [ratingAverage, setRatingAverage] = useState(initialRatingAverage);
  const [ratingCount, setRatingCount] = useState(initialRatingCount);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (official) return;
    let active = true;
    void fetch(`/api/gallery/templates/${encodeURIComponent(slug)}/rating`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { ratingAverage: number | null; ratingCount: number; userRating: number | null };
        if (active) {
          setRatingAverage(result.ratingAverage); setRatingCount(result.ratingCount); setUserRating(result.userRating);
        }
      });
    return () => { active = false; };
  }, [official, slug]);

  function chooseTemplate() {
    window.localStorage.setItem('terrys_preferred_bingo_template', preferredValue);
    setMessage('Saved for this browser. Create or open a completed team draft and Terry will preselect this board.');
  }

  async function copyBoard() {
    await copyText(importText);
    setMessage('Copied the complete task sheet and advanced rules. Paste it into the custom bingo maker.');
  }

  async function rate(rating: number) {
    setWorking(true); setMessage('');
    try {
      const response = await fetch(`/api/gallery/templates/${encodeURIComponent(slug)}/rating`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating }),
      });
      const result = await response.json() as { error?: string; ratingAverage?: number | null; ratingCount?: number; userRating?: number };
      if (!response.ok) throw new Error(result.error || 'The rating could not be saved.');
      setRatingAverage(result.ratingAverage ?? null); setRatingCount(result.ratingCount ?? 0);
      setUserRating(result.userRating ?? rating); setMessage('Rating saved. You can change it at any time from this browser.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The rating could not be saved.');
    } finally { setWorking(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link className="gold-button px-5 py-3 text-sm" href={`/bingo/studio?template=${encodeURIComponent(slug)}`}>Customize in board studio →</Link>
        <button className="scroll-button px-5 py-3 text-sm" type="button" onClick={chooseTemplate}>Use after a draft</button>
        <button className="scroll-button px-5 py-3 text-sm" type="button" onClick={() => void copyBoard()}>Copy task sheet</button>
      </div>
      {official ? (
        <p className="text-xs text-[#756748]">Official starter boards are maintained by Terry’s Drafting and do not accept community ratings.</p>
      ) : (
        <div className="rounded border border-[#8b6a32]/35 bg-[#f2dfae]/65 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#80642b]">Community rating</p><p className="mt-1 text-sm font-black">{ratingAverage === null ? 'Not rated yet' : `${ratingAverage.toFixed(1)} / 5`} · {ratingCount} vote{ratingCount === 1 ? '' : 's'}</p></div>
            <div className="flex gap-1" aria-label="Rate this template from one to five">
              {[1, 2, 3, 4, 5].map((rating) => <button
                aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                aria-pressed={userRating === rating}
                className={`grid h-10 w-10 place-items-center rounded border text-lg ${userRating === rating ? 'border-[#4f7348] bg-[#dce8c6] text-[#355332]' : 'border-[#9b792f]/45 bg-[#f6e8bf] text-[#8a6523]'}`}
                disabled={working}
                key={rating}
                onClick={() => void rate(rating)}
                type="button"
              >★</button>)}
            </div>
          </div>
        </div>
      )}
      {message ? <p className="rounded border border-[#8b6a32]/35 bg-[#efe0b6] px-4 py-3 text-xs font-bold text-[#5a482d]" role="status">{message}</p> : null}
    </div>
  );
}
