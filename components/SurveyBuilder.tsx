'use client';

import type { SurveyFieldType, SurveyQuestion } from '../lib/types';

const FIELD_LABELS: Record<SurveyFieldType, string> = {
  short: 'Short answer',
  long: 'Long answer',
  number: 'Number',
  choice: 'Multiple choice',
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
          onClick={() => onChange([...questions, { label: 'New question', fieldType: 'short', required: false, options: [] }])}
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
          </article>
        ))}
      </div>
    </div>
  );
}
