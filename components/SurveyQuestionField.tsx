'use client';

import type { SurveyFieldType } from '../lib/types';

export type RenderedSurveyQuestion = {
  id: string;
  label: string;
  fieldType: SurveyFieldType;
  required: boolean;
  options: string[];
};

export function SurveyQuestionField({
  question,
  value,
  onChange,
}: {
  question: RenderedSurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const common = {
    id: `question-${question.id}`,
    value,
    required: question.required,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value),
  };
  return (
    <label className="grid gap-2 text-sm font-bold" htmlFor={common.id}>
      <span>{question.label}{question.required ? <span className="text-[#8b3d25]"> *</span> : null}</span>
      {question.fieldType === 'long' ? (
        <textarea {...common} className="realm-field min-h-28 resize-y p-4 outline-none" maxLength={500} />
      ) : question.fieldType === 'choice' ? (
        <select {...common} className="realm-field h-12 px-3 outline-none">
          <option value="">Choose one</option>
          {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input {...common} className="realm-field h-12 px-4 outline-none" type={question.fieldType === 'number' ? 'number' : 'text'} maxLength={120} />
      )}
    </label>
  );
}
