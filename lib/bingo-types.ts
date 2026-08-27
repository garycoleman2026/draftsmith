import {
  defaultBingoEventRules,
  defaultBingoTaskRule,
  sanitizeBingoEventRules,
  sanitizeBingoTaskRule,
  verificationModeFromRule,
  type BingoEventRules,
  type BingoProofSource,
  type BingoTaskRule,
  type BingoTaskScope,
  type BingoVerifierType,
} from './bingo-rules';
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
  rule: BingoTaskRule;
};

export type BingoTemplateDefinition = {
  schemaVersion: 1;
  key: string;
  name: string;
  description: string;
  mode: BingoMode;
  boardScope: BingoBoardScope;
  winCondition: BingoEventRules['scoring']['winCondition'];
  targetValue: number;
  gridSize: number;
  rules: BingoEventRules;
  tasks: BingoTaskDefinition[];
};

type PresetOptions = {
  difficulty?: BingoTaskDefinition['difficulty'];
  target?: string;
  targetId?: number;
  metric?: string;
  amount?: number;
  comparator?: BingoTaskRule['verifier']['comparator'];
  unit?: string;
  scope?: BingoTaskScope;
  participantCount?: number;
  description?: string;
  sources?: BingoProofSource[];
};

function preset(title: string, points: number, category: string, verifierType: BingoVerifierType, options: PresetOptions = {}): BingoTaskDefinition {
  const sources = options.sources ?? proofSourcesFor(verifierType);
  const rule = sanitizeBingoTaskRule({
    verifier: {
      type: verifierType, target: options.target ?? '', targetId: options.targetId ?? null,
      metric: options.metric ?? '', amount: options.amount ?? null,
      comparator: options.comparator ?? (verifierType === 'raid_time' ? 'at_most' : 'at_least'), unit: options.unit ?? '',
    },
    scope: { type: options.scope ?? 'any_member', participantCount: options.participantCount ?? null },
    proof: { sources, approval: sources.length > 1 ? 'hybrid' : 'review' },
    prerequisitePositions: [],
  });
  return {
    title,
    description: options.description ?? descriptionFor(title, rule),
    points,
    category,
    difficulty: options.difficulty ?? 'medium',
    verificationMode: verificationModeFromRule(rule),
    repeatable: false,
    maxCompletions: 1,
    hidden: false,
    freeSpace: false,
    iconKey: iconFor(category),
    rule,
  };
}

export const OSRS_BINGO_PRESETS: BingoTaskDefinition[] = [
  preset('Get an Oathplate helm', 180, 'Gear', 'item_acquired', { target: 'Oathplate helm', difficulty: 'hard' }),
  preset('Obtain the Baby mole pet', 900, 'Pets', 'pet_obtained', { target: 'Baby mole', difficulty: 'legendary' }),
  preset('Receive a Twisted ancestral colour kit', 650, 'Raids', 'item_acquired', { target: 'Twisted ancestral colour kit', difficulty: 'legendary' }),
  preset('Beat the GM Theatre of Blood trio time', 750, 'Speed', 'raid_time', { target: 'Theatre of Blood', metric: 'trio', unit: 'seconds', scope: 'exact_party', participantCount: 3, difficulty: 'legendary', description: 'Exactly three linked team members complete Theatre of Blood under the organizer-entered GM target time.' }),
  preset('Beat the Chambers CM five-player time', 750, 'Speed', 'raid_time', { target: 'Chambers of Xeric: Challenge Mode', metric: 'five-player', unit: 'seconds', scope: 'exact_party', participantCount: 5, difficulty: 'legendary', description: 'Exactly five linked team members complete Challenge Mode under the organizer-entered target time.' }),
  preset('Gain 10,000,000 team Agility XP', 500, 'Skilling', 'xp_gain', { metric: 'agility', amount: 10_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', sources: ['wise_old_man', 'runelite', 'screenshot'] }),
  preset('Receive any boss unique', 80, 'Bossing', 'item_acquired', { target: 'Any boss unique', difficulty: 'medium' }),
  preset('Complete any raid', 100, 'Raids', 'raid_complete', { target: 'Any raid', difficulty: 'medium' }),
  preset('Receive a Chambers of Xeric purple', 220, 'Raids', 'item_acquired', { target: 'Chambers of Xeric unique', difficulty: 'hard' }),
  preset('Receive a Theatre of Blood purple', 250, 'Raids', 'item_acquired', { target: 'Theatre of Blood unique', difficulty: 'hard' }),
  preset('Receive a Tombs of Amascut purple', 220, 'Raids', 'item_acquired', { target: 'Tombs of Amascut unique', difficulty: 'hard' }),
  preset("Receive Tumeken's shadow", 900, 'Raids', 'item_acquired', { target: "Tumeken's shadow", difficulty: 'legendary' }),
  preset('Receive a twisted bow', 1_000, 'Raids', 'item_acquired', { target: 'Twisted bow', difficulty: 'legendary' }),
  preset('Receive a scythe of Vitur', 1_000, 'Raids', 'item_acquired', { target: 'Scythe of Vitur', difficulty: 'legendary' }),
  preset('Receive an enhanced crystal weapon seed', 300, 'Gear', 'item_acquired', { target: 'Enhanced crystal weapon seed', difficulty: 'hard' }),
  preset('Obtain any new pet', 800, 'Pets', 'pet_obtained', { target: 'Any pet', difficulty: 'legendary' }),
  preset('Add three collection-log slots', 120, 'Collection', 'collection_log', { amount: 3, unit: 'slots', difficulty: 'medium' }),
  preset('Complete any combat achievement', 55, 'Combat', 'combat_achievement', { target: 'Any combat achievement', difficulty: 'easy' }),
  preset('Complete a grandmaster combat achievement', 250, 'Combat', 'combat_achievement', { target: 'Grandmaster combat achievement', difficulty: 'hard' }),
  preset('Complete a master clue', 90, 'Clues', 'clue_complete', { target: 'Master clue', difficulty: 'medium' }),
  preset('Complete an elite clue', 65, 'Clues', 'clue_complete', { target: 'Elite clue', difficulty: 'medium' }),
  preset('Gain 1,000,000 Runecraft XP', 150, 'Skilling', 'xp_gain', { metric: 'runecraft', amount: 1_000_000, unit: 'XP', difficulty: 'hard', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 5,000,000 team Slayer XP', 250, 'Skilling', 'xp_gain', { metric: 'slayer', amount: 5_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 25,000,000 total team XP', 350, 'Skilling', 'xp_gain', { metric: 'overall', amount: 25_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', sources: ['wise_old_man', 'runelite'] }),
  preset('Reach level 99 in any skill', 180, 'Progress', 'level_reached', { amount: 99, unit: 'level', difficulty: 'hard', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 25 Giant Mole kill count', 70, 'Bossing', 'boss_kc', { metric: 'giant_mole', amount: 25, unit: 'KC', difficulty: 'easy', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 50 Zulrah kill count', 90, 'Bossing', 'boss_kc', { metric: 'zulrah', amount: 50, unit: 'KC', difficulty: 'medium', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 50 Vorkath kill count', 90, 'Bossing', 'boss_kc', { metric: 'vorkath', amount: 50, unit: 'KC', difficulty: 'medium', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 25 Nex kill count', 180, 'Bossing', 'boss_kc', { metric: 'nex', amount: 25, unit: 'KC', difficulty: 'hard', sources: ['wise_old_man', 'runelite'] }),
  preset('Complete ten Theatre of Blood raids', 220, 'Raids', 'raid_complete', { target: 'Theatre of Blood', amount: 10, unit: 'completions', scope: 'team_total', difficulty: 'hard' }),
  preset('Complete ten Chambers challenge modes', 220, 'Raids', 'raid_complete', { target: 'Chambers of Xeric: Challenge Mode', amount: 10, unit: 'completions', scope: 'team_total', difficulty: 'hard' }),
  preset('Complete twenty expert Tombs of Amascut raids', 260, 'Raids', 'raid_complete', { target: 'Tombs of Amascut: Expert Mode', amount: 20, unit: 'completions', scope: 'team_total', difficulty: 'hard' }),
  preset('Set a new raid personal best', 140, 'Speed', 'raid_time', { target: 'Any raid personal best', difficulty: 'hard' }),
  preset('Earn an infernal cape', 500, 'Combat', 'item_acquired', { target: 'Infernal cape', difficulty: 'legendary' }),
  preset("Earn Dizana's quiver", 450, 'Combat', 'item_acquired', { target: "Dizana's quiver", difficulty: 'legendary' }),
  preset('Earn a fire cape', 100, 'Combat', 'item_acquired', { target: 'Fire cape', difficulty: 'medium' }),
  preset('Complete one Barrows armour set', 180, 'Gear', 'team_challenge', { target: 'Complete Barrows armour set', difficulty: 'hard' }),
  preset('Complete any godsword', 220, 'Gear', 'team_challenge', { target: 'Completed godsword', difficulty: 'hard' }),
  preset('Complete a crystal armour set', 260, 'Gear', 'team_challenge', { target: 'Crystal armour set', difficulty: 'hard' }),
  preset('Receive an abyssal whip', 65, 'Slayer', 'item_acquired', { target: 'Abyssal whip', difficulty: 'easy' }),
  preset('Receive a primordial crystal', 150, 'Slayer', 'item_acquired', { target: 'Primordial crystal', difficulty: 'hard' }),
  preset('Receive a zenyte shard', 120, 'Gear', 'item_acquired', { target: 'Zenyte shard', difficulty: 'medium' }),
  preset('Receive a dragon warhammer', 250, 'Gear', 'item_acquired', { target: 'Dragon warhammer', difficulty: 'hard' }),
  preset('Receive any draconic visage', 220, 'Gear', 'item_acquired', { target: 'Any draconic visage', difficulty: 'hard' }),
  preset('Receive a clue mega-rare', 700, 'Clues', 'item_acquired', { target: 'Clue mega-rare', difficulty: 'legendary' }),
  preset('Complete a raid with three teammates', 120, 'Teamwork', 'raid_complete', { target: 'Any raid', scope: 'exact_party', participantCount: 4, difficulty: 'medium' }),
  preset('Take a full-team victory photo', 40, 'Teamwork', 'team_challenge', { target: 'Full-team photo', scope: 'all_members', difficulty: 'easy', sources: ['screenshot'] }),
  preset('Receive any skilling-boss unique', 90, 'Skilling', 'item_acquired', { target: 'Any skilling-boss unique', difficulty: 'medium' }),
  preset('Receive a Tempoross unique', 75, 'Skilling', 'item_acquired', { target: 'Tempoross unique', difficulty: 'medium' }),
  preset('Receive a tome of fire', 100, 'Skilling', 'item_acquired', { target: 'Tome of fire', difficulty: 'medium' }),
  preset('Complete 100 Hallowed Sepulchre laps', 180, 'Skilling', 'team_challenge', { target: 'Hallowed Sepulchre', amount: 100, unit: 'laps', scope: 'team_total', difficulty: 'hard' }),
  preset('Receive a drop worth at least 5m', 160, 'Fortune', 'item_acquired', { metric: 'ge_value', amount: 5_000_000, unit: 'GP', difficulty: 'hard' }),
  preset('Complete a perfect boss kill', 150, 'Combat', 'combat_achievement', { target: 'Perfect boss kill', difficulty: 'hard' }),
  preset('Complete any speed combat achievement', 150, 'Speed', 'combat_achievement', { target: 'Speed combat achievement', difficulty: 'hard' }),
  preset('Defeat three different bosses in one hour', 100, 'Bossing', 'team_challenge', { target: 'Three different bosses', amount: 60, unit: 'minutes', difficulty: 'medium' }),
  preset('Gain 10,000,000 team Hunter XP', 450, 'Skilling', 'xp_gain', { metric: 'hunter', amount: 10_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 2,000,000 team Mining XP', 180, 'Skilling', 'xp_gain', { metric: 'mining', amount: 2_000_000, unit: 'XP', scope: 'team_total', difficulty: 'medium', sources: ['wise_old_man', 'runelite'] }),
  preset('Receive a champion scroll', 240, 'Collection', 'item_acquired', { target: 'Any champion scroll', difficulty: 'hard' }),
  preset('Receive any boss jar', 300, 'Collection', 'item_acquired', { target: 'Any boss jar', difficulty: 'hard' }),
  preset('Complete the organizer final challenge', 500, 'Finale', 'manual', { target: 'Organizer final challenge', scope: 'all_members', difficulty: 'legendary', sources: ['screenshot', 'organizer'] }),
];

function tasksFor(mode: BingoMode): BingoTaskDefinition[] {
  const selected = [
    6, 19, 8, 21, 25, 46, 9, 16, 41, 26, 39, 52, 17, 47, 42, 32, 28, 36, 18, 48, 49, 22, 53, 44, 59,
  ].map((index) => structuredClone(OSRS_BINGO_PRESETS[index]));
  if (mode === 'classic') {
    selected.forEach((task) => { task.points = 1; });
    selected[12] = freeSpace();
  }
  if (mode === 'progression') {
    selected.forEach((task, index) => {
      const row = Math.floor(index / 5);
      task.rule.prerequisitePositions = row === 0 ? [] : [index - 5];
      task.hidden = row > 0;
    });
  }
  return selected;
}

function template(key: string, name: string, description: string, mode: BingoMode, winCondition: BingoEventRules['scoring']['winCondition']): BingoTemplateDefinition {
  const rules = defaultBingoEventRules(5, winCondition);
  if (mode === 'progression') rules.visibility.hideLockedTasks = true;
  if (mode === 'categories') rules.scoring.categoryTarget = 2;
  return {
    schemaVersion: 1, key, name, description, mode,
    boardScope: mode === 'lockout' ? 'shared' : 'per_team', winCondition,
    targetValue: rules.scoring.targetValue, gridSize: 5, rules, tasks: tasksFor(mode),
  };
}

export const BUILTIN_BINGO_TEMPLATES: BingoTemplateDefinition[] = [
  template('classic', 'Classic 5 × 5', 'Complete a row, column, or diagonal first.', 'classic', 'lines'),
  template('points', 'Weekend points hunt', 'Every verified tile scores its listed value.', 'points', 'points'),
  template('lockout', 'Shared lockout', 'The first approved team owns each tile permanently.', 'lockout', 'points'),
  template('blackout', 'Blackout race', 'Complete the whole board before the other teams.', 'blackout', 'blackout'),
  template('progression', 'Tiered expedition', 'Each row unlocks after the matching task above it is complete.', 'progression', 'points'),
  template('categories', 'Category conquest', 'Complete enough tasks across the broadest set of categories.', 'categories', 'categories'),
];

export function getBuiltinBingoTemplate(key: unknown) {
  return BUILTIN_BINGO_TEMPLATES.find((item) => item.key === key) ?? BUILTIN_BINGO_TEMPLATES[1];
}

export function sanitizeBingoTemplate(value: unknown, fallback = BUILTIN_BINGO_TEMPLATES[1]): BingoTemplateDefinition {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const gridSize = clampInteger(input.gridSize, 3, 7, fallback.gridSize);
  const mode = ['classic', 'points', 'lockout', 'blackout', 'progression', 'categories'].includes(String(input.mode))
    ? String(input.mode) as BingoMode
    : fallback.mode;
  const rules = sanitizeBingoEventRules(input.rules, gridSize, fallback.winCondition);
  const expected = rules.layout.rows * rules.layout.columns;
  const tasks = sanitizeBingoTasks(input.tasks, expected);
  return {
    schemaVersion: 1,
    key: textValue(input.key, 80) || fallback.key,
    name: textValue(input.name, 80) || fallback.name,
    description: textValue(input.description, 300) || fallback.description,
    mode,
    boardScope: mode === 'lockout' ? 'shared' : input.boardScope === 'shared' ? 'shared' : 'per_team',
    winCondition: rules.scoring.winCondition,
    targetValue: rules.scoring.targetValue,
    gridSize: rules.layout.rows,
    rules,
    tasks,
  };
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
    const free = item.freeSpace === true || /^free(?:\s+space)?$/i.test(title);
    const rule = free ? defaultBingoTaskRule('manual') : sanitizeBingoTaskRule(item.rule, verificationMode);
    return [{
      title: free ? "Terry's free space" : title,
      description: textValue(item.description, 400),
      points: free ? 0 : clampInteger(item.points, 0, 10_000, index + 1),
      category: free ? 'Free' : textValue(item.category, 40) || 'General',
      difficulty,
      verificationMode: free ? 'manual' : verificationModeFromRule(rule),
      repeatable: !free && item.repeatable === true,
      maxCompletions: !free && item.repeatable === true ? clampInteger(item.maxCompletions, 1, 100, 1) : 1,
      hidden: !free && item.hidden === true,
      freeSpace: free,
      iconKey: textValue(item.iconKey, 24) || iconFor(textValue(item.category, 40)),
      rule,
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
    const verifierType = fields[5]?.trim().toLowerCase().replace(/\s+/g, '_');
    const scope = fields[9]?.trim().toLowerCase().replace(/\s+/g, '_');
    const sources = fields[12]?.split(/[+,;]/).map((source) => source.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
    const prerequisites = fields[11]?.split(/[+,;]/).map((position) => Number(position.trim()) - 1).filter(Number.isInteger) ?? [];
    return sanitizeBingoTasks([{
      title,
      points: fields[1]?.trim() || index + 1,
      category: fields[2]?.trim() || 'General',
      verificationMode: verification,
      description: fields[4]?.trim() || '',
      freeSpace: /^free(?:\s+space)?$/i.test(title),
      rule: {
        verifier: {
          type: verifierType, target: fields[6]?.trim(), amount: fields[7]?.trim(), unit: fields[8]?.trim(),
          metric: fields[13]?.trim(), comparator: fields[14]?.trim(), targetId: fields[15]?.trim(),
        },
        scope: { type: scope, participantCount: fields[10]?.trim() },
        proof: { sources, approval: sources && sources.length > 1 ? 'hybrid' : 'review' },
        prerequisitePositions: prerequisites,
      },
    }], 1);
  });
}

export function serializeBingoTaskImport(tasks: BingoTaskDefinition[]) {
  return tasks.map((task) => [
    task.title, task.points, task.category, task.verificationMode, task.description,
    task.rule.verifier.type, task.rule.verifier.target, task.rule.verifier.amount ?? '', task.rule.verifier.unit,
    task.rule.scope.type, task.rule.scope.participantCount ?? '',
    task.rule.prerequisitePositions.map((position) => position + 1).join(','), task.rule.proof.sources.join(','),
    task.rule.verifier.metric, task.rule.verifier.comparator, task.rule.verifier.targetId ?? '',
  ].map((value) => String(value).replace(/\|/g, '/')).join(' | ')).join('\n');
}

export function iconFor(category: string) {
  const value = category.toLowerCase();
  if (/boss|combat|slayer|speed/.test(value)) return 'swords';
  if (/skill|gather/.test(value)) return 'tools';
  if (/clue|collection/.test(value)) return 'chest';
  if (/raid|team/.test(value)) return 'banner';
  if (/fortune|rare|pet/.test(value)) return 'gem';
  return 'scroll';
}

function freeSpace(): BingoTaskDefinition {
  return {
    title: "Terry's free space", description: 'Every team begins with this square completed.', points: 0,
    category: 'Free', difficulty: 'easy', verificationMode: 'manual', repeatable: false, maxCompletions: 1,
    hidden: false, freeSpace: true, iconKey: 'scroll', rule: defaultBingoTaskRule('manual'),
  };
}
function proofSourcesFor(type: BingoVerifierType): BingoProofSource[] {
  if (['xp_gain', 'level_reached', 'boss_kc'].includes(type)) return ['wise_old_man', 'runelite', 'screenshot'];
  if (['manual', 'team_challenge'].includes(type)) return ['screenshot', 'organizer'];
  return ['runelite', 'screenshot'];
}
function descriptionFor(title: string, rule: BingoTaskRule) {
  const scope = rule.scope.type === 'team_total' ? 'The whole team may contribute.'
    : rule.scope.type === 'exact_party' ? `Requires exactly ${rule.scope.participantCount ?? '?'} participating team members.`
      : rule.scope.type === 'all_members' ? 'Every rostered team member must participate.' : 'Any team member may complete this task.';
  return `${title} during the event. ${scope}`;
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
function textValue(value: unknown, maxLength: number) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''; }
function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}
