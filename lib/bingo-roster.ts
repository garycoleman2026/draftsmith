import {
  MAX_ROSTER_SIZE,
  MAX_TEAM_COUNT,
  MIN_TEAM_COUNT,
  cleanRsn,
  normalizeRsn,
  validateRsn,
} from './validation';

export type StandaloneBingoTeam = {
  name: string;
  players: string[];
};

export type StandaloneBingoRosterResult = {
  teams: StandaloneBingoTeam[];
  errors: string[];
  playerCount: number;
};

export const STANDALONE_BINGO_ROSTER_EXAMPLE = `Team Dragon
Zezima
Wise Old Man
Settled

Team Raven
Lynx Titan
A Friend
Solo Mission`;

export function parseStandaloneBingoRoster(value: string): StandaloneBingoRosterResult {
  const normalized = value.replace(/\r\n?/g, '\n');
  const nonEmptyLines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (nonEmptyLines.length >= MIN_TEAM_COUNT && nonEmptyLines.every((line) => line.includes(':'))) {
    return sanitizeStandaloneBingoTeams(nonEmptyLines.map((line) => {
      const separator = line.indexOf(':');
      return { name: line.slice(0, separator), players: splitPlayerLines([line.slice(separator + 1)]) };
    }));
  }

  const sections = normalized
    .split(/\n\s*\n+/)
    .map((section) => section.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((section) => section.length > 0);

  const teams = sections.flatMap((section) => {
    if (section.length === 1 && section[0].includes(':')) {
      const separator = section[0].indexOf(':');
      return [{
        name: section[0].slice(0, separator),
        players: splitPlayerLines([section[0].slice(separator + 1)]),
      }];
    }
    return [{ name: (section[0] ?? '').replace(/:\s*$/, ''), players: splitPlayerLines(section.slice(1)) }];
  });
  return sanitizeStandaloneBingoTeams(teams);
}

export function sanitizeStandaloneBingoTeams(value: unknown): StandaloneBingoRosterResult {
  if (!Array.isArray(value)) return { teams: [], errors: ['Paste at least two team sections.'], playerCount: 0 };

  const teams: StandaloneBingoTeam[] = [];
  const errors: string[] = [];
  const teamNames = new Set<string>();
  const rosterNames = new Map<string, string>();

  for (const [index, item] of value.slice(0, MAX_TEAM_COUNT + 1).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`Team ${index + 1} is not formatted correctly.`);
      continue;
    }
    const raw = item as Record<string, unknown>;
    const name = cleanTeamName(raw.name);
    const rawPlayers = Array.isArray(raw.players) ? raw.players : [];
    const players: string[] = [];
    const localNames = new Set<string>();

    if (!name) errors.push(`Team ${index + 1} needs a name.`);
    else if (name.length > 60) errors.push(`“${name.slice(0, 30)}…” is longer than 60 characters.`);
    else {
      const key = name.toLocaleLowerCase('en-US');
      if (teamNames.has(key)) errors.push(`Team name “${name}” is used more than once.`);
      teamNames.add(key);
    }

    for (const candidate of rawPlayers) {
      if (typeof candidate !== 'string') continue;
      const player = cleanRsn(candidate);
      if (!player) continue;
      const validationError = validateRsn(player);
      if (validationError) {
        errors.push(`Invalid in-game name “${player}”. ${validationError}`);
        continue;
      }
      const key = normalizeRsn(player);
      if (localNames.has(key)) {
        errors.push(`“${player}” appears more than once on ${name || `team ${index + 1}`}.`);
        continue;
      }
      const earlierTeam = rosterNames.get(key);
      if (earlierTeam) {
        errors.push(`“${player}” is assigned to both ${earlierTeam} and ${name || `team ${index + 1}`}.`);
        continue;
      }
      localNames.add(key);
      rosterNames.set(key, name || `team ${index + 1}`);
      players.push(player);
    }
    if (!players.length) errors.push(`${name || `Team ${index + 1}`} needs at least one player.`);
    teams.push({ name, players });
  }

  if (value.length < MIN_TEAM_COUNT) errors.unshift(`Add at least ${MIN_TEAM_COUNT} teams.`);
  if (value.length > MAX_TEAM_COUNT) errors.unshift(`Bingo events can include up to ${MAX_TEAM_COUNT} teams.`);
  if (rosterNames.size > MAX_ROSTER_SIZE) errors.unshift(`Bingo events can include up to ${MAX_ROSTER_SIZE} players.`);

  return { teams, errors: [...new Set(errors)], playerCount: rosterNames.size };
}

function splitPlayerLines(lines: string[]) {
  return lines.flatMap((line) => line.split(/[,;]+/)).map((name) => name.trim()).filter(Boolean);
}

function cleanTeamName(value: unknown) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ')
    : '';
}
