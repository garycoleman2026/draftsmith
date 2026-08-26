'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RenderedSurveyQuestion } from './SurveyQuestionField';
import { SiteHeader } from './SiteHeader';
import { SurveyQuestionField } from './SurveyQuestionField';

type ParticipantData = {
  participant: { name: string; signupStatus: string; canEdit: boolean };
  draft: { title: string; registrationDeadline: string | null };
  questions: RenderedSurveyQuestion[];
  answers: Record<string, string>;
};

export function ParticipantProfile({ token }: { token: string }) {
  const [data, setData] = useState<ParticipantData | null>(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawn, setWithdrawn] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/participant/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = (await response.json()) as ParticipantData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'Your participant profile could not be loaded.');
      setData(next);
      setName(next.participant.name);
      setAnswers(next.answers);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your participant profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking('save');
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/participant/${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, answers, website: '' }),
      });
      const next = (await response.json()) as { saved?: boolean; error?: string };
      if (!response.ok || !next.saved) throw new Error(next.error || 'Your profile could not be saved.');
      setSuccess('Profile saved. Your organizer and eligible captains will see the newest answers.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your profile could not be saved.');
    } finally {
      setWorking('');
    }
  }

  async function withdraw() {
    if (!window.confirm('Withdraw from this event? Your organizer will be notified.')) return;
    setWorking('withdraw');
    setError('');
    try {
      const response = await fetch(`/api/participant/${encodeURIComponent(token)}`, { method: 'DELETE' });
      const next = (await response.json()) as { withdrawn?: boolean; error?: string };
      if (!response.ok || !next.withdrawn) throw new Error(next.error || 'You could not be withdrawn.');
      setWithdrawn(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'You could not be withdrawn.');
    } finally {
      setWorking('');
    }
  }

  if (loading) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]"><SiteHeader badge="Participant profile" /><div className="mx-auto max-w-3xl px-5 py-16"><div className="h-96 animate-pulse rounded bg-white/5" /></div></main>
    );
  }

  if (!data || withdrawn) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Participant profile" />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="fantasy-title text-4xl font-bold text-[#f5df9b]">{withdrawn ? 'You have withdrawn.' : 'Profile link unavailable'}</h1>
          <p className="mt-4 text-[#b5a888]">{withdrawn ? 'The organizer’s roster has been updated.' : error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Participant profile" />
      <section className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Private self-service link</p>
          <h1 className="fantasy-title mt-3 text-4xl font-bold text-[#f5df9b] sm:text-6xl">{data.draft.title}</h1>
          <span className="mt-4 inline-flex rounded-full bg-[#f2e4ad] px-4 py-2 text-xs font-black text-[#5a4510]">{statusLabel(data.participant.signupStatus)}</span>
        </div>
        <form className="parchment-panel p-5 sm:p-8" onSubmit={save}>
          <label className="grid gap-2 text-sm font-bold">
            In-game name
            <input className="realm-field h-12 px-4 outline-none" value={name} maxLength={12} required disabled={!data.participant.canEdit} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="mt-6 grid gap-5">
            {data.questions.map((question) => (
              <fieldset disabled={!data.participant.canEdit} key={question.id}>
                <SurveyQuestionField question={question} value={answers[question.id] || ''} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
              </fieldset>
            ))}
          </div>
          {success ? <p role="status" className="mt-5 rounded border border-[#4d7940]/35 bg-[#d8e6c7] px-4 py-3 text-sm font-bold text-[#315026]">{success}</p> : null}
          {error ? <p role="alert" className="mt-5 rounded border border-[#a7442d]/35 bg-[#f3c5a9] px-4 py-3 text-sm font-bold text-[#7d2b1c]">{error}</p> : null}
          {data.participant.canEdit ? (
            <div className="mt-7 flex flex-col gap-3 border-t border-[#8b6a32]/25 pt-6 sm:flex-row sm:justify-between">
              <button className="scroll-button px-4 py-3 text-xs text-[#8b321f]" type="button" disabled={Boolean(working)} onClick={() => void withdraw()}>{working === 'withdraw' ? 'Withdrawing…' : 'Withdraw from event'}</button>
              <button className="gold-button px-6 py-3 text-sm" type="submit" disabled={Boolean(working)}>{working === 'save' ? 'Saving…' : 'Save profile →'}</button>
            </div>
          ) : <p className="mt-6 border-t border-[#8b6a32]/25 pt-5 text-sm font-bold text-[#756748]">Registration changes are closed. Your saved answers remain on the roster.</p>}
        </form>
      </section>
    </main>
  );
}

function statusLabel(status: string) {
  if (status === 'pending') return 'Waiting for organizer approval';
  if (status === 'waitlisted') return 'Waitlisted';
  return 'Active roster';
}
