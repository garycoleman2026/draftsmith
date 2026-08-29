import { describe, expect, it } from 'vitest';
import { dashboardEventKind, dashboardEventVisibility, extractClanInviteToken } from '../lib/dashboard';

describe('account dashboard organization', () => {
  it('separates draft and bingo events with explicit visibility', () => {
    expect(dashboardEventKind({ bingo_id: null })).toBe('Draft event');
    expect(dashboardEventKind({ bingo_id: 'bingo-1' })).toBe('Bingo event');
    expect(dashboardEventVisibility({ bingo_id: 'bingo-1', bingo_public_spectator: 0 })).toBe('Private');
    expect(dashboardEventVisibility({ bingo_id: 'bingo-1', bingo_public_spectator: 1, bingo_public_listed: 0 })).toBe('Unlisted link');
    expect(dashboardEventVisibility({ bingo_id: 'bingo-1', bingo_public_spectator: 1, bingo_public_listed: 1 })).toBe('Publicly listed');
    expect(dashboardEventVisibility({ public_slug: null })).toBe('Private organizer link');
  });

  it('accepts a clan invite link or its token', () => {
    const token = 'abcdEFGH_1234-5678-join-token';
    expect(extractClanInviteToken(token)).toBe(token);
    expect(extractClanInviteToken(`https://terrys.example/clans/join/${token}?from=discord`)).toBe(token);
    expect(extractClanInviteToken('not a valid invite')).toBe('');
  });
});
