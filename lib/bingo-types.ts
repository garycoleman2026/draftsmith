import {
  defaultBingoEventRules,
  defaultBingoTaskRule,
  expectedIndividualHours,
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
import { OSRS_BOSS_UNIQUE_DROPS } from './osrs-boss-uniques';

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
  imageKind?: BingoTaskRule['presentation']['imageKind'];
  imageKey?: string;
  notes?: string;
  exclusions?: string;
  sourceUrl?: string;
  dropRateNumerator?: number;
  dropRateDenominator?: number;
  efficientKillsPerHour?: number;
  efficientUnitsPerHour?: number;
  fixedHours?: number;
  quantity?: number;
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
    presentation: { imageKind: options.imageKind ?? 'none', imageKey: options.imageKey ?? '' },
    details: { notes: options.notes ?? '', exclusions: options.exclusions ?? '', sourceUrl: options.sourceUrl ?? '' },
    planning: {
      dropRateNumerator: options.dropRateNumerator ?? null,
      dropRateDenominator: options.dropRateDenominator ?? null,
      efficientKillsPerHour: options.efficientKillsPerHour ?? null,
      efficientUnitsPerHour: options.efficientUnitsPerHour ?? null,
      fixedHours: options.fixedHours ?? null,
      quantity: options.quantity ?? 1,
    },
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
  preset('Get an Oathplate helm', 180, 'Gear', 'item_acquired', { target: 'Oathplate helm', difficulty: 'hard', imageKind: 'item', imageKey: 'Oathplate helm', dropRateNumerator: 1, dropRateDenominator: 600, efficientKillsPerHour: 10, notes: 'Planning assumes solo Yama kills at 100% contribution and an efficient 10 kills per hour.', exclusions: 'Purchased, smithed, traded, or contract-guaranteed helms do not count unless the organizer explicitly allows them.', sourceUrl: 'https://oldschool.runescape.wiki/w/Yama' }),
  preset('Obtain the Baby mole pet', 900, 'Pets', 'pet_obtained', { target: 'Baby mole', difficulty: 'legendary', imageKind: 'item', imageKey: 'Baby Mole', dropRateNumerator: 1, dropRateDenominator: 3_000, efficientKillsPerHour: 85, notes: 'The 85 kills/hour planning rate assumes an experienced player with the Falador Hard Diary and strong gear.', exclusions: 'Existing pets and metamorphosis changes do not count; the pet must be received during the event.', sourceUrl: 'https://oldschool.runescape.wiki/w/Giant_Mole' }),
  preset('Receive a Twisted ancestral colour kit', 650, 'Raids', 'item_acquired', { target: 'Twisted ancestral colour kit', difficulty: 'legendary', imageKind: 'item', imageKey: 'Twisted ancestral colour kit', dropRateNumerator: 1, dropRateDenominator: 75, efficientKillsPerHour: 2.4, notes: 'Only Challenge Mode completions inside the kit-eligibility time can roll this tertiary reward. The rate assumes 25-minute efficient completions.', exclusions: 'Metamorphic dust, a standard purple, or a kit owned before the event does not count.', sourceUrl: 'https://oldschool.runescape.wiki/w/Twisted_ancestral_colour_kit' }),
  preset('Beat the GM Theatre of Blood trio time', 750, 'Speed', 'raid_time', { target: 'Theatre of Blood', metric: 'trio', amount: 1_050, unit: 'seconds', scope: 'exact_party', participantCount: 3, difficulty: 'legendary', imageKind: 'boss', imageKey: 'Verzik Vitur', notes: 'Complete Theatre of Blood with exactly three players in less than 17:30. The displayed time is the required speed target.', exclusions: 'Entry mode, hard mode, four-player raids, and times of exactly 17:30 or slower do not count.', sourceUrl: 'https://oldschool.runescape.wiki/w/Theatre_(Trio)_Speed-Runner', description: 'Exactly three linked team members complete Theatre of Blood in less than 17 minutes and 30 seconds.' }),
  preset('Beat the Chambers CM five-player time', 750, 'Speed', 'raid_time', { target: 'Chambers of Xeric: Challenge Mode', metric: 'five-player', amount: 1_500, unit: 'seconds', scope: 'exact_party', participantCount: 5, difficulty: 'legendary', imageKind: 'boss', imageKey: 'Great Olm', notes: 'Complete Challenge Mode with exactly five players in less than 25:00. The displayed time is the required speed target.', exclusions: 'Normal Chambers, other scales, and times of exactly 25:00 or slower do not count.', sourceUrl: 'https://oldschool.runescape.wiki/w/Chambers_of_Xeric', description: 'Exactly five linked team members complete Chambers of Xeric: Challenge Mode in less than 25 minutes.' }),
  preset('Gain 10,000,000 team Agility XP', 500, 'Skilling', 'xp_gain', { metric: 'agility', amount: 10_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', efficientUnitsPerHour: 100_000, imageKind: 'item', imageKey: 'Agility cape', notes: 'The planning estimate uses 100,000 Agility XP/hour per active player. Edit this to match your clan’s expected methods and levels.', exclusions: 'Only XP gained between the event baseline and final checkpoint counts.', sources: ['wise_old_man', 'runelite', 'screenshot'] }),
  preset('Receive a Berserker ring from Dagannoth Rex', 80, 'Bossing', 'item_acquired', { target: 'Berserker ring', difficulty: 'medium', imageKind: 'item', imageKey: 'Berserker ring', dropRateNumerator: 1, dropRateDenominator: 128, efficientKillsPerHour: 55, notes: 'Planning uses 55 Rex kills/hour for one individual.', exclusions: 'Other Dagannoth King rings do not count.' }),
  preset('Complete one Chambers of Xeric raid', 100, 'Raids', 'raid_complete', { target: 'Chambers of Xeric', amount: 1, unit: 'completion', difficulty: 'medium', imageKind: 'boss', imageKey: 'Great Olm', efficientKillsPerHour: 2 }),
  preset('Receive a dexterous prayer scroll', 220, 'Raids', 'item_acquired', { target: 'Dexterous prayer scroll', difficulty: 'hard', imageKind: 'item', imageKey: 'Dexterous prayer scroll', fixedHours: 45, notes: 'The starter estimate is fixed because Chambers unique chance changes with personal points and team scaling. Replace it with your clan’s expected raid level and points.', sourceUrl: 'https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Rewards' }),
  preset('Receive an avernic defender hilt', 250, 'Raids', 'item_acquired', { target: 'Avernic defender hilt', difficulty: 'hard', imageKind: 'item', imageKey: 'Avernic defender hilt', fixedHours: 20, notes: 'The starter estimate is editable because individual Theatre of Blood loot chance changes with party size, deaths, and performance.', sourceUrl: 'https://oldschool.runescape.wiki/w/Theatre_of_Blood/Rewards' }),
  preset("Receive Osmumten's fang", 220, 'Raids', 'item_acquired', { target: "Osmumten's fang", difficulty: 'hard', imageKind: 'item', imageKey: "Osmumten's fang" }),
  preset("Receive Tumeken's shadow", 900, 'Raids', 'item_acquired', { target: "Tumeken's shadow", difficulty: 'legendary', imageKind: 'item', imageKey: "Tumeken's shadow (uncharged)" }),
  preset('Receive a twisted bow', 1_000, 'Raids', 'item_acquired', { target: 'Twisted bow', difficulty: 'legendary', imageKind: 'item', imageKey: 'Twisted bow' }),
  preset('Receive a scythe of Vitur', 1_000, 'Raids', 'item_acquired', { target: 'Scythe of Vitur', difficulty: 'legendary', imageKind: 'item', imageKey: 'Scythe of Vitur (uncharged)' }),
  preset('Receive an enhanced crystal weapon seed', 300, 'Gear', 'item_acquired', { target: 'Enhanced crystal weapon seed', difficulty: 'hard', imageKind: 'item', imageKey: 'Enhanced crystal weapon seed', dropRateNumerator: 1, dropRateDenominator: 400, efficientKillsPerHour: 6 }),
  preset('Obtain the Vorki pet from Vorkath', 800, 'Pets', 'pet_obtained', { target: 'Vorki', difficulty: 'legendary', imageKind: 'item', imageKey: 'Vorki', dropRateNumerator: 1, dropRateDenominator: 3_000, efficientKillsPerHour: 30 }),
  preset('Add three collection-log slots', 120, 'Collection', 'collection_log', { amount: 3, unit: 'slots', difficulty: 'medium', fixedHours: 4, imageKind: 'item', imageKey: 'Collection log', description: 'Optionally track three new collection-log slots for a player or team with a fair event baseline.', notes: 'Optional library task only: this is excluded from every starter board because players with fuller collection logs have fewer easy unlocks. Use it only when teams have comparable baselines or after assigning account-specific targets.' }),
  preset('Complete a master clue', 90, 'Clues', 'clue_complete', { target: 'Master clue', amount: 1, unit: 'clue', difficulty: 'medium', efficientKillsPerHour: 0.5, imageKind: 'item', imageKey: 'Clue scroll (master)', notes: 'Starter rate assumes one master clue completion every two hours for an individual who already has the clue.' }),
  preset('Complete an elite clue', 65, 'Clues', 'clue_complete', { target: 'Elite clue', amount: 1, unit: 'clue', difficulty: 'medium', efficientKillsPerHour: 1, imageKind: 'item', imageKey: 'Clue scroll (elite)' }),
  preset('Gain 1,000,000 Runecraft XP', 150, 'Skilling', 'xp_gain', { metric: 'runecraft', amount: 1_000_000, unit: 'XP', difficulty: 'hard', efficientUnitsPerHour: 100_000, imageKind: 'item', imageKey: 'Runecraft cape', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 5,000,000 team Slayer XP', 250, 'Skilling', 'xp_gain', { metric: 'slayer', amount: 5_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', efficientUnitsPerHour: 80_000, imageKind: 'item', imageKey: 'Slayer cape', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 25,000,000 total team XP', 350, 'Skilling', 'xp_gain', { metric: 'overall', amount: 25_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', efficientUnitsPerHour: 1_000_000, imageKind: 'item', imageKey: 'Max cape', sources: ['wise_old_man', 'runelite'] }),
  preset('Reach level 99 Agility', 180, 'Progress', 'level_reached', { metric: 'agility', amount: 99, unit: 'level', difficulty: 'hard', imageKind: 'item', imageKey: 'Agility cape', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 25 Giant Mole kill count', 70, 'Bossing', 'boss_kc', { metric: 'giant_mole', amount: 25, unit: 'KC', difficulty: 'easy', efficientKillsPerHour: 85, imageKind: 'boss', imageKey: 'Giant Mole', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 50 Zulrah kill count', 90, 'Bossing', 'boss_kc', { metric: 'zulrah', amount: 50, unit: 'KC', difficulty: 'medium', efficientKillsPerHour: 25, imageKind: 'boss', imageKey: 'Zulrah (serpentine)', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 50 Vorkath kill count', 90, 'Bossing', 'boss_kc', { metric: 'vorkath', amount: 50, unit: 'KC', difficulty: 'medium', efficientKillsPerHour: 30, imageKind: 'boss', imageKey: 'Vorkath', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 25 Nex kill count', 180, 'Bossing', 'boss_kc', { metric: 'nex', amount: 25, unit: 'KC', difficulty: 'hard', efficientKillsPerHour: 10, imageKind: 'boss', imageKey: 'Nex', sources: ['wise_old_man', 'runelite'] }),
  preset('Complete ten Theatre of Blood raids', 220, 'Raids', 'raid_complete', { target: 'Theatre of Blood', amount: 10, unit: 'completions', scope: 'team_total', difficulty: 'hard', efficientKillsPerHour: 2.5, imageKind: 'boss', imageKey: 'Verzik Vitur' }),
  preset('Complete ten Chambers challenge modes', 220, 'Raids', 'raid_complete', { target: 'Chambers of Xeric: Challenge Mode', amount: 10, unit: 'completions', scope: 'team_total', difficulty: 'hard', efficientKillsPerHour: 2.4, imageKind: 'boss', imageKey: 'Great Olm' }),
  preset('Complete twenty expert Tombs of Amascut raids', 260, 'Raids', 'raid_complete', { target: 'Tombs of Amascut: Expert Mode', amount: 20, unit: 'completions', scope: 'team_total', difficulty: 'hard', efficientKillsPerHour: 3, imageKind: 'boss', imageKey: "Tumeken's Warden" }),
  preset('Set a sub-17:00 solo Chambers personal best', 140, 'Speed', 'raid_time', { target: 'Chambers of Xeric', metric: 'solo', amount: 1_020, unit: 'seconds', difficulty: 'hard', imageKind: 'boss', imageKey: 'Great Olm', notes: 'Complete solo Chambers of Xeric in less than 17:00. The displayed time is the required speed target.' }),
  preset('Earn an infernal cape', 500, 'Combat', 'item_acquired', { target: 'Infernal cape', difficulty: 'legendary', imageKind: 'item', imageKey: 'Infernal cape' }),
  preset("Earn Dizana's quiver", 450, 'Combat', 'item_acquired', { target: "Dizana's quiver", difficulty: 'legendary', imageKind: 'item', imageKey: "Dizana's quiver" }),
  preset('Earn a fire cape', 100, 'Combat', 'item_acquired', { target: 'Fire cape', difficulty: 'medium', imageKind: 'item', imageKey: 'Fire cape' }),
  preset('Complete one Barrows armour set', 180, 'Gear', 'team_challenge', { target: 'Complete Barrows armour set', difficulty: 'hard', fixedHours: 35, imageKind: 'item', imageKey: 'Chest (Barrows)', notes: 'Editable starter estimate for completing any one named Barrows set from event drops.', exclusions: 'Mixing pieces from different brothers does not count.' }),
  preset('Complete an Armadyl godsword', 220, 'Gear', 'team_challenge', { target: 'Armadyl godsword', difficulty: 'hard', imageKind: 'item', imageKey: 'Armadyl godsword' }),
  preset('Complete a crystal armour set', 260, 'Gear', 'team_challenge', { target: 'Crystal armour set', difficulty: 'hard', imageKind: 'item', imageKey: 'Crystal body' }),
  preset('Receive an abyssal whip', 65, 'Slayer', 'item_acquired', { target: 'Abyssal whip', difficulty: 'easy', imageKind: 'item', imageKey: 'Abyssal whip', dropRateNumerator: 1, dropRateDenominator: 512, efficientKillsPerHour: 180 }),
  preset('Receive a primordial crystal', 150, 'Slayer', 'item_acquired', { target: 'Primordial crystal', difficulty: 'hard', imageKind: 'item', imageKey: 'Primordial crystal', dropRateNumerator: 1, dropRateDenominator: 512, efficientKillsPerHour: 35 }),
  preset('Receive a zenyte shard', 120, 'Gear', 'item_acquired', { target: 'Zenyte shard', difficulty: 'medium', imageKind: 'item', imageKey: 'Zenyte shard', dropRateNumerator: 1, dropRateDenominator: 300, efficientKillsPerHour: 60 }),
  preset('Receive a dragon warhammer', 250, 'Gear', 'item_acquired', { target: 'Dragon warhammer', difficulty: 'hard', imageKind: 'item', imageKey: 'Dragon warhammer', dropRateNumerator: 1, dropRateDenominator: 3_000, efficientKillsPerHour: 140 }),
  preset('Receive a skeletal visage from Vorkath', 220, 'Gear', 'item_acquired', { target: 'Skeletal visage', difficulty: 'hard', imageKind: 'item', imageKey: 'Skeletal visage', dropRateNumerator: 1, dropRateDenominator: 5_000, efficientKillsPerHour: 30 }),
  preset('Receive a 3rd age platebody from a clue', 700, 'Clues', 'item_acquired', { target: '3rd age platebody', difficulty: 'legendary', imageKind: 'item', imageKey: '3rd Age platebody' }),
  preset('Complete Chambers with exactly four teammates', 120, 'Teamwork', 'raid_complete', { target: 'Chambers of Xeric', amount: 1, unit: 'completion', scope: 'exact_party', participantCount: 5, difficulty: 'medium', imageKind: 'boss', imageKey: 'Great Olm' }),
  preset('Receive a Tome of water from Tempoross', 90, 'Skilling', 'item_acquired', { target: 'Tome of water', difficulty: 'medium', imageKind: 'item', imageKey: 'Tome of Water (empty)', dropRateNumerator: 1, dropRateDenominator: 1_600, efficientKillsPerHour: 60, notes: 'The attempt rate is reward permits opened per individual hour, not Tempoross kills.', sourceUrl: 'https://oldschool.runescape.wiki/w/Tempoross#Rewards' }),
  preset('Receive a Fish barrel from Tempoross', 75, 'Skilling', 'item_acquired', { target: 'Fish barrel', difficulty: 'medium', imageKind: 'item', imageKey: 'Fish barrel', dropRateNumerator: 1, dropRateDenominator: 400, efficientKillsPerHour: 60, notes: 'The attempt rate is reward permits opened per individual hour, not Tempoross kills.', sourceUrl: 'https://oldschool.runescape.wiki/w/Tempoross#Rewards' }),
  preset('Receive a tome of fire from Wintertodt', 100, 'Skilling', 'item_acquired', { target: 'Tome of fire', difficulty: 'medium', imageKind: 'item', imageKey: 'Tome of Fire (empty)', dropRateNumerator: 1, dropRateDenominator: 1_000, efficientKillsPerHour: 25, notes: 'The attempt rate is reward-cart rolls per individual hour. Edit it for your points and mass/solo method.', sourceUrl: 'https://oldschool.runescape.wiki/w/Wintertodt_drop_rates' }),
  preset('Complete 100 Hallowed Sepulchre laps', 180, 'Skilling', 'team_challenge', { target: 'Hallowed Sepulchre', amount: 100, unit: 'laps', scope: 'team_total', difficulty: 'hard', efficientUnitsPerHour: 8, imageKind: 'item', imageKey: 'Hallowed ring' }),
  preset('Receive an Ultor vestige from Vardorvis', 160, 'Fortune', 'item_acquired', { target: 'Ultor vestige', difficulty: 'hard', imageKind: 'item', imageKey: 'Ultor vestige' }),
  preset('Defeat Giant Mole, Vorkath, and Zulrah in one hour', 100, 'Bossing', 'team_challenge', { target: 'Giant Mole, Vorkath, and Zulrah', amount: 60, unit: 'minutes', difficulty: 'medium', fixedHours: 1, imageKind: 'boss', imageKey: 'Vorkath' }),
  preset('Gain 10,000,000 team Hunter XP', 450, 'Skilling', 'xp_gain', { metric: 'hunter', amount: 10_000_000, unit: 'XP', scope: 'team_total', difficulty: 'hard', efficientUnitsPerHour: 200_000, imageKind: 'item', imageKey: 'Hunter cape', sources: ['wise_old_man', 'runelite'] }),
  preset('Gain 2,000,000 team Mining XP', 180, 'Skilling', 'xp_gain', { metric: 'mining', amount: 2_000_000, unit: 'XP', scope: 'team_total', difficulty: 'medium', efficientUnitsPerHour: 120_000, imageKind: 'item', imageKey: 'Mining cape', sources: ['wise_old_man', 'runelite'] }),
  preset('Receive an imp champion scroll', 240, 'Collection', 'item_acquired', { target: 'Imp champion scroll', difficulty: 'hard', imageKind: 'item', imageKey: 'Imp champion scroll', dropRateNumerator: 1, dropRateDenominator: 5_000, efficientKillsPerHour: 650 }),
  preset('Receive the jar of dirt from Kraken', 300, 'Collection', 'item_acquired', { target: 'Jar of dirt', difficulty: 'hard', imageKind: 'item', imageKey: 'Jar of Dirt', dropRateNumerator: 1, dropRateDenominator: 1_000, efficientKillsPerHour: 80 }),
  preset('Receive an elite clue from any Dagannoth King', 95, 'Clues', 'item_acquired', { target: 'Clue scroll (elite)', difficulty: 'medium', imageKind: 'item', imageKey: 'Clue scroll (elite)', dropRateNumerator: 1, dropRateDenominator: 750, efficientKillsPerHour: 100, notes: 'Any elite clue dropped by Dagannoth Rex, Prime, or Supreme counts. The planning rate combines efficient tribrid kills across all three kings.', exclusions: 'Elite clues from other sources and clues owned before the event do not count.', sourceUrl: 'https://oldschool.runescape.wiki/w/Dagannoth_Kings' }),
  ...OSRS_BOSS_UNIQUE_DROPS.map(({ boss, item, sourceUrl }) => preset(
    `Receive ${item} from ${boss}`,
    100,
    'Boss uniques',
    'item_acquired',
    {
      target: item,
      imageKind: 'item',
      imageKey: item,
      notes: `Receive this boss-specific reward from ${boss} during the event. Add the current individual drop rate and efficient attempts per hour when balancing the board.`,
      exclusions: 'Items owned before the event, bought, traded, or received from another source do not count.',
      sourceUrl,
    },
  )),
];

/**
 * Presets that may be placed automatically on a new board. Collection-log
 * milestones stay in the full library for deliberate use, but account progress
 * makes them too uneven for starter boards and one-click autofill.
 */
export const OSRS_DEFAULT_BOARD_PRESETS = OSRS_BINGO_PRESETS.filter(
  (task) => task.rule.verifier.type !== 'collection_log',
);

const STARTER_TASK_TITLES = [
  'Receive a Berserker ring from Dagannoth Rex',
  'Complete a master clue',
  'Receive a dexterous prayer scroll',
  'Gain 1,000,000 Runecraft XP',
  'Gain 25 Giant Mole kill count',
  'Receive an avernic defender hilt',
  'Receive a zenyte shard',
  'Gain 50 Zulrah kill count',
  'Receive an abyssal whip',
  'Receive a Tome of water from Tempoross',
  'Receive a dragon warhammer',
  'Set a sub-17:00 solo Chambers personal best',
  'Gain 25 Nex kill count',
  'Complete one Barrows armour set',
  'Receive a Fish barrel from Tempoross',
  'Receive a tome of fire from Wintertodt',
  'Gain 5,000,000 team Slayer XP',
  'Defeat Giant Mole, Vorkath, and Zulrah in one hour',
  'Gain 10,000,000 team Hunter XP',
  'Gain 2,000,000 team Mining XP',
  'Receive an elite clue from any Dagannoth King',
  'Receive a primordial crystal',
  'Receive a skeletal visage from Vorkath',
  'Complete ten Theatre of Blood raids',
  'Complete ten Chambers challenge modes',
] as const;

function tasksFor(mode: BingoMode): BingoTaskDefinition[] {
  const selected = STARTER_TASK_TITLES.map((title) => {
    const task = OSRS_DEFAULT_BOARD_PRESETS.find((presetTask) => presetTask.title === title);
    if (!task) throw new Error(`Missing starter bingo preset: ${title}`);
    return structuredClone(task);
  });
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

function centerOutTemplate(): BingoTemplateDefinition {
  const rules = defaultBingoEventRules(7, 'points');
  rules.visibility.hideLockedTasks = true;
  rules.progression = { unlockPattern: 'orthogonal', startPosition: 24, tileOwnership: 'each_team' };
  const estimated = OSRS_DEFAULT_BOARD_PRESETS.filter((task) => expectedIndividualHours(task.rule) !== null);
  const tasks = Array.from({ length: 49 }, (_, index) => {
    const task = structuredClone(estimated[index % estimated.length]);
    task.points = 1;
    task.hidden = false;
    return task;
  });
  return {
    schemaVersion: 1,
    key: 'center-out',
    name: 'Center-out expedition',
    description: 'Begin at the center and unlock tiles directly above, below, left, or right as the frontier expands.',
    mode: 'progression',
    boardScope: 'per_team',
    winCondition: 'points',
    targetValue: 0,
    gridSize: 7,
    rules,
    tasks,
  };
}

export const BUILTIN_BINGO_TEMPLATES: BingoTemplateDefinition[] = [
  template('classic', 'Classic 5 × 5', 'Complete a row, column, or diagonal first.', 'classic', 'lines'),
  template('points', 'Weekend points hunt', 'Every verified tile scores its listed value.', 'points', 'points'),
  template('lockout', 'Shared lockout', 'The first approved team owns each tile permanently.', 'lockout', 'points'),
  template('blackout', 'Blackout race', 'Complete the whole board before the other teams.', 'blackout', 'blackout'),
  template('progression', 'Tiered expedition', 'Each row unlocks after the matching task above it is complete.', 'progression', 'points'),
  template('categories', 'Category conquest', 'Complete enough tasks across the broadest set of categories.', 'categories', 'categories'),
  centerOutTemplate(),
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
        presentation: { imageKind: fields[16]?.trim(), imageKey: fields[17]?.trim() },
        details: {
          notes: fields[18]?.trim(), exclusions: fields[19]?.trim(), sourceUrl: fields[20]?.trim(),
        },
        planning: {
          dropRateNumerator: fields[21]?.trim(), dropRateDenominator: fields[22]?.trim(),
          efficientKillsPerHour: fields[23]?.trim(), efficientUnitsPerHour: fields[24]?.trim(),
          fixedHours: fields[25]?.trim(), quantity: fields[26]?.trim(),
        },
        prerequisitePositions: prerequisites,
      },
      difficulty: fields[27]?.trim(),
      repeatable: /^(?:true|yes|1)$/i.test(fields[28]?.trim() ?? ''),
      maxCompletions: fields[29]?.trim(),
      hidden: /^(?:true|yes|1)$/i.test(fields[30]?.trim() ?? ''),
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
    task.rule.presentation.imageKind, task.rule.presentation.imageKey,
    task.rule.details.notes, task.rule.details.exclusions, task.rule.details.sourceUrl,
    task.rule.planning.dropRateNumerator ?? '', task.rule.planning.dropRateDenominator ?? '',
    task.rule.planning.efficientKillsPerHour ?? '', task.rule.planning.efficientUnitsPerHour ?? '',
    task.rule.planning.fixedHours ?? '', task.rule.planning.quantity,
    task.difficulty, task.repeatable, task.maxCompletions, task.hidden,
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
