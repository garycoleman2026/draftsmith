import { describe, expect, it } from 'vitest';
import { isDueWiseOldManSync } from '../lib/bingo-wom-scheduler-core';

describe('Wise Old Man scheduler eligibility', () => {
  const now = Date.parse('2026-08-30T12:00:00.000Z');
  it('runs only due live group integrations', () => {
    expect(isDueWiseOldManSync({ autoSync: true, groupId: 42, eventStatus: 'live', nextSyncAt: '2026-08-30T11:59:00.000Z' }, now)).toBe(true);
    expect(isDueWiseOldManSync({ autoSync: true, groupId: 42, eventStatus: 'paused', nextSyncAt: '2026-08-30T11:59:00.000Z' }, now)).toBe(false);
    expect(isDueWiseOldManSync({ autoSync: false, groupId: 42, eventStatus: 'live', nextSyncAt: '2026-08-30T11:59:00.000Z' }, now)).toBe(false);
    expect(isDueWiseOldManSync({ autoSync: true, groupId: null, eventStatus: 'live', nextSyncAt: '2026-08-30T11:59:00.000Z' }, now)).toBe(false);
    expect(isDueWiseOldManSync({ autoSync: true, groupId: 42, eventStatus: 'live', nextSyncAt: '2026-08-30T12:01:00.000Z' }, now)).toBe(false);
  });
});
