import type { BingoBoardScope, BingoClaimStatus, BingoMode, BingoStatus, BingoVerificationMode } from './types';
import type { BingoEventRules, BingoTaskRule } from './bingo-rules';

export type BingoViewTeam = {
  id: string; name: string; color: string; emblem: string; sourceTeamIndex: number;
  members: { id: string; playerId: string | null; name: string; role: string }[];
  score: number; completedCount: number; lineCount: number; categoryCount: number; rank: number;
};

export type BingoViewTask = {
  id: string; title: string; description: string; points: number | null; category: string;
  difficulty: string | null; verificationMode: BingoVerificationMode | null; repeatable: boolean;
  maxCompletions: number; hidden: boolean; concealed: boolean; freeSpace: boolean; iconKey: string;
  rule: BingoTaskRule;
  sortOrder: number; ownerTeamIds: string[]; pendingTeamIds: string[]; claimable: boolean; claimBlockedReason: string | null;
};

export type BingoViewClaim = {
  id: string; taskId: string; teamId: string; memberId: string | null; claimedByName: string;
  note: string; evidenceUrl: string | null; evidenceUploadId: string | null; status: BingoClaimStatus;
  reviewNote: string | null; scoreAwarded: number; submittedAt: string; reviewedAt: string | null; approvedAt: string | null;
};

export type BingoViewData = {
  event: {
    id: string; draftId: string | null; title: string; publicSlug: string; publicPath: string; mode: BingoMode;
    boardScope: BingoBoardScope; gridSize: number; status: BingoStatus; winCondition: string; targetValue: number;
    requiresReview: boolean; publicSpectator: boolean; spectatorDelaySeconds: number; startAt: string | null;
    endAt: string | null; startedAt: string | null; endedAt: string | null; baselineStatus: string;
    revision: number; rules: BingoEventRules; createdAt: string; updatedAt: string;
  };
  teams: BingoViewTeam[];
  tasks: BingoViewTask[];
  claims: BingoViewClaim[];
  completions: { id: string; taskId: string; teamId: string; claimId: string; completionNumber: number; points: number; completedAt: string }[];
  activity: { id: string; teamId: string | null; taskId: string | null; type: string; message: string; metadata: Record<string, unknown>; createdAt: string }[];
  snapshots: { phase: string; count: number; capturedAt: string | null }[];
  viewer: { type: 'public' | 'team' | 'organizer'; teamId: string | null };
};
