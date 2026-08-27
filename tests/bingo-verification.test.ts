import { describe, expect, it } from 'vitest';
import {
  computeVerificationCandidate, matchVerificationSignal, sanitizeVerificationSignal,
  type BingoVerificationMatch, type BingoVerificationSignal,
} from '../lib/bingo-verification-core';
import { defaultBingoTaskRule, type BingoTaskRule } from '../lib/bingo-rules';

type RuleOverrides = Omit<Partial<BingoTaskRule>, 'verifier' | 'scope' | 'proof'> & {
  verifier?: Partial<BingoTaskRule['verifier']>;
  scope?: Partial<BingoTaskRule['scope']>;
  proof?: Partial<BingoTaskRule['proof']>;
};

function rule(overrides: RuleOverrides = {}): BingoTaskRule {
  const base = defaultBingoTaskRule('hybrid');
  return {
    ...base,
    ...overrides,
    verifier: { ...base.verifier, type: 'item_acquired', target: 'Oathplate helm', ...overrides.verifier },
    scope: { ...base.scope, ...overrides.scope },
    proof: { ...base.proof, sources: ['runelite', 'wise_old_man', 'organizer'], ...overrides.proof },
  };
}

function signal(overrides: Partial<BingoVerificationSignal> = {}): BingoVerificationSignal {
  return {
    idempotencyKey: 'device:event:0001', source: 'runelite', signalType: 'item_acquired',
    target: 'Oathplate helm', targetId: null, metric: '', value: 1, unit: '', measurement: 'occurrence',
    participants: [], tags: [], observedAt: '2026-08-27T12:00:00.000Z', metadata: {}, ...overrides,
  };
}

describe('bingo verification signals', () => {
  it('sanitizes bounded normalized evidence and rejects weak keys', () => {
    expect(sanitizeVerificationSignal(signal({ tags: ['drop', 'drop'], participants: ['Gary', 'Gary'] }))).toMatchObject({
      idempotencyKey: 'device:event:0001', tags: ['drop'], participants: ['Gary'],
    });
    expect(() => sanitizeVerificationSignal({ ...signal(), idempotencyKey: 'tiny' })).toThrow(/idempotency key/i);
    expect(() => sanitizeVerificationSignal({ ...signal(), source: 'spreadsheet' })).toThrow(/source/i);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => sanitizeVerificationSignal({ ...signal(), metadata: circular })).toThrow(/JSON-compatible/i);
  });

  it('requires an identified player for single-player rules and exact canonical targets', () => {
    expect(matchVerificationSignal(rule(), signal(), 5, null)).toBeNull();
    expect(matchVerificationSignal(rule(), signal({ target: 'Some other helm' }), 5, 'member-1')).toBeNull();
    expect(matchVerificationSignal(rule(), signal(), 5, 'member-1')).toMatchObject({ value: 1, targetValue: 1 });
  });

  it('honors provider-scoped eligible task IDs without changing raw signal matching', () => {
    const scoped = signal({ metadata: { eligibleTaskIds: ['task-a'] } });
    expect(matchVerificationSignal(rule(), scoped, 5, 'member-1', 'task-b')).toBeNull();
    expect(matchVerificationSignal(rule(), scoped, 5, 'member-1', 'task-a')).not.toBeNull();
  });

  it('uses target ids as the authoritative item identity when configured', () => {
    const itemRule = rule({ verifier: { targetId: 30_500 } });
    expect(matchVerificationSignal(itemRule, signal({ target: 'Localized item name', targetId: 30_500 }), 5, 'member-1')).not.toBeNull();
    expect(matchVerificationSignal(itemRule, signal({ targetId: 30_501 }), 5, 'member-1')).toBeNull();
  });

  it('matches team XP deltas only from allowed proof sources', () => {
    const xpRule = rule({
      verifier: { type: 'xp_gain', target: '', metric: 'agility', amount: 10_000_000, unit: 'XP' },
      scope: { type: 'team_total' }, proof: { sources: ['wise_old_man', 'runelite'] },
    });
    expect(matchVerificationSignal(xpRule, signal({ signalType: 'xp_gain', target: '', metric: 'agility', value: 4_000_000, measurement: 'delta' }), 5))
      .toMatchObject({ value: 4_000_000, targetValue: 10_000_000, progressKind: 'sum' });
    expect(matchVerificationSignal(xpRule, signal({ source: 'organizer', signalType: 'xp_gain', target: '', metric: 'agility' }), 5)).toBeNull();
  });

  it('enforces exact-party and all-roster participant scopes', () => {
    const raidRule = rule({ verifier: { type: 'raid_complete', target: 'Theatre of Blood' }, scope: { type: 'exact_party', participantCount: 3 } });
    expect(matchVerificationSignal(raidRule, signal({ signalType: 'raid_complete', target: 'Theatre of Blood', participants: ['A', 'B'] }), 5)).toBeNull();
    expect(matchVerificationSignal(raidRule, signal({ signalType: 'raid_complete', target: 'Theatre of Blood', participants: ['A', 'B', 'C'] }), 5)).not.toBeNull();
    const rosterRule = rule({ verifier: { type: 'team_challenge', target: 'Barbarian Assault' }, scope: { type: 'all_members' } });
    expect(matchVerificationSignal(rosterRule, signal({ signalType: 'team_challenge', target: 'Barbarian Assault', participants: ['A', 'B', 'C', 'D'] }), 5)).toBeNull();
    expect(matchVerificationSignal(rosterRule, signal({ signalType: 'team_challenge', target: 'Barbarian Assault', participants: ['A', 'B', 'C', 'D', 'E'] }), 5)).not.toBeNull();
  });

  it('treats raid duration as a minimum and applies an at-most target', () => {
    const speedRule = rule({
      verifier: { type: 'raid_time', target: 'Theatre of Blood', metric: 'trio', amount: 900, comparator: 'at_most', unit: 'seconds' },
      scope: { type: 'exact_party', participantCount: 3 },
    });
    expect(matchVerificationSignal(speedRule, signal({
      signalType: 'raid_time', target: 'Theatre of Blood', metric: 'trio', value: 870,
      measurement: 'duration', participants: ['A', 'B', 'C'],
    }), 5)).toMatchObject({ value: 870, targetValue: 900, progressKind: 'min', comparator: 'at_most' });
  });
});

describe('verification candidate aggregation', () => {
  it('keeps source streams independent so RuneLite and WOM do not double-count the same progress', () => {
    const xpRule = rule({
      verifier: { type: 'xp_gain', target: '', metric: 'agility', amount: 10_000_000 },
      scope: { type: 'team_total' },
    });
    const matches: BingoVerificationMatch[] = [
      { value: 6_000_000, progress_kind: 'sum', member_id: 'a', source: 'runelite' },
      { value: 7_000_000, progress_kind: 'max', member_id: null, source: 'wise_old_man' },
    ];
    expect(computeVerificationCandidate(xpRule, matches)).toMatchObject({
      complete: false, progressValue: 7_000_000,
      sourceProgress: { runelite: 6_000_000, wise_old_man: 7_000_000 },
    });
  });

  it('marks independently complete sources as corroborated', () => {
    const itemRule = rule();
    const matches: BingoVerificationMatch[] = [
      { value: 1, progress_kind: 'sum', member_id: 'a', source: 'runelite' },
      { value: 1, progress_kind: 'sum', member_id: 'a', source: 'wise_old_man' },
    ];
    expect(computeVerificationCandidate(itemRule, matches)).toMatchObject({ complete: true, confidence: 'corroborated' });
  });
});
