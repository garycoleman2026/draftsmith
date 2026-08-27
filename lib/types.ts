export type DraftType = 'balanced' | 'snake' | 'random' | 'live';
export type RosterMode = 'import' | 'signup';
export type SurveyFieldType = 'short' | 'long' | 'number' | 'choice';
export type QuestionVisibility = 'organizer' | 'captains' | 'public';
export type BalanceMetric = 'playtime' | 'pvm' | 'skilling' | 'raids' | 'gear' | 'knowledge';
export type BalancePreset = 'consensus' | 'all_rounder' | 'pvm' | 'skilling' | 'raids' | 'custom';
export type ConstraintEnforcement = 'hard' | 'soft';
export type LiveOrder = 'snake' | 'linear' | 'random' | 'third_round_reversal';
export type DraftLifecycle = 'registration' | 'rankings' | 'live' | 'complete' | 'archived';
export type BingoMode = 'classic' | 'points' | 'lockout' | 'blackout' | 'progression' | 'categories';
export type BingoBoardScope = 'shared' | 'per_team';
export type BingoStatus = 'draft' | 'scheduled' | 'live' | 'complete' | 'archived';
export type BingoVerificationMode = 'manual' | 'screenshot' | 'stat_delta' | 'hybrid';
export type BingoClaimStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type SurveyQuestion = {
  id?: string;
  label: string;
  fieldType: SurveyFieldType;
  required: boolean;
  options: string[];
  visibility?: QuestionVisibility;
  balanceMetric?: BalanceMetric | null;
  balanceWeight?: number;
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
  compositeScore?: number | null;
};

export type ResultTeam = {
  teamIndex: number;
  captain: { id: string; name: string };
  players: ResultPlayer[];
  averageRank?: number | null;
  averageScore: number | null;
  compositeStrength?: number | null;
};

export type FairnessReport = {
  objectiveScore: number;
  strengthSpread: number;
  standardDeviation: number;
  teamStrengths: { teamIndex: number; strength: number; size: number }[];
  metricSpreads: Record<string, number>;
  hardConstraintsSatisfied: boolean;
  softViolations: number;
  avoidViolations: number;
};

export type DraftResult = {
  generatedAt: string;
  draftType: DraftType;
  teams: ResultTeam[];
  avoidOverrides: number;
  constraintOverrides: number;
  seed?: string;
  runNumber?: number;
  fairness?: FairnessReport;
};

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  balanced: 'Consensus balance',
  snake: 'Captain snake',
  random: 'Random draw',
  live: 'Live captain draft',
};
