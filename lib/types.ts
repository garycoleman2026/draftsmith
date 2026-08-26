export type DraftType = 'balanced' | 'snake' | 'random' | 'live';
export type RosterMode = 'import' | 'signup';
export type SurveyFieldType = 'short' | 'long' | 'number' | 'choice';

export type SurveyQuestion = {
  id?: string;
  label: string;
  fieldType: SurveyFieldType;
  required: boolean;
  options: string[];
};

export type PlayerAnswer = {
  questionId: string;
  label: string;
  value: string;
};

export type RankedPlayer = {
  id: string;
  name: string;
  rank: number;
  score: number;
  avoid: boolean;
};

export type ResultPlayer = {
  id: string;
  name: string;
  averageRank?: number | null;
  averageScore: number | null;
};

export type ResultTeam = {
  teamIndex: number;
  captain: { id: string; name: string };
  players: ResultPlayer[];
  averageRank?: number | null;
  averageScore: number | null;
};

export type DraftResult = {
  generatedAt: string;
  draftType: DraftType;
  teams: ResultTeam[];
  avoidOverrides: number;
  constraintOverrides: number;
};

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  balanced: 'Consensus balance',
  snake: 'Captain snake',
  random: 'Random draw',
  live: 'Live captain draft',
};
