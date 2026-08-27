import type { BingoBoardScope, BingoMode, BingoVerificationMode } from './types';

export type BingoTaskDefinition = {
  id?: string;
  title: string;
  description: string;
  points: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  verificationMode: BingoVerificationMode;
  repeatable: boolean;
  maxCompletions: number;
  hidden: boolean;
  freeSpace: boolean;
  iconKey: string;
};

export type BingoTemplateDefinition = {
  key: string;
  name: string;
  description: string;
  mode: BingoMode;
  boardScope: BingoBoardScope;
  winCondition: 'lines' | 'points' | 'blackout';
  targetValue: number;
  gridSize: number;
  tasks: BingoTaskDefinition[];
};

const taskSeeds: Array<[string, number, string, BingoVerificationMode, BingoTaskDefinition['difficulty']]> = [
  ['Gain a combat level', 25, 'Progress', 'stat_delta', 'easy'],
  ['Complete any hard clue', 35, 'Clues', 'screenshot', 'easy'],
  ['Receive a boss unique', 80, 'Bossing', 'hybrid', 'hard'],
  ['Gain 500,000 total XP', 55, 'Skilling', 'stat_delta', 'medium'],
  ['Win a team minigame', 40, 'Teamwork', 'screenshot', 'medium'],
  ['Complete an achievement diary task', 30, 'Progress', 'screenshot', 'easy'],
  ['Complete any raid', 100, 'Raids', 'hybrid', 'hard'],
  ['Add a collection-log slot', 65, 'Collection', 'screenshot', 'medium'],
  ['Receive a clue unique', 50, 'Clues', 'screenshot', 'medium'],
  ['Gain 1,000,000 XP in one skill', 90, 'Skilling', 'stat_delta', 'hard'],
  ['Receive a Slayer unique', 60, 'Slayer', 'hybrid', 'medium'],
  ['Complete a perfect boss kill', 85, 'Bossing', 'screenshot', 'hard'],
  ['Terry\'s free space', 0, 'Free', 'manual', 'easy'],
  ['Complete a skilling challenge', 45, 'Skilling', 'screenshot', 'medium'],
  ['Catch a rare resource', 55, 'Gathering', 'hybrid', 'medium'],
  ['Complete a speed challenge', 75, 'Speed', 'screenshot', 'hard'],
  ['Defeat a group boss with teammates', 110, 'Teamwork', 'hybrid', 'legendary'],
  ['Earn a meaningful gear upgrade', 70, 'Gear', 'screenshot', 'hard'],
  ['Complete a master-level clue', 80, 'Clues', 'screenshot', 'hard'],
  ['Receive a one-in-1,000 or rarer drop', 125, 'Fortune', 'hybrid', 'legendary'],
  ['Win three minigame rounds', 45, 'Minigames', 'screenshot', 'medium'],
  ['Gather a stack of 5,000 resources', 50, 'Gathering', 'screenshot', 'medium'],
  ['Complete a combat achievement', 70, 'Combat', 'screenshot', 'hard'],
  ['Take a full-team victory photo', 25, 'Teamwork', 'screenshot', 'easy'],
  ['Complete the final clan challenge', 150, 'Finale', 'hybrid', 'legendary'],
];

function tasksFor(mode: BingoMode): BingoTaskDefinition[] {
  return taskSeeds.map(([title, points, category, verificationMode, difficulty], index) => ({
    title,
    description: title === "Terry's free space"
      ? 'Every team begins with this square completed.'
      : `Complete “${title}” during the event and submit the requested evidence.`,
    points: mode === 'classic' ? (index === 12 ? 0 : 1) : points,
    category,
    difficulty,
    verificationMode,
    repeatable: false,
    maxCompletions: 1,
    hidden: false,
    freeSpace: index === 12 && mode === 'classic',
    iconKey: iconFor(category),
  }));
}

export const BUILTIN_BINGO_TEMPLATES: BingoTemplateDefinition[] = [
  {
    key: 'classic', name: 'Classic 5 × 5', mode: 'classic', boardScope: 'per_team',
    description: 'Every team receives the same board. Complete a row, column, or diagonal first.',
    winCondition: 'lines', targetValue: 1, gridSize: 5, tasks: tasksFor('classic'),
  },
  {
    key: 'points', name: 'Weekend points hunt', mode: 'points', boardScope: 'per_team',
    description: 'Every verified tile scores its listed value. Highest score at the deadline wins.',
    winCondition: 'points', targetValue: 0, gridSize: 5, tasks: tasksFor('points'),
  },
  {
    key: 'lockout', name: 'Shared lockout', mode: 'lockout', boardScope: 'shared',
    description: 'The first team approved on a tile owns it permanently. Most points wins.',
    winCondition: 'points', targetValue: 0, gridSize: 5, tasks: tasksFor('lockout'),
  },
];

export function getBuiltinBingoTemplate(key: unknown) {
  return BUILTIN_BINGO_TEMPLATES.find((template) => template.key === key) ?? BUILTIN_BINGO_TEMPLATES[1];
}

export function sanitizeBingoTasks(value: unknown, expectedCount: number): BingoTaskDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, expectedCount).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const title = textValue(item.title, 80);
    if (!title) return [];
    const verificationMode = ['manual', 'screenshot', 'stat_delta', 'hybrid'].includes(String(item.verificationMode))
      ? String(item.verificationMode) as BingoVerificationMode
      : 'manual';
    const difficulty = ['easy', 'medium', 'hard', 'legendary'].includes(String(item.difficulty))
      ? String(item.difficulty) as BingoTaskDefinition['difficulty']
      : 'medium';
    const freeSpace = item.freeSpace === true || /^free(?:\s+space)?$/i.test(title);
    return [{
      title: freeSpace ? 'Terry\'s free space' : title,
      description: textValue(item.description, 400),
      points: freeSpace ? 0 : clampInteger(item.points, 0, 10_000, index + 1),
      category: textValue(item.category, 40) || 'General',
      difficulty,
      verificationMode,
      repeatable: item.repeatable === true,
      maxCompletions: item.repeatable === true ? clampInteger(item.maxCompletions, 1, 100, 1) : 1,
      hidden: item.hidden === true,
      freeSpace,
      iconKey: textValue(item.iconKey, 24) || iconFor(textValue(item.category, 40)),
    }];
  });
}

export function parseBingoTaskImport(value: string): BingoTaskDefinition[] {
  return value.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    const fields = splitImportLine(line);
    const title = fields[0]?.trim() ?? '';
    if (!title || /^(task|title)$/i.test(title) && index === 0) return [];
    const verification = fields[3]?.trim().toLowerCase().replace(/\s+/g, '_');
    return sanitizeBingoTasks([{
      title,
      points: fields[1]?.trim() || index + 1,
      category: fields[2]?.trim() || 'General',
      verificationMode: verification,
      description: fields[4]?.trim() || '',
      freeSpace: /^free(?:\s+space)?$/i.test(title),
    }], 1);
  });
}

export function serializeBingoTaskImport(tasks: BingoTaskDefinition[]) {
  return tasks.map((task) => [task.title, task.points, task.category, task.verificationMode, task.description]
    .map((value) => String(value).replace(/\|/g, '/')).join(' | ')).join('\n');
}

function splitImportLine(line: string) {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes('|')) return line.split('|');
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { fields.push(field); field = ''; }
    else field += character;
  }
  fields.push(field);
  return fields;
}

function iconFor(category: string) {
  const value = category.toLowerCase();
  if (/boss|combat|slayer/.test(value)) return 'swords';
  if (/skill|gather/.test(value)) return 'tools';
  if (/clue|collection/.test(value)) return 'chest';
  if (/raid|team/.test(value)) return 'banner';
  if (/fortune|rare/.test(value)) return 'gem';
  return 'scroll';
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}
