import {
  BINGO_TASK_DIFFICULTIES, BUILTIN_BINGO_TEMPLATES, type BingoTaskDefinition,
  type BingoTaskDifficulty, type BingoTemplateDefinition,
} from './bingo-types';
import type { BingoMode } from './types';

export const TEMPLATE_CATEGORIES = [
  'Mixed', 'Bossing', 'Raids', 'Skilling', 'Speed', 'Progression', 'Casual', 'Competitive',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];
export type TemplateVisibility = 'private' | 'clan' | 'unlisted' | 'public';
export type TemplateGallerySort = 'popular' | 'votes' | 'newest' | 'name' | 'difficulty' | 'type';

export type GalleryTemplate = {
  id: string | null;
  slug: string;
  name: string;
  summary: string;
  category: string;
  tags: string[];
  mode: BingoMode;
  boardScope: string;
  gridSize: number;
  taskCount: number;
  difficulty: BingoTaskDifficulty;
  cloneCount: number;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  creatorName: string;
  creatorClanSlug: string | null;
  publishedAt: string | null;
  official: boolean;
  visibility: TemplateVisibility;
  configuration: BingoTemplateDefinition;
};

export function sanitizeTemplateSummary(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
  return text || fallback.trim().replace(/\s+/g, ' ').slice(0, 240);
}

export function sanitizeTemplateCategory(value: unknown): TemplateCategory {
  return TEMPLATE_CATEGORIES.includes(String(value) as TemplateCategory)
    ? String(value) as TemplateCategory
    : 'Mixed';
}

export function sanitizeTemplateTags(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const tags = source.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const tag = item.trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9 '+&-]/g, '').slice(0, 24);
    return tag ? [tag] : [];
  });
  const unique = new Map<string, string>();
  for (const tag of tags) {
    const key = tag.toLocaleLowerCase('en-US');
    if (!unique.has(key)) unique.set(key, tag);
  }
  return [...unique.values()].slice(0, 6);
}

export function sanitizeTemplateVisibility(value: unknown): TemplateVisibility {
  return ['private', 'clan', 'unlisted', 'public'].includes(String(value))
    ? String(value) as TemplateVisibility
    : 'private';
}

export function sanitizeGallerySort(value: unknown): TemplateGallerySort {
  return ['popular', 'votes', 'newest', 'name', 'difficulty', 'type'].includes(String(value))
    ? String(value) as TemplateGallerySort
    : 'popular';
}

export function sanitizeGalleryDifficulty(value: unknown): 'all' | BingoTaskDifficulty {
  return BINGO_TASK_DIFFICULTIES.includes(String(value) as BingoTaskDifficulty)
    ? String(value) as BingoTaskDifficulty
    : 'all';
}

export function overallBoardDifficulty(tasks: BingoTaskDefinition[]): BingoTaskDifficulty {
  const scored = tasks.filter((task) => !task.freeSpace);
  if (!scored.length) return 'easy';
  if (scored.some((task) => task.difficulty === 'experimental')) return 'experimental';
  const values: Record<BingoTaskDifficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4, experimental: 0 };
  const average = scored.reduce((total, task) => total + values[task.difficulty], 0) / scored.length;
  if (average < 1.5) return 'easy';
  if (average < 2.5) return 'medium';
  if (average < 3.5) return 'hard';
  return 'expert';
}

export function builtinGalleryTemplates(): GalleryTemplate[] {
  return BUILTIN_BINGO_TEMPLATES.map((configuration) => ({
    id: null,
    slug: `starter-${configuration.key}`,
    name: configuration.name,
    summary: configuration.description,
    category: builtinCategory(configuration.mode),
    tags: ['Official starter', modeLabel(configuration.mode), `${configuration.gridSize}x${configuration.gridSize}`],
    mode: configuration.mode,
    boardScope: configuration.boardScope,
    gridSize: configuration.gridSize,
    taskCount: configuration.tasks.length,
    difficulty: overallBoardDifficulty(configuration.tasks),
    cloneCount: 0,
    upvoteCount: 0,
    downvoteCount: 0,
    voteScore: 0,
    creatorName: "Terry's Drafting",
    creatorClanSlug: null,
    publishedAt: null,
    official: true,
    visibility: 'public',
    configuration,
  }));
}

function builtinCategory(mode: BingoMode): TemplateCategory {
  if (mode === 'progression') return 'Progression';
  if (['classic', 'lockout', 'blackout', 'categories'].includes(mode)) return 'Competitive';
  return 'Mixed';
}

function modeLabel(mode: BingoMode) {
  return ({
    classic: 'Classic lines', points: 'Points', lockout: 'Lockout', blackout: 'Blackout',
    progression: 'Progression', categories: 'Categories',
  } as Record<BingoMode, string>)[mode];
}
