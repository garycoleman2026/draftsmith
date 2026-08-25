export type DraftType = 'balanced' | 'snake' | 'random';

export type RankedPlayer = {
  id: string;
  name: string;
  rank: number;
  avoid: boolean;
};

export type ResultPlayer = {
  id: string;
  name: string;
  averageRank: number | null;
};

export type ResultTeam = {
  teamIndex: number;
  captain: { id: string; name: string };
  players: ResultPlayer[];
  averageRank: number | null;
};

export type DraftResult = {
  generatedAt: string;
  draftType: DraftType;
  teams: ResultTeam[];
  avoidOverrides: number;
};

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  balanced: 'Consensus balance',
  snake: 'Captain snake',
  random: 'Random draw',
};
