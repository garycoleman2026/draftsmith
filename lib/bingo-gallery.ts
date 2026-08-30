import { getDatabase } from './db';
import { sanitizeBingoTemplate } from './bingo-types';
import {
  builtinGalleryTemplates, overallBoardDifficulty, sanitizeGalleryDifficulty, sanitizeGallerySort, sanitizeTemplateCategory, sanitizeTemplateSummary,
  sanitizeTemplateTags, type GalleryTemplate, type TemplateGallerySort,
} from './bingo-gallery-core';

export * from './bingo-gallery-core';

type GalleryRow = {
  id: string;
  public_slug: string;
  name: string;
  summary: string;
  category: string;
  tags_json: string;
  mode: string;
  board_scope: string;
  configuration_json: string;
  clone_count: number;
  upvote_count: number;
  downvote_count: number;
  published_at: string | null;
  updated_at: string;
  clan_name: string | null;
  clan_slug: string | null;
  author_name: string | null;
  visibility: string;
};


export async function listGalleryTemplates(input: {
  query?: string;
  category?: string;
  mode?: string;
  difficulty?: string;
  sort?: string;
} = {}) {
  const rows = await loadCommunityRows();
  const community = rows.flatMap((row) => {
    const item = rowToGalleryTemplate(row);
    return item ? [item] : [];
  });
  const query = (input.query ?? '').trim().toLocaleLowerCase('en-US').slice(0, 80);
  const category = (input.category ?? '').trim();
  const mode = (input.mode ?? '').trim();
  const difficulty = sanitizeGalleryDifficulty(input.difficulty);
  const sort = sanitizeGallerySort(input.sort);
  const filtered = [...builtinGalleryTemplates(), ...community].filter((template) => {
    if (category && category !== 'All' && template.category !== category) return false;
    if (mode && mode !== 'all' && template.mode !== mode) return false;
    if (difficulty !== 'all' && template.difficulty !== difficulty) return false;
    if (!query) return true;
    const haystack = [template.name, template.summary, template.category, ...template.tags]
      .join(' ').toLocaleLowerCase('en-US');
    return haystack.includes(query);
  });
  return filtered.sort((left, right) => compareTemplates(left, right, sort));
}

async function loadCommunityRows() {
  try {
    const result = await getDatabase().prepare(
      `SELECT bt.id, bt.public_slug, bt.name, bt.summary, bt.category, bt.tags_json, bt.mode,
              bt.board_scope, bt.configuration_json, bt.clone_count,
              COALESCE(tv.upvote_count, 0) AS upvote_count, COALESCE(tv.downvote_count, 0) AS downvote_count,
              bt.published_at, bt.updated_at, bt.visibility,
              CASE WHEN c.public_listing = 1 THEN c.name END AS clan_name,
              CASE WHEN c.public_listing = 1 THEN c.slug END AS clan_slug,
              NULL AS author_name
       FROM bingo_templates bt
       LEFT JOIN clans c ON c.id = bt.clan_id
       LEFT JOIN (
         SELECT template_id,
                SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvote_count,
                SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvote_count
         FROM bingo_template_votes GROUP BY template_id
       ) tv ON tv.template_id = bt.id
       WHERE bt.visibility = 'public' AND bt.public_slug IS NOT NULL
       ORDER BY bt.updated_at DESC LIMIT 200`,
    ).all<GalleryRow>();
    return result.results;
  } catch {
    return [];
  }
}

export async function loadGalleryTemplate(slug: string) {
  const builtin = builtinGalleryTemplates().find((template) => template.slug === slug);
  if (builtin) return builtin;
  const row = await getDatabase().prepare(
    `SELECT bt.id, bt.public_slug, bt.name, bt.summary, bt.category, bt.tags_json, bt.mode,
            bt.board_scope, bt.configuration_json, bt.clone_count,
            COALESCE(tv.upvote_count, 0) AS upvote_count, COALESCE(tv.downvote_count, 0) AS downvote_count,
            bt.published_at, bt.updated_at, bt.visibility,
            CASE WHEN c.public_listing = 1 THEN c.name END AS clan_name,
            CASE WHEN c.public_listing = 1 THEN c.slug END AS clan_slug,
            NULL AS author_name
     FROM bingo_templates bt
     LEFT JOIN clans c ON c.id = bt.clan_id
     LEFT JOIN (
       SELECT template_id,
              SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvote_count,
              SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvote_count
       FROM bingo_template_votes GROUP BY template_id
     ) tv ON tv.template_id = bt.id
     WHERE bt.public_slug = ? AND bt.visibility IN ('public', 'unlisted')`,
  ).bind(slug).first<GalleryRow>();
  return row ? rowToGalleryTemplate(row) : null;
}

export async function uniquePublicTemplateSlug(name: string) {
  const normalized = name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = `community-${normalized || 'bingo-board'}`.slice(0, 48);
  const db = getDatabase();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = attempt ? `-${attempt + 1}` : '';
    const slug = `${base.slice(0, 56 - suffix.length)}${suffix}`;
    if (!await db.prepare('SELECT id FROM bingo_templates WHERE public_slug = ?').bind(slug).first()) return slug;
  }
  return `${base.slice(0, 42)}-${crypto.randomUUID().slice(0, 8)}`;
}

function rowToGalleryTemplate(row: GalleryRow): GalleryTemplate | null {
  try {
    const configuration = sanitizeBingoTemplate(JSON.parse(row.configuration_json));
    if (configuration.tasks.length !== configuration.gridSize * configuration.gridSize) return null;
    return {
      id: row.id,
      slug: row.public_slug,
      name: row.name,
      summary: sanitizeTemplateSummary(row.summary, configuration.description),
      category: sanitizeTemplateCategory(row.category),
      tags: sanitizeTemplateTags(parseJson(row.tags_json, [])),
      mode: configuration.mode,
      boardScope: configuration.boardScope,
      gridSize: configuration.gridSize,
      taskCount: configuration.tasks.length,
      difficulty: overallBoardDifficulty(configuration.tasks),
      cloneCount: Math.max(0, Number(row.clone_count) || 0),
      upvoteCount: Math.max(0, Number(row.upvote_count) || 0),
      downvoteCount: Math.max(0, Number(row.downvote_count) || 0),
      voteScore: (Number(row.upvote_count) || 0) - (Number(row.downvote_count) || 0),
      creatorName: row.clan_name || row.author_name || 'Community organizer',
      creatorClanSlug: row.clan_slug,
      publishedAt: row.published_at ?? row.updated_at,
      official: false,
      visibility: row.visibility === 'unlisted' ? 'unlisted' : 'public',
      configuration,
    };
  } catch {
    return null;
  }
}

function compareTemplates(left: GalleryTemplate, right: GalleryTemplate, sort: TemplateGallerySort) {
  if (sort === 'name') return left.name.localeCompare(right.name);
  if (sort === 'newest') return Date.parse(right.publishedAt ?? '1970-01-01') - Date.parse(left.publishedAt ?? '1970-01-01');
  if (sort === 'votes') return right.voteScore - left.voteScore || right.upvoteCount - left.upvoteCount || right.cloneCount - left.cloneCount || left.name.localeCompare(right.name);
  if (sort === 'difficulty') return difficultyRank(left.difficulty) - difficultyRank(right.difficulty) || left.name.localeCompare(right.name);
  if (sort === 'type') return modeLabel(left.mode).localeCompare(modeLabel(right.mode)) || left.name.localeCompare(right.name);
  return right.cloneCount - left.cloneCount
    || right.voteScore - left.voteScore
    || right.upvoteCount - left.upvoteCount
    || left.name.localeCompare(right.name);
}

function difficultyRank(value: GalleryTemplate['difficulty']) {
  return ({ easy: 1, medium: 2, hard: 3, expert: 4, experimental: 5 })[value];
}

function modeLabel(value: GalleryTemplate['mode']) {
  return ({ classic: 'Classic lines', points: 'Points', lockout: 'Lockout', blackout: 'Blackout', progression: 'Progression', categories: 'Categories' })[value];
}

function parseJson(value: string, fallback: unknown) {
  try { return JSON.parse(value) as unknown; }
  catch { return fallback; }
}
