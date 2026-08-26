'use client';

import { useCallback, useEffect, useState } from 'react';
import { DRAFT_TYPE_LABELS, type DraftType, type SurveyQuestion } from '../lib/types';
import { SiteHeader } from './SiteHeader';
import { SurveyQuestionField } from './SurveyQuestionField';

type SignupData = {
  draft: {
    title: string;
    draftType: DraftType;
    teamCount: number;
    registrationOpen: boolean;
    registrationCapacity: number;
    registrationDeadline: string | null;
    approvalRequired: boolean;
  };
  signupCount: number;
  questions: Array<Required<Pick<SurveyQuestion, 'id' | 'label' | 'fieldType' | 'required' | 'options'>>>;
};

export function SignupForm({ token }: { token: string }) {
  const [data, setData] = useState<SignupData | null>(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState('');
  const [signupStatus, setSignupStatus] = useState('');
  const [managePath, setManagePath] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/join/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = (await response.json()) as SignupData & { error?: string };
      if (!response.ok) throw new Error(next.error || 'The signup form could not be loaded.');
      setData(next);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The signup form could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(firstLoad);
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/join/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, answers, website: '' }),
      });
      const next = (await response.json()) as { joined?: boolean; name?: string; signupCount?: number; signupStatus?: string; managePath?: string; error?: string };
      if (!response.ok || !next.joined) throw new Error(next.error || 'Your signup could not be saved.');
      setJoined(next.name || name);
      setSignupStatus(next.signupStatus || 'approved');
      setManagePath(next.managePath || '');
      setData((current) => current ? { ...current, signupCount: next.signupCount ?? current.signupCount + 1 } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your signup could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Event signup" />
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <div className="h-10 w-72 animate-pulse rounded bg-[#d2a94e]/20" />
          <div className="mt-8 h-96 animate-pulse rounded border border-[#8b6a32]/50 bg-[#d8c28a]/20" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="realm-bg min-h-screen text-[#eadcb9]">
        <SiteHeader badge="Event signup" />
        <section className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="fantasy-title text-4xl font-bold text-[#f5df9b]">Signup scroll unavailable</h1>
          <p className="mt-4 text-[#b5a888]">{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="realm-bg min-h-screen text-[#eadcb9]">
      <SiteHeader badge="Event signup" />
      <section className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <div className="mb-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#c69b3c]">Join the draft pool</p>
          <h1 className="fantasy-title mt-3 text-4xl font-bold text-[#f5df9b] sm:text-6xl">{data.draft.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#b5a888]">
            {DRAFT_TYPE_LABELS[data.draft.draftType]} · {data.draft.teamCount} teams · {data.signupCount} registered
          </p>
        </div>

        {joined ? (
          <section className="parchment-panel p-7 text-center sm:p-10">
            <span className="brand-rune mx-auto grid h-14 w-14 place-items-center rounded-full text-xl font-black text-[#f4d77c]">✓</span>
            <h2 className="fantasy-title mt-5 text-3xl font-bold">You’re in, {joined}.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#665b45]">
              {signupStatus === 'approved'
                ? 'Your profile is on the active roster.'
                : signupStatus === 'pending'
                  ? 'Your profile is waiting for organizer approval.'
                  : 'The active roster is full, so you have been added to the waitlist.'}
            </p>
            {managePath ? (
              <a className="gold-button mt-6 inline-flex px-5 py-3 text-sm" href={managePath}>Save your private profile link →</a>
            ) : null}
            <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-[#756748]">Use the private profile link to edit your answers or withdraw before registration closes.</p>
          </section>
        ) : data.draft.registrationOpen ? (
          <form className="parchment-panel p-5 sm:p-8" onSubmit={submit}>
            <div className="border-b border-[#6e5226]/25 pb-5">
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#6e603f]">Participant profile</p>
              <h2 className="fantasy-title mt-1 text-2xl font-bold">Tell the captains what they should know.</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#6d6048]">Your responses will be visible to this event’s organizer and captains.</p>
            </div>

            <label className="mt-6 grid gap-2 text-sm font-bold">
              In-game name <span className="font-normal text-[#77694f]">(required)</span>
              <input
                className="realm-field h-12 px-4 font-semibold outline-none"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={12}
                required
                autoComplete="nickname"
                placeholder="Your character name"
              />
            </label>

            <div className="mt-6 grid gap-5">
              {data.questions.map((question) => (
                <SurveyQuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id] || ''}
                  onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                />
              ))}
            </div>

            <label className="sr-only" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" name="website" />
            </label>

            {error ? <p role="alert" className="mt-5 rounded border border-[#a7442d]/35 bg-[#f3c5a9] px-4 py-3 text-sm font-bold text-[#7d2b1c]">{error}</p> : null}
            <button className="gold-button mt-7 w-full px-5 py-3.5 text-sm" type="submit" disabled={saving}>
              {saving ? 'Sealing your signup…' : 'Join the draft pool →'}
            </button>
          </form>
        ) : (
          <section className="parchment-panel p-7 text-center sm:p-10">
            <h2 className="fantasy-title text-3xl font-bold">Registration is closed.</h2>
            <p className="mt-3 text-sm text-[#665b45]">The organizer has stopped accepting new participants for this event.</p>
          </section>
        )}
      </section>
    </main>
  );
}
