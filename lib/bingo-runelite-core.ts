import { sanitizeVerificationSignal, type BingoVerificationSignal } from './bingo-verification-core';

export const RUNELITE_DISCLOSURE_VERSION = 1 as const;
export const RUNELITE_SCOPES = ['xp', 'loot', 'kills', 'raids', 'achievements'] as const;
export type RuneliteScope = typeof RUNELITE_SCOPES[number];
export const DEFAULT_RUNELITE_SCOPES: RuneliteScope[] = [...RUNELITE_SCOPES];

export const RUNELITE_OBSERVATION_TYPES = [
  'xp_delta', 'level_reached', 'item_drop', 'pet_drop', 'collection_log', 'boss_kill',
  'raid_complete', 'raid_time', 'clue_complete',
] as const;
export type RuneliteObservationType = typeof RUNELITE_OBSERVATION_TYPES[number];

export type RunelitePrivacy = {
  schemaVersion: 1;
  disclosureVersion: typeof RUNELITE_DISCLOSURE_VERSION;
  enabled: boolean;
  scopes: RuneliteScope[];
  rawChatStored: false;
};

export type RuneliteObservationResult = {
  clientEventId: string;
  scope: RuneliteScope;
  signal: BingoVerificationSignal;
};

export type RuneliteConnectionState = 'online' | 'idle' | 'offline' | 'waiting';
export type RuneliteObservationOutcome = 'scored' | 'review' | 'counted' | 'ignored' | 'duplicate';

export function runeliteConnectionState(lastContactAt: string | null | undefined, now = Date.now()): RuneliteConnectionState {
  if (!lastContactAt) return 'waiting';
  const age = now - Date.parse(lastContactAt);
  if (!Number.isFinite(age) || age < 0) return 'waiting';
  if (age <= 60_000) return 'online';
  if (age <= 5 * 60_000) return 'idle';
  return 'offline';
}

export function classifyRuneliteObservation(
  duplicate: boolean,
  candidateStatuses: Array<'progress' | 'ready' | 'accepted' | 'dismissed'>,
): RuneliteObservationOutcome {
  if (duplicate) return 'duplicate';
  if (!candidateStatuses.length) return 'ignored';
  if (candidateStatuses.includes('accepted')) return 'scored';
  if (candidateStatuses.includes('ready')) return 'review';
  return 'counted';
}

export function sanitizeRuneliteScopes(value: unknown, fallback: RuneliteScope[] = DEFAULT_RUNELITE_SCOPES) {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((scope): scope is RuneliteScope =>
    RUNELITE_SCOPES.includes(String(scope) as RuneliteScope)))];
}

export function runelitePrivacy(enabled: boolean, scopes: unknown): RunelitePrivacy {
  return {
    schemaVersion: 1,
    disclosureVersion: RUNELITE_DISCLOSURE_VERSION,
    enabled,
    scopes: sanitizeRuneliteScopes(scopes),
    rawChatStored: false,
  };
}

export function sanitizeRuneliteObservation(input: unknown, context: {
  deviceId: string;
  pluginVersion: string;
  memberRsn: string;
  allowedScopes: RuneliteScope[];
}): RuneliteObservationResult {
  const row = objectValue(input);
  const type = RUNELITE_OBSERVATION_TYPES.includes(String(row.type) as RuneliteObservationType)
    ? String(row.type) as RuneliteObservationType : null;
  if (!type) throw new Error('Unsupported RuneLite observation type.');
  const scope = scopeForObservation(type);
  if (!context.allowedScopes.includes(scope)) throw new Error(`The ${scope} data scope is disabled for this event.`);
  const clientEventId = strictIdentifier(row.clientEventId, 8, 64, 'RuneLite observations need a stable client event ID.');
  const correlationId = row.correlationId === undefined || row.correlationId === null || row.correlationId === ''
    ? null : strictIdentifier(row.correlationId, 8, 64, 'RuneLite correlation IDs must contain 8–64 safe characters.');
  if (correlationId && !['boss_kill', 'raid_complete', 'raid_time'].includes(type)) {
    throw new Error('Only shared boss and raid observations may use a correlation ID.');
  }
  const target = textValue(row.target, 100);
  const targetId = nullableInteger(row.targetId, 0, 10_000_000);
  const metric = metricValue(row.metric || target);
  const numeric = positiveNumber(row.value);
  if (row.participants !== undefined) {
    throw new Error('RuneLite observations must not include other players\' names. Send only participantCount.');
  }
  const participantCount = nullableInteger(row.participantCount, 1, 100);
  if (participantCount !== null && !['boss_kill', 'raid_complete', 'raid_time'].includes(type)) {
    throw new Error('Only shared boss and raid observations may include a party size.');
  }
  const participants = participantCount === null ? [] : [
    context.memberRsn,
    ...Array.from({ length: participantCount - 1 }, (_, index) => `party-${index + 2}`),
  ];
  const observedAt = typeof row.observedAt === 'string' ? row.observedAt : '';
  if (!observedAt) throw new Error('RuneLite observations need an observation time.');

  const descriptor = observationDescriptor(type, { target, targetId, metric, numeric });
  const signal = sanitizeVerificationSignal({
    idempotencyKey: correlationId ? `rl:shared:${correlationId}` : `rl:${context.deviceId}:${clientEventId}`,
    source: 'runelite',
    signalType: descriptor.signalType,
    target: descriptor.target,
    targetId: descriptor.targetId,
    metric: descriptor.metric,
    value: descriptor.value,
    unit: descriptor.unit,
    measurement: descriptor.measurement,
    participants,
    tags: [],
    observedAt,
    metadata: {
      capture: type,
      correlated: Boolean(correlationId),
      pluginVersion: textValue(context.pluginVersion, 30),
      disclosureVersion: RUNELITE_DISCLOSURE_VERSION,
    },
  });
  return { clientEventId, scope, signal };
}

export function makeRunelitePairingCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export function canonicalRunelitePairingCode(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

export function runeliteDeviceCredential(deviceId: string, secret: string) {
  return `rl1.${deviceId}.${secret}`;
}

export function parseRuneliteDeviceCredential(value: string | null | undefined) {
  const match = /^rl1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{32,100})$/.exec(value ?? '');
  return match ? { deviceId: match[1], secret: match[2] } : null;
}

export async function readBoundedJson(request: Request, maximumBytes = 65_536) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error('The request body is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error('The request body is too large.');
  try { return JSON.parse(text || '{}') as unknown; }
  catch { throw new Error('The request body must be valid JSON.'); }
}

function scopeForObservation(type: RuneliteObservationType): RuneliteScope {
  if (type === 'xp_delta' || type === 'level_reached') return 'xp';
  if (type === 'item_drop' || type === 'pet_drop' || type === 'collection_log') return 'loot';
  if (type === 'boss_kill') return 'kills';
  if (type === 'raid_complete' || type === 'raid_time') return 'raids';
  return 'achievements';
}

function observationDescriptor(type: RuneliteObservationType, values: {
  target: string; targetId: number | null; metric: string; numeric: number | null;
}): Omit<BingoVerificationSignal, 'idempotencyKey' | 'source' | 'participants' | 'tags' | 'observedAt' | 'metadata'> {
  const occurrence = values.numeric ?? 1;
  if (type === 'xp_delta') {
    if (!values.metric || values.numeric === null) throw new Error('XP observations need a skill and positive XP amount.');
    return descriptor('xp_gain', '', null, values.metric, values.numeric, 'XP', 'delta');
  }
  if (type === 'level_reached') {
    if (!values.metric || values.numeric === null) throw new Error('Level observations need a skill and positive level.');
    return descriptor('level_reached', '', null, values.metric, values.numeric, 'level', 'absolute');
  }
  if (type === 'item_drop') {
    requireTarget(values);
    return descriptor('item_acquired', values.target, values.targetId, '', occurrence, 'items', 'delta');
  }
  if (type === 'pet_drop') {
    requireTarget(values);
    return descriptor('pet_obtained', values.target, values.targetId, '', 1, 'pet', 'occurrence');
  }
  if (type === 'collection_log') {
    requireTarget(values);
    return descriptor('collection_log', values.target, values.targetId, '', 1, 'entry', 'occurrence');
  }
  if (type === 'boss_kill') {
    if (!values.metric) throw new Error('Boss-kill observations need a boss name.');
    return descriptor('boss_kc', values.target, values.targetId, values.metric, occurrence, 'kills', 'delta');
  }
  if (type === 'raid_complete') {
    if (!values.target) throw new Error('Raid observations need a raid name.');
    return descriptor('raid_complete', values.target, null, values.metric, 1, 'completion', 'occurrence');
  }
  if (type === 'raid_time') {
    if (!values.target || values.numeric === null) throw new Error('Raid-time observations need a raid name and duration.');
    return descriptor('raid_time', values.target, null, values.metric, values.numeric, 'seconds', 'duration');
  }
  if (!values.target) throw new Error('Clue observations need a clue tier.');
  return descriptor('clue_complete', values.target, null, values.metric, occurrence, 'clues', 'delta');
}

function descriptor(
  signalType: BingoVerificationSignal['signalType'], target: string, targetId: number | null,
  metric: string, value: number, unit: string, measurement: BingoVerificationSignal['measurement'],
) {
  return { signalType, target, targetId, metric, value, unit, measurement };
}

function requireTarget(values: { target: string; targetId: number | null }) {
  if (!values.target && values.targetId === null) throw new Error('Loot observations need an item name or ID.');
}
function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Provide a RuneLite observation object.');
  return value as Record<string, unknown>;
}
function textValue(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}
function metricValue(value: unknown) {
  return textValue(value, 60).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function nullableInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isSafeInteger(number) && value !== null && value !== '' ? Math.max(minimum, Math.min(maximum, number)) : null;
}
function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(number, 1_000_000_000_000) : null;
}
function strictIdentifier(value: unknown, minimum: number, maximum: number, message: string) {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error(message);
  }
  return value;
}
