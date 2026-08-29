export type DashboardEventVisibilityInput = {
  bingo_id?: string | null;
  bingo_public_spectator?: number | boolean | null;
  bingo_public_listed?: number | boolean | null;
  public_slug?: string | null;
};

export function dashboardEventKind(event: DashboardEventVisibilityInput) {
  return event.bingo_id ? 'Bingo event' : 'Draft event';
}

export function dashboardEventVisibility(event: DashboardEventVisibilityInput) {
  if (event.bingo_id) {
    if (!event.bingo_public_spectator) return 'Private';
    return event.bingo_public_listed ? 'Publicly listed' : 'Unlisted link';
  }
  return event.public_slug ? 'Unlisted link' : 'Private organizer link';
}

export function extractClanInviteToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  let candidate = trimmed;
  try {
    const parsed = new URL(trimmed, 'https://terrys.invalid');
    const match = parsed.pathname.match(/\/clans\/join\/([^/]+)/i);
    if (match) candidate = match[1];
  } catch {
    candidate = trimmed;
  }
  candidate = candidate.replace(/^.*\/clans\/join\//i, '').split(/[?#/]/)[0];
  return /^[A-Za-z0-9_-]{20,160}$/.test(candidate) ? candidate : '';
}
