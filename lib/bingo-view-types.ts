import type { BingoBoardScope, BingoClaimStatus, BingoMode, BingoStatus, BingoVerificationMode } from './types';
import type { BingoEventRules, BingoTaskRule } from './bingo-rules';
import type { VerificationConfidence } from './bingo-verification-core';

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
  verificationSource: string; verificationConfidence: VerificationConfidence; verificationCandidateId: string | null;
};

export type BingoViewVerificationCandidate = {
  id: string; taskId: string; teamId: string; memberId: string | null; sourceSummary: string;
  confidence: VerificationConfidence; status: 'progress' | 'ready' | 'accepted' | 'dismissed';
  progressValue: number; targetValue: number; summary: string; details: Record<string, unknown>;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
};

export type BingoViewWomRun = {
  id: string; phase: 'baseline' | 'checkpoint' | 'final'; status: string;
  sourceMode: 'group_bulk' | 'player_details'; totalCount: number; capturedCount: number;
  failedCount: number; reconcileOffset: number; signalsCount: number; errorSummary: string | null;
  startedAt: string; completedAt: string | null;
};

export type BingoViewData = {
  event: {
    id: string; draftId: string | null; title: string; publicSlug: string; publicPath: string; mode: BingoMode;
    boardScope: BingoBoardScope; gridSize: number; status: BingoStatus; winCondition: string; targetValue: number;
    requiresReview: boolean; publicSpectator: boolean; publicListed: boolean; spectatorDelaySeconds: number; startAt: string | null;
    endAt: string | null; startedAt: string | null; endedAt: string | null; baselineStatus: string;
    clanName: string | null; clanPath: string | null; revision: number; rules: BingoEventRules; createdAt: string; updatedAt: string;
  };
  teams: BingoViewTeam[];
  tasks: BingoViewTask[];
  claims: BingoViewClaim[];
  completions: { id: string; taskId: string; teamId: string; claimId: string; completionNumber: number; points: number; verificationSource: string; verificationConfidence: VerificationConfidence; completedAt: string }[];
  activity: { id: string; teamId: string | null; taskId: string | null; type: string; message: string; metadata: Record<string, unknown>; createdAt: string }[];
  snapshots: { phase: string; count: number; capturedAt: string | null }[];
  verification: { eventCount: number; candidates: BingoViewVerificationCandidate[] };
  wiseOldMan: {
    configured: boolean; groupId: number | null; syncIntervalHours: number; autoSync: boolean; status: string;
    baselineRunId: string | null; baselineCoverage: number; lastSyncAt: string | null; nextSyncAt: string | null;
    lastError: string | null; latestRun: BingoViewWomRun | null;
  };
  viewer: { type: 'public' | 'team' | 'organizer'; teamId: string | null };
};
