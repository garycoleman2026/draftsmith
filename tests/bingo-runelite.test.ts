import { describe, expect, it } from 'vitest';
import {
  RUNELITE_DISCLOSURE_VERSION, canonicalRunelitePairingCode, makeRunelitePairingCode,
  parseRuneliteDeviceCredential, readBoundedJson, runeliteDeviceCredential,
  runelitePrivacy, sanitizeRuneliteObservation,
} from '../lib/bingo-runelite-core';

const context = {
  deviceId: '019be9d3-c040-7ccf-9d94-e55e0e4f76ab',
  pluginVersion: '1.0.0',
  memberRsn: 'Terry Main',
  allowedScopes: ['xp', 'loot', 'kills', 'raids', 'achievements'] as const,
};

describe('RuneLite privacy and credentials', () => {
  it('generates a human pairing code without storing formatting in its canonical form', () => {
    const code = makeRunelitePairingCode();
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(canonicalRunelitePairingCode(code)).toHaveLength(12);
  });

  it('round-trips a scoped device credential', () => {
    const credential = runeliteDeviceCredential(context.deviceId, 'a'.repeat(43));
    expect(parseRuneliteDeviceCredential(credential)).toEqual({ deviceId: context.deviceId, secret: 'a'.repeat(43) });
    expect(parseRuneliteDeviceCredential('Bearer nope')).toBeNull();
  });

  it('makes the no-raw-chat disclosure explicit', () => {
    expect(runelitePrivacy(true, ['xp', 'loot', 'unknown'])).toEqual({
      schemaVersion: 1, disclosureVersion: RUNELITE_DISCLOSURE_VERSION,
      enabled: true, scopes: ['xp', 'loot'], rawChatStored: false,
    });
  });
});

describe('RuneLite observation normalization', () => {
  it('turns client XP into a minimal, device-namespaced signal', () => {
    const result = sanitizeRuneliteObservation({
      type: 'xp_delta', clientEventId: 'session:42', metric: 'Agility', value: 12_345,
      observedAt: '2026-08-27T12:00:00.000Z',
      rawChat: 'this must never be copied', world: 444,
    }, { ...context, allowedScopes: [...context.allowedScopes] });
    expect(result).toMatchObject({
      scope: 'xp',
      signal: {
        idempotencyKey: `rl:${context.deviceId}:session:42`, source: 'runelite', signalType: 'xp_gain',
        metric: 'agility', value: 12_345, unit: 'XP', measurement: 'delta',
      },
    });
    expect(JSON.stringify(result)).not.toContain('rawChat');
    expect(JSON.stringify(result)).not.toContain('444');
  });

  it('preserves item identity while stripping unapproved metadata', () => {
    const result = sanitizeRuneliteObservation({
      type: 'item_drop', clientEventId: 'loot.12345678', target: 'Oathplate helm', targetId: 30_799,
      value: 1, observedAt: '2026-08-27T12:00:00.000Z',
    }, { ...context, allowedScopes: [...context.allowedScopes] });
    expect(result.signal).toMatchObject({
      signalType: 'item_acquired', target: 'Oathplate helm', targetId: 30_799,
      value: 1, unit: 'items', measurement: 'delta',
    });
  });

  it('requires the paired player in a reported raid party', () => {
    expect(() => sanitizeRuneliteObservation({
      type: 'raid_time', clientEventId: 'raid:12345678', target: 'Theatre of Blood', metric: 'trio',
      value: 900, participants: ['Somebody Else', 'Player Two', 'Player Three'],
      observedAt: '2026-08-27T12:00:00.000Z',
    }, { ...context, allowedScopes: [...context.allowedScopes] })).toThrow('paired player');
  });

  it('deduplicates a shared raid fingerprint across different devices', () => {
    const observation = {
      type: 'raid_complete', clientEventId: 'raid:local:1234', correlationId: 'tob:1900000000:a-b-c',
      target: 'Theatre of Blood', participants: ['Terry Main', 'Player Two', 'Player Three'],
      observedAt: '2026-08-27T12:00:00.000Z',
    };
    const first = sanitizeRuneliteObservation(observation, { ...context, allowedScopes: [...context.allowedScopes] });
    const second = sanitizeRuneliteObservation(observation, {
      ...context, deviceId: '119be9d3-c040-7ccf-9d94-e55e0e4f76ab', allowedScopes: [...context.allowedScopes],
    });
    expect(first.signal.idempotencyKey).toBe('rl:shared:tob:1900000000:a-b-c');
    expect(second.signal.idempotencyKey).toBe(first.signal.idempotencyKey);
  });

  it('rejects observations outside the organizer-approved scopes', () => {
    expect(() => sanitizeRuneliteObservation({
      type: 'pet_drop', clientEventId: 'pet:12345678', target: 'Baby mole',
      observedAt: '2026-08-27T12:00:00.000Z',
    }, { ...context, allowedScopes: ['xp'] })).toThrow('loot data scope is disabled');
  });

  it('bounds JSON request bodies before parsing', async () => {
    const request = new Request('https://example.test/api', { method: 'POST', body: JSON.stringify({ value: 'safe' }) });
    await expect(readBoundedJson(request, 100)).resolves.toEqual({ value: 'safe' });
    const tooLarge = new Request('https://example.test/api', { method: 'POST', body: JSON.stringify({ value: 'x'.repeat(100) }) });
    await expect(readBoundedJson(tooLarge, 50)).rejects.toThrow('too large');
  });
});
