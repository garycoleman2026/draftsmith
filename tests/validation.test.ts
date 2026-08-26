import { describe, expect, it } from 'vitest';
import { cleanRsn, normalizeRsn, parseRsnList, validateRsn } from '../lib/validation';

describe('RuneScape name validation', () => {
  it('uses one canonical form for imports and signups', () => {
    expect(cleanRsn('  Terry   Two  ')).toBe('Terry Two');
    expect(normalizeRsn('TeRrY  Two')).toBe('terry two');
    expect(validateRsn('Terry_Two-1')).toBeNull();
  });

  it('rejects names the player intelligence providers cannot query', () => {
    expect(validateRsn('a'.repeat(13))).toMatch(/12/);
    expect(validateRsn('bad@email')).toBeTruthy();
  });

  it('deduplicates case-insensitively and reports invalid imports', () => {
    const parsed = parseRsnList(['Terry', ' terry ', 'Valid Two', 'invalid@email']);
    expect(parsed.names).toEqual(['terry', 'Valid Two']);
    expect(parsed.invalid).toEqual(['invalid@email']);
  });
});
