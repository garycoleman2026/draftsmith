import { describe, expect, it } from 'vitest';
import { parseStandaloneBingoRoster, sanitizeStandaloneBingoTeams } from '../lib/bingo-roster';

describe('standalone bingo roster parsing', () => {
  it('parses blank-line team sections and preserves player order', () => {
    const result = parseStandaloneBingoRoster(`Team Dragon
Zezima
Wise Old Man

Team Raven
Lynx Titan
Settled`);

    expect(result.errors).toEqual([]);
    expect(result.playerCount).toBe(4);
    expect(result.teams).toEqual([
      { name: 'Team Dragon', players: ['Zezima', 'Wise Old Man'] },
      { name: 'Team Raven', players: ['Lynx Titan', 'Settled'] },
    ]);
  });

  it('accepts one-line colon teams with comma-separated players', () => {
    const result = parseStandaloneBingoRoster(`Dragon: Zezima, Settled
Raven: Lynx Titan; A Friend`);

    expect(result.errors).toEqual([]);
    expect(result.teams[0]).toEqual({ name: 'Dragon', players: ['Zezima', 'Settled'] });
    expect(result.teams[1]).toEqual({ name: 'Raven', players: ['Lynx Titan', 'A Friend'] });
  });

  it('rejects a player assigned to more than one team', () => {
    const result = parseStandaloneBingoRoster(`Dragon
Zezima

Raven
Zezima`);

    expect(result.errors).toContain('“Zezima” is assigned to both Dragon and Raven.');
    expect(result.playerCount).toBe(1);
  });

  it('validates server-provided team structures and OSRS names', () => {
    const result = sanitizeStandaloneBingoTeams([
      { name: 'Dragon', players: ['Valid Name'] },
      { name: 'Raven', players: ['This name is much too long'] },
    ]);

    expect(result.errors.some((error) => error.includes('Invalid in-game name'))).toBe(true);
    expect(result.errors).toContain('Raven needs at least one player.');
  });

  it('requires between two and eight populated teams', () => {
    expect(sanitizeStandaloneBingoTeams([{ name: 'Solo', players: ['Zezima'] }]).errors[0])
      .toBe('Add at least 2 teams.');
    const tooMany = Array.from({ length: 9 }, (_, index) => ({ name: `Team ${index}`, players: [`P${index}`] }));
    expect(sanitizeStandaloneBingoTeams(tooMany).errors[0]).toBe('Bingo events can include up to 8 teams.');
  });
});
