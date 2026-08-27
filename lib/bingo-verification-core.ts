import { BINGO_VERIFIERS, type BingoTaskRule, type BingoVerifierType } from './bingo-rules';

export const VERIFICATION_SOURCES = ['runelite', 'wise_old_man', 'organizer'] as const;
export type VerificationSource = typeof VERIFICATION_SOURCES[number];
export type VerificationConfidence = 'unverified' | 'reported' | 'observed' | 'corroborated' | 'verified' | 'reviewed';
export type VerificationMeasurement = 'occurrence' | 'delta' | 'absolute' | 'duration';

export type BingoVerificationSignal = {
  idempotencyKey: string;
  source: VerificationSource;
  signalType: BingoVerifierType;
  target: string;
  targetId: number | null;
  metric: string;
  value: number | null;
  unit: string;
  measurement: VerificationMeasurement;
  participants: string[];
  tags: string[];
  observedAt: string;
  metadata: Record<string, unknown>;
};

export type BingoRuleMatch = {
  value: number;
  targetValue: number;
  progressKind: 'sum' | 'max' | 'min';
  comparator: BingoTaskRule['verifier']['comparator'];
};

export type BingoVerificationMatch = {
  value: number;
  progress_kind: BingoRuleMatch['progressKind'];
  member_id: string | null;
  source: VerificationSource;
};

export function sanitizeVerificationSignal(value: unknown): BingoVerificationSignal {
  if (!value || typeof value !== 'object') throw new Error('Provide a verification signal.');
  const input = value as Record<string, unknown>;
  const source = VERIFICATION_SOURCES.includes(String(input.source) as VerificationSource)
    ? String(input.source) as VerificationSource : null;
  if (!source) throw new Error('Choose a supported verification source.');
  const signalType = BINGO_VERIFIERS.includes(String(input.signalType) as BingoVerifierType)
    ? String(input.signalType) as BingoVerifierType : null;
  if (!signalType) throw new Error('Choose a supported verification signal type.');
  const idempotencyKey = textValue(input.idempotencyKey, 120).replace(/[^a-zA-Z0-9._:-]/g, '');
  if (idempotencyKey.length < 8) throw new Error('Verification signals need an idempotency key of at least eight characters.');
  const measurement = ['occurrence', 'delta', 'absolute', 'duration'].includes(String(input.measurement))
    ? String(input.measurement) as VerificationMeasurement : 'occurrence';
  const rawValue = Number(input.value);
  const numericValue = Number.isFinite(rawValue) && rawValue >= 0 ? Math.min(rawValue, 1_000_000_000_000) : null;
  const observed = typeof input.observedAt === 'string' ? new Date(input.observedAt) : new Date();
  if (!Number.isFinite(observed.getTime())) throw new Error('The signal observation time is invalid.');
  const metadata = serializableMetadata(input.metadata);
  return {
    idempotencyKey, source, signalType,
    target: textValue(input.target, 100),
    targetId: nullableInteger(input.targetId, 0, 10_000_000),
    metric: textValue(input.metric, 60),
    value: numericValue,
    unit: textValue(input.unit, 24),
    measurement,
    participants: textList(input.participants, 100, 50),
    tags: textList(input.tags, 50, 80),
    observedAt: observed.toISOString(),
    metadata,
  };
}

export function matchVerificationSignal(
  rule: BingoTaskRule,
  signal: BingoVerificationSignal,
  rosterSize: number,
  memberId: string | null = null,
): BingoRuleMatch | null {
  if (rule.verifier.type !== signal.signalType) return null;
  if (!rule.proof.sources.includes(signal.source)) return null;
  if (!targetMatches(rule, signal) || !metricMatches(rule, signal)) return null;
  if ((rule.scope.type === 'any_member' || rule.scope.type === 'single_member') && !memberId) return null;
  if (rule.scope.type === 'exact_party' && signal.participants.length !== rule.scope.participantCount) return null;
  if (rule.scope.type === 'all_members' && (!rosterSize || signal.participants.length < rosterSize)) return null;
  const targetValue = rule.verifier.amount ?? 1;
  if (targetValue <= 0) return null;
  let progressKind: BingoRuleMatch['progressKind'] = 'sum';
  if (signal.measurement === 'absolute' || rule.verifier.type === 'level_reached') progressKind = 'max';
  if (signal.measurement === 'duration' || rule.verifier.type === 'raid_time') progressKind = 'min';
  const measuredValue = signal.value ?? 1;
  if (measuredValue <= 0) return null;
  return { value: measuredValue, targetValue, progressKind, comparator: rule.verifier.comparator };
}

export function computeVerificationCandidate(rule: BingoTaskRule, matches: BingoVerificationMatch[]) {
  const targetValue = rule.verifier.amount ?? 1;
  const bySource = new Map<VerificationSource, Map<string, BingoVerificationMatch[]>>();
  for (const match of matches) {
    const memberKey = rule.scope.type === 'any_member' || rule.scope.type === 'single_member'
      ? match.member_id ?? 'unknown' : 'team';
    const groups = bySource.get(match.source) ?? new Map<string, BingoVerificationMatch[]>();
    groups.set(memberKey, [...(groups.get(memberKey) ?? []), match]);
    bySource.set(match.source, groups);
  }
  const sourceProgress: Record<string, number> = {};
  const sourceMembers: Record<string, string | null> = {};
  for (const [source, groups] of bySource) {
    const groupValues = [...groups.entries()].map(([memberId, rows]) => ({
      memberId: memberId === 'unknown' || memberId === 'team' ? null : memberId,
      value: aggregateMatches(rows),
    }));
    const best = groupValues.sort((left, right) => compareProgress(left.value, right.value, targetValue, rule.verifier.comparator))[0];
    sourceProgress[source] = best?.value ?? 0;
    sourceMembers[source] = best?.memberId ?? null;
  }
  const completeSources = Object.entries(sourceProgress)
    .filter(([, progress]) => comparatorComplete(progress, targetValue, rule.verifier.comparator))
    .map(([source]) => source as VerificationSource);
  const bestSource = Object.entries(sourceProgress)
    .sort((left, right) => compareProgress(left[1], right[1], targetValue, rule.verifier.comparator))[0];
  const sources = [...bySource.keys()];
  const confidence: VerificationConfidence = completeSources.length > 1 ? 'corroborated'
    : completeSources.includes('wise_old_man') ? 'verified'
      : completeSources.includes('runelite') ? 'observed'
        : completeSources.includes('organizer') ? 'reviewed'
          : sources.includes('runelite') ? 'observed' : 'reported';
  return {
    complete: completeSources.length > 0,
    progressValue: bestSource?.[1] ?? 0,
    targetValue,
    memberId: bestSource ? sourceMembers[bestSource[0]] ?? null : null,
    sources,
    completeSources,
    sourceProgress,
    confidence,
  };
}

function aggregateMatches(matches: BingoVerificationMatch[]) {
  if (!matches.length) return 0;
  const kind = matches[0].progress_kind;
  if (kind === 'max') return Math.max(...matches.map((match) => match.value));
  if (kind === 'min') return Math.min(...matches.map((match) => match.value));
  return matches.reduce((sum, match) => sum + match.value, 0);
}

function comparatorComplete(value: number, target: number, comparator: BingoTaskRule['verifier']['comparator']) {
  if (comparator === 'at_most') return value <= target && value > 0;
  if (comparator === 'equals') return value === target;
  return value >= target;
}

function compareProgress(left: number, right: number, target: number, comparator: BingoTaskRule['verifier']['comparator']) {
  if (comparator === 'at_most') return left - right;
  if (comparator === 'equals') return Math.abs(left - target) - Math.abs(right - target);
  return right - left;
}

function targetMatches(rule: BingoTaskRule, signal: BingoVerificationSignal) {
  if (rule.verifier.targetId !== null) return signal.targetId === rule.verifier.targetId;
  const required = normalize(rule.verifier.target);
  if (!required || required.startsWith('any')) return true;
  const candidates = [signal.target, ...signal.tags].map(normalize).filter(Boolean);
  return candidates.some((candidate) => candidate === required);
}

function metricMatches(rule: BingoTaskRule, signal: BingoVerificationSignal) {
  const required = normalize(rule.verifier.metric);
  return !required || required === normalize(signal.metric) || signal.tags.map(normalize).includes(required);
}

function normalize(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function textValue(value: unknown, maxLength: number) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''; }
function nullableInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) && value !== null && value !== '' ? Math.max(minimum, Math.min(maximum, Math.round(number))) : null;
}
function textList(value: unknown, maximumItems: number, maximumLength: number) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => textValue(item, maximumLength)).filter(Boolean))].slice(0, maximumItems)
    : [];
}
function serializableMetadata(value: unknown) {
  const metadata = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  let encoded = '';
  try { encoded = JSON.stringify(metadata); } catch { throw new Error('Verification metadata must be JSON-compatible.'); }
  if (encoded.length > 8_000) throw new Error('Verification metadata is too large.');
  return JSON.parse(encoded) as Record<string, unknown>;
}
