import type { BingoVerificationMode } from './types';

export const BINGO_RULE_SCHEMA_VERSION = 2 as const;

export const BINGO_VERIFIERS = [
  'manual', 'item_acquired', 'pet_obtained', 'collection_log', 'xp_gain', 'level_reached',
  'boss_kc', 'raid_complete', 'raid_time', 'combat_achievement', 'clue_complete', 'team_challenge',
] as const;
export type BingoVerifierType = typeof BINGO_VERIFIERS[number];

export const BINGO_PROOF_SOURCES = ['organizer', 'screenshot', 'runelite', 'wise_old_man'] as const;
export type BingoProofSource = typeof BINGO_PROOF_SOURCES[number];

export const BINGO_TASK_SCOPES = ['any_member', 'single_member', 'team_total', 'exact_party', 'all_members'] as const;
export type BingoTaskScope = typeof BINGO_TASK_SCOPES[number];

export const BINGO_TASK_IMAGE_KINDS = ['none', 'item', 'boss'] as const;
export type BingoTaskImageKind = typeof BINGO_TASK_IMAGE_KINDS[number];

export type BingoTaskRule = {
  schemaVersion: typeof BINGO_RULE_SCHEMA_VERSION;
  verifier: {
    type: BingoVerifierType;
    target: string;
    targetId: number | null;
    metric: string;
    amount: number | null;
    comparator: 'at_least' | 'at_most' | 'equals';
    unit: string;
  };
  scope: {
    type: BingoTaskScope;
    participantCount: number | null;
  };
  proof: {
    sources: BingoProofSource[];
    approval: 'review' | 'automatic' | 'hybrid';
  };
  presentation: {
    imageKind: BingoTaskImageKind;
    imageKey: string;
  };
  details: {
    notes: string;
    exclusions: string;
    sourceUrl: string;
  };
  planning: {
    dropRateNumerator: number | null;
    dropRateDenominator: number | null;
    efficientKillsPerHour: number | null;
    efficientUnitsPerHour: number | null;
    fixedHours: number | null;
    quantity: number;
  };
  prerequisitePositions: number[];
};

export type BingoEventRules = {
  schemaVersion: typeof BINGO_RULE_SCHEMA_VERSION;
  layout: {
    kind: 'grid';
    rows: number;
    columns: number;
  };
  scoring: {
    winCondition: 'lines' | 'points' | 'blackout' | 'categories';
    targetValue: number;
    categoryTarget: number;
    linePatterns: Array<'rows' | 'columns' | 'diagonals'>;
  };
  visibility: {
    hideLockedTasks: boolean;
  };
};

export type BingoBoardValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function defaultBingoTaskRule(verificationMode: BingoVerificationMode = 'manual'): BingoTaskRule {
  const sources: BingoProofSource[] = verificationMode === 'screenshot'
    ? ['screenshot']
    : verificationMode === 'stat_delta'
      ? ['wise_old_man']
      : verificationMode === 'hybrid'
        ? ['runelite', 'screenshot']
        : ['organizer'];
  return {
    schemaVersion: BINGO_RULE_SCHEMA_VERSION,
    verifier: {
      type: verificationMode === 'stat_delta' ? 'xp_gain' : 'manual',
      target: '', targetId: null, metric: '', amount: null, comparator: 'at_least', unit: '',
    },
    scope: { type: 'any_member', participantCount: null },
    proof: { sources, approval: sources.length > 1 ? 'hybrid' : 'review' },
    presentation: { imageKind: 'none', imageKey: '' },
    details: { notes: '', exclusions: '', sourceUrl: '' },
    planning: {
      dropRateNumerator: null, dropRateDenominator: null, efficientKillsPerHour: null,
      efficientUnitsPerHour: null, fixedHours: null, quantity: 1,
    },
    prerequisitePositions: [],
  };
}

export function defaultBingoEventRules(gridSize = 5, winCondition: BingoEventRules['scoring']['winCondition'] = 'points'): BingoEventRules {
  const size = clampInteger(gridSize, 3, 7, 5);
  return {
    schemaVersion: BINGO_RULE_SCHEMA_VERSION,
    layout: { kind: 'grid', rows: size, columns: size },
    scoring: {
      winCondition,
      targetValue: winCondition === 'lines' ? 1 : 0,
      categoryTarget: 1,
      linePatterns: ['rows', 'columns', 'diagonals'],
    },
    visibility: { hideLockedTasks: true },
  };
}

export function sanitizeBingoTaskRule(value: unknown, fallbackMode: BingoVerificationMode = 'manual'): BingoTaskRule {
  const fallback = defaultBingoTaskRule(fallbackMode);
  if (!value || typeof value !== 'object') return fallback;
  const input = value as Record<string, unknown>;
  const verifier = objectValue(input.verifier);
  const scope = objectValue(input.scope);
  const proof = objectValue(input.proof);
  const presentation = objectValue(input.presentation);
  const details = objectValue(input.details);
  const planning = objectValue(input.planning);
  const verifierType = BINGO_VERIFIERS.includes(String(verifier.type) as BingoVerifierType)
    ? String(verifier.type) as BingoVerifierType
    : fallback.verifier.type;
  const scopeType = BINGO_TASK_SCOPES.includes(String(scope.type) as BingoTaskScope)
    ? String(scope.type) as BingoTaskScope
    : fallback.scope.type;
  const proofSources = Array.isArray(proof.sources)
    ? [...new Set(proof.sources.filter((source): source is BingoProofSource => BINGO_PROOF_SOURCES.includes(String(source) as BingoProofSource)))].slice(0, 4)
    : fallback.proof.sources;
  const approval = ['review', 'automatic', 'hybrid'].includes(String(proof.approval))
    ? String(proof.approval) as BingoTaskRule['proof']['approval']
    : fallback.proof.approval;
  const comparator = ['at_least', 'at_most', 'equals'].includes(String(verifier.comparator))
    ? String(verifier.comparator) as BingoTaskRule['verifier']['comparator']
    : fallback.verifier.comparator;
  const participantCount = scopeType === 'exact_party'
    ? clampIntegerOrNull(scope.participantCount, 2, 100)
    : null;
  const imageKind = BINGO_TASK_IMAGE_KINDS.includes(String(presentation.imageKind) as BingoTaskImageKind)
    ? String(presentation.imageKind) as BingoTaskImageKind
    : fallback.presentation.imageKind;
  const prerequisitePositions = Array.isArray(input.prerequisitePositions)
    ? [...new Set(input.prerequisitePositions.map((position) => Number(position)).filter(Number.isInteger))]
      .filter((position) => position >= 0 && position < 49).slice(0, 12).sort((left, right) => left - right)
    : [];
  return {
    schemaVersion: BINGO_RULE_SCHEMA_VERSION,
    verifier: {
      type: verifierType,
      target: textValue(verifier.target, 100),
      targetId: clampIntegerOrNull(verifier.targetId, 0, 10_000_000),
      metric: textValue(verifier.metric, 60),
      amount: positiveNumberOrNull(verifier.amount),
      comparator,
      unit: textValue(verifier.unit, 24),
    },
    scope: { type: scopeType, participantCount },
    proof: { sources: proofSources.length ? proofSources : ['organizer'], approval },
    presentation: {
      imageKind,
      imageKey: imageKind === 'none' ? '' : textValue(presentation.imageKey, 120),
    },
    details: {
      notes: textValue(details.notes, 1_000),
      exclusions: textValue(details.exclusions, 1_000),
      sourceUrl: safeHttpUrl(details.sourceUrl),
    },
    planning: {
      dropRateNumerator: positiveNumberOrNull(planning.dropRateNumerator),
      dropRateDenominator: positiveNumberOrNull(planning.dropRateDenominator),
      efficientKillsPerHour: positiveNumberOrNull(planning.efficientKillsPerHour),
      efficientUnitsPerHour: positiveNumberOrNull(planning.efficientUnitsPerHour),
      fixedHours: positiveNumberOrNull(planning.fixedHours),
      quantity: clampInteger(planning.quantity, 1, 100, fallback.planning.quantity),
    },
    prerequisitePositions,
  };
}

export function sanitizeBingoEventRules(value: unknown, gridSize = 5, winCondition: BingoEventRules['scoring']['winCondition'] = 'points'): BingoEventRules {
  const fallback = defaultBingoEventRules(gridSize, winCondition);
  if (!value || typeof value !== 'object') return fallback;
  const input = value as Record<string, unknown>;
  const layout = objectValue(input.layout);
  const scoring = objectValue(input.scoring);
  const visibility = objectValue(input.visibility);
  const rows = clampInteger(layout.rows, 3, 7, fallback.layout.rows);
  const columns = clampInteger(layout.columns, 3, 7, rows);
  const validWinCondition = ['lines', 'points', 'blackout', 'categories'].includes(String(scoring.winCondition))
    ? String(scoring.winCondition) as BingoEventRules['scoring']['winCondition']
    : fallback.scoring.winCondition;
  const linePatterns = Array.isArray(scoring.linePatterns)
    ? [...new Set(scoring.linePatterns.filter((pattern): pattern is BingoEventRules['scoring']['linePatterns'][number] =>
      ['rows', 'columns', 'diagonals'].includes(String(pattern))))]
    : fallback.scoring.linePatterns;
  return {
    schemaVersion: BINGO_RULE_SCHEMA_VERSION,
    layout: { kind: 'grid', rows, columns },
    scoring: {
      winCondition: validWinCondition,
      targetValue: clampInteger(scoring.targetValue, 0, 1_000_000, fallback.scoring.targetValue),
      categoryTarget: clampInteger(scoring.categoryTarget, 1, 100, fallback.scoring.categoryTarget),
      linePatterns: linePatterns.length ? linePatterns : fallback.scoring.linePatterns,
    },
    visibility: { hideLockedTasks: visibility.hideLockedTasks !== false },
  };
}

export function verificationModeFromRule(rule: BingoTaskRule): BingoVerificationMode {
  const sources = new Set(rule.proof.sources);
  if (sources.size > 1 || sources.has('runelite')) return 'hybrid';
  if (sources.has('wise_old_man')) return 'stat_delta';
  if (sources.has('screenshot')) return 'screenshot';
  return 'manual';
}

export function validateBingoBoard(tasks: Array<{ title: string; freeSpace: boolean; rule: BingoTaskRule }>, rules: BingoEventRules): BingoBoardValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const expected = rules.layout.rows * rules.layout.columns;
  if (tasks.length !== expected) errors.push(`Board needs exactly ${expected} tasks for a ${rules.layout.rows} × ${rules.layout.columns} layout.`);
  tasks.forEach((task, index) => {
    if (!task.title.trim()) errors.push(`Tile ${index + 1} needs a title.`);
    if (task.rule.scope.type === 'exact_party' && !task.rule.scope.participantCount) errors.push(`Tile ${index + 1} needs a party size.`);
    if (['xp_gain', 'boss_kc', 'raid_time'].includes(task.rule.verifier.type) && !task.rule.verifier.amount) {
      warnings.push(`Tile ${index + 1} should include a numeric target for automatic verification.`);
    }
    if (task.rule.prerequisitePositions.includes(index)) errors.push(`Tile ${index + 1} cannot depend on itself.`);
    for (const prerequisite of task.rule.prerequisitePositions) {
      if (prerequisite >= expected) errors.push(`Tile ${index + 1} references missing tile ${prerequisite + 1}.`);
    }
  });
  if (tasks.filter((task) => task.freeSpace).length > 1) warnings.push('Multiple free spaces can make line-based boards finish very quickly.');
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

export function bingoRuleSummary(rule: BingoTaskRule) {
  const target = [rule.verifier.target, rule.verifier.amount ? formatAmount(rule.verifier.amount) : '', rule.verifier.unit]
    .filter(Boolean).join(' · ');
  const scope = rule.scope.type === 'exact_party'
    ? `${rule.scope.participantCount ?? '?'} players`
    : rule.scope.type.replaceAll('_', ' ');
  return `${rule.verifier.type.replaceAll('_', ' ')}${target ? ` · ${target}` : ''} · ${scope}`;
}

export function expectedIndividualHours(rule: BingoTaskRule) {
  if (rule.planning.fixedHours) return rule.planning.fixedHours;
  const quantity = Math.max(1, rule.planning.quantity);
  if (rule.planning.dropRateNumerator && rule.planning.dropRateDenominator && rule.planning.efficientKillsPerHour) {
    return (rule.planning.dropRateDenominator / rule.planning.dropRateNumerator) * quantity
      / rule.planning.efficientKillsPerHour;
  }
  if (rule.planning.efficientUnitsPerHour && rule.verifier.amount) {
    return rule.verifier.amount / rule.planning.efficientUnitsPerHour;
  }
  if (rule.planning.efficientKillsPerHour && rule.verifier.amount
    && ['boss_kc', 'raid_complete', 'clue_complete'].includes(rule.verifier.type)) {
    return rule.verifier.amount / rule.planning.efficientKillsPerHour;
  }
  return null;
}

export function expectedTeamHours(rule: BingoTaskRule, teamSize: number) {
  const individual = expectedIndividualHours(rule);
  if (individual === null) return null;
  const contributors = ['any_member', 'team_total'].includes(rule.scope.type) ? Math.max(1, teamSize) : 1;
  return individual / contributors;
}

export function expectedPersonHours(rule: BingoTaskRule, teamSize: number) {
  const individual = expectedIndividualHours(rule);
  if (individual === null) return null;
  if (rule.scope.type === 'all_members') return individual * Math.max(1, teamSize);
  if (rule.scope.type === 'exact_party') return individual * Math.max(1, rule.scope.participantCount ?? 1);
  return individual;
}

export function formatExpectedHours(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Not estimated';
  if (value < 0.1) return '<0.1 hr';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)} hr${Math.abs(value - 1) < 0.001 ? '' : 's'}`;
}

export function bingoTaskImageUrl(rule: BingoTaskRule) {
  if (rule.presentation.imageKind === 'none' || !rule.presentation.imageKey) return null;
  const filename = `${rule.presentation.imageKey.trim().replace(/\s+/g, '_').replace(/\.png$/i, '')}.png`;
  return `https://oldschool.runescape.wiki/w/Special:Redirect/file/${encodeURIComponent(filename)}`;
}

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function textValue(value: unknown, maxLength: number) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''; }
function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}
function clampIntegerOrNull(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) && value !== null && value !== '' ? Math.max(minimum, Math.min(maximum, Math.round(number))) : null;
}
function positiveNumberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(number, 1_000_000_000_000) : null;
}
function safeHttpUrl(value: unknown) {
  const text = typeof value === 'string' ? value.trim().slice(0, 500) : '';
  if (!text) return '';
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}
function formatAmount(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value); }
