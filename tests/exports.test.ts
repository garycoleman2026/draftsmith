import { describe, expect, it } from 'vitest';
import { resultCsv, resultMarkdown, resultSvg } from '../lib/exports';
import type { DraftResult } from '../lib/types';

const result: DraftResult = {
  generatedAt: '2026-01-01T00:00:00.000Z', draftType: 'balanced', avoidOverrides: 0, constraintOverrides: 0,
  teams: [{ teamIndex: 0, captain: { id: 'c', name: 'Cap, One' }, averageScore: 7, players: [{ id: 'p', name: 'Player & Pal', averageScore: 7 }] }],
};

describe('result exports', () => {
  it('creates spreadsheet-safe CSV', () => expect(resultCsv(result)).toContain('"Cap, One"'));
  it('creates Discord-friendly markdown', () => expect(resultMarkdown('Bingo', result)).toContain('## Team 1'));
  it('escapes names in the image export', () => expect(resultSvg('Bingo', result)).toContain('Player &amp; Pal'));
});
