'use client';

import type { BalanceMetric, QuestionVisibility, SurveyFieldType, SurveyQuestion } from '../lib/types';

const FIELD_LABELS: Record<SurveyFieldType, string> = {
  short: 'Short answer',
  long: 'Long answer',
  number: 'Number',
  choice: 'Multiple choice',
};

const METRIC_LABELS: Record<BalanceMetric, string> = {
  playtime: 'Expected playtime',
  pvm: 'PvM strength',
  skilling: 'Skilling strength',
  raids: 'Raid experience',
  gear: 'Gear readiness',
  knowledge: 'Game knowledge',
};

export function SurveyBuilder({
  questions,
  onChange,
}: {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
}) {
  function update(index: number, patch: Partial<SurveyQuestion>) {
    onChange(questions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question));
  }

  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Signup questions</p>
          <p className="mt-1 text-xs text-[#6b5e45]">The in-game name is always collected separately.</p>
        </div>
        <button
          className="scroll-button px-3 py-2 text-xs"
          type="button"
          disabled={questions.length >= 12}
          onClick={() => onChange([...questions, { label: 'New question', fieldType: 'short', required: false, options: [], visibility: 'captains', balanceMetric: null, balanceWeight: 0 }])}
        >
          + Add question
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {questions.map((question, index) => (
          <article className="parchment-card p-4" key={index}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
              <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#6d5e40]">
                Question
                <input
                  className="realm-field h-11 px-3 text-sm font-semibold normal-case tracking-normal outline-none"
                  value={question.label}
                  maxLength={80}
                  onChange={(event) => update(index, { label: event.target.value })}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#6d5e40]">
                Answer type
                <select
                  className="realm-field h-11 px-3 text-sm font-semibold normal-case tracking-normal outline-none"
                  value={question.fieldType}
                  onChange={(event) => update(index, { fieldType: event.target.value as SurveyFieldType })}
                >
                  {(Object.keys(FIELD_LABELS) as SurveyFieldType[]).map((type) => (
                    <option key={type} value={type}>{FIELD_LABELS[type]}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="scroll-button h-11 px-3 text-xs"
                onClick={() => onChange(questions.filter((_, itemIndex) => itemIndex !== index))}
              >
                Remove
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-xs font-bold text-[#5f523b]">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(event) => update(index, { required: event.target.checked })}
                />
                Required answer
              </label>
              {question.fieldType === 'choice' ? (
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-[#5f523b]">
                  Choices
                  <input
                    className="realm-field h-10 min-w-0 flex-1 px-3 text-sm font-semibold outline-none"
                    value={question.options.join(', ')}
                    placeholder="Beginner, Intermediate, Advanced"
                    onChange={(event) => update(index, {
                      options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12),
                    })}
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 border-t border-[#8b6a32]/20 pt-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-xs font-bold text-[#5f523b]">
                Who can see this?
                <select className="realm-field h-10 px-2 text-sm outline-none" value={question.visibility ?? 'captains'} onChange={(event) => update(index, { visibility: event.target.value as QuestionVisibility })}>
                  <option value="organizer">Organizer only</option>
                  <option value="captains">Organizer and captains</option>
                  <option value="public">Public profile</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#5f523b]">
                Optional balance metric
                <select className="realm-field h-10 px-2 text-sm outline-none" value={question.balanceMetric ?? ''} onChange={(event) => update(index, { balanceMetric: (event.target.value || null) as BalanceMetric | null, balanceWeight: event.target.value ? Math.max(10, question.balanceWeight ?? 0) : 0 })}>
                  <option value="">Do not balance from this</option>
                  {(Object.keys(METRIC_LABELS) as BalanceMetric[]).map((metric) => <option key={metric} value={metric}>{METRIC_LABELS[metric]}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-[#5f523b]">
                Metric weight
                <input className="realm-field h-10 px-2 text-sm outline-none" type="number" min={0} max={100} disabled={!question.balanceMetric} value={question.balanceWeight ?? 0} onChange={(event) => update(index, { balanceWeight: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} />
              </label>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
