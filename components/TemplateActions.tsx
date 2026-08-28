'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { copyText } from '../lib/client';

type VoteResult = {
  error?: string;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  userVote: number;
};

export function TemplateActions({
  slug,
  preferredValue,
  importText,
  official,
  initialUpvoteCount,
  initialDownvoteCount,
}: {
  slug: string;
  preferredValue: string;
  importText: string;
  official: boolean;
  initialUpvoteCount: number;
  initialDownvoteCount: number;
}) {
  const [upvoteCount, setUpvoteCount] = useState(initialUpvoteCount);
  const [downvoteCount, setDownvoteCount] = useState(initialDownvoteCount);
  const [userVote, setUserVote] = useState(0);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (official) return;
    let active = true;
    void fetch(`/api/gallery/templates/${encodeURIComponent(slug)}/vote`, { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<VoteResult> : null)
      .then((result) => {
        if (active && result) {
          setUpvoteCount(result.upvoteCount);
          setDownvoteCount(result.downvoteCount);
          setUserVote(result.userVote);
        }
      });
    return () => { active = false; };
  }, [official, slug]);

  function chooseTemplate() {
    window.localStorage.setItem('terrys_preferred_bingo_template', preferredValue);
    setMessage('Saved. Terry will pick this board when you start a bingo after drafting.');
  }

  async function copyBoard() {
    await copyText(importText);
    setMessage('Task sheet copied. Paste it into the board studio.');
  }

  async function vote(value: 1 | -1) {
    setWorking(true);
    setMessage('');
    try {
      const response = await fetch(`/api/gallery/templates/${encodeURIComponent(slug)}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: value }),
      });
      const result = await response.json() as VoteResult;
      if (!response.ok) throw new Error(result.error || 'The vote could not be saved.');
      setUpvoteCount(result.upvoteCount);
      setDownvoteCount(result.downvoteCount);
      setUserVote(result.userVote);
      setMessage(result.userVote === 0 ? 'Vote removed.' : 'Vote saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The vote could not be saved.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link className="gold-button px-5 py-3 text-sm" href={`/bingo/studio?template=${encodeURIComponent(slug)}`}>Make it yours →</Link>
        <button className="scroll-button px-5 py-3 text-sm" type="button" onClick={chooseTemplate}>Use after a draft</button>
        <button className="scroll-button px-5 py-3 text-sm" type="button" onClick={() => void copyBoard()}>Copy task sheet</button>
      </div>
      {official ? (
        <p className="text-xs text-[#756748]">This is a Terry’s starter board.</p>
      ) : (
        <div className="rounded border border-[#8b6a32]/35 bg-[#f2dfae]/65 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#80642b]">Was this board useful?</p>
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Vote on this board">
            <button aria-label="Upvote this board" aria-pressed={userVote === 1} className={`rounded border px-4 py-2 text-sm font-black ${userVote === 1 ? 'border-[#4f7348] bg-[#dce8c6] text-[#355332]' : 'border-[#9b792f]/45 bg-[#f6e8bf] text-[#5b471d]'}`} disabled={working} onClick={() => void vote(1)} type="button">↑ {upvoteCount}</button>
            <button aria-label="Downvote this board" aria-pressed={userVote === -1} className={`rounded border px-4 py-2 text-sm font-black ${userVote === -1 ? 'border-[#8a523b] bg-[#ead0be] text-[#713923]' : 'border-[#9b792f]/45 bg-[#f6e8bf] text-[#5b471d]'}`} disabled={working} onClick={() => void vote(-1)} type="button">↓ {downvoteCount}</button>
            <span className="ml-auto text-xs font-black text-[#66563d]">Score {upvoteCount - downvoteCount}</span>
          </div>
        </div>
      )}
      {message ? <p className="rounded border border-[#8b6a32]/35 bg-[#efe0b6] px-4 py-3 text-xs font-bold text-[#5a482d]" role="status">{message}</p> : null}
    </div>
  );
}
