import { BUILTIN_BINGO_TEMPLATES, type BingoTemplateDefinition } from './bingo-types';
import type { BingoMode } from './types';

export const TEMPLATE_CATEGORIES = [
  'Mixed', 'Bossing', 'Raids', 'Skilling', 'Speed', 'Progression', 'Casual', 'Competitive',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];
export type TemplateVisibility = 'private' | 'public';
export type TemplateGallerySort = 'popular' | 'rating' | 'newest' | 'name';

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
  cloneCount: number;
  ratingCount: number;
  ratingAverage: number | null;
  creatorName: string;
  creatorClanSlug: string | null;
  publishedAt: string | null;
  official: boolean;
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
  return value === 'public' ? 'public' : 'private';
}

export function sanitizeGallerySort(value: unknown): TemplateGallerySort {
  return ['popular', 'rating', 'newest', 'name'].includes(String(value))
    ? String(value) as TemplateGallerySort
    : 'popular';
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
    cloneCount: 0,
    ratingCount: 0,
    ratingAverage: null,
    creatorName: "Terry's Drafting",
    creatorClanSlug: null,
    publishedAt: null,
    official: true,
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
