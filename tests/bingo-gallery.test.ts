import { describe, expect, it } from 'vitest';
import {
  builtinGalleryTemplates,
  overallBoardDifficulty,
  sanitizeGalleryDifficulty,
  sanitizeGallerySort,
  sanitizeTemplateCategory,
  sanitizeTemplateSummary,
  sanitizeTemplateTags,
  sanitizeTemplateVisibility,
} from '../lib/bingo-gallery-core';
import { serializeStructuredData } from '../lib/structured-data';

describe('bingo template gallery', () => {
  it('publishes seven complete official starters under stable slugs', () => {
    const templates = builtinGalleryTemplates();
    expect(templates).toHaveLength(7);
    expect(new Set(templates.map((template) => template.slug)).size).toBe(7);
    expect(templates.every((template) => template.official)).toBe(true);
    expect(templates.every((template) => template.configuration.tasks.length === template.gridSize ** 2)).toBe(true);
    expect(templates.map((template) => template.slug)).toContain('starter-lockout');
    expect(templates.map((template) => template.slug)).toContain('starter-center-out');
  });

  it('normalizes public metadata into bounded, reusable values', () => {
    expect(sanitizeTemplateSummary('  Raid   weekend\nfor mixed levels  ', 'fallback')).toBe('Raid weekend for mixed levels');
    expect(sanitizeTemplateSummary('', '  Useful   fallback  ')).toBe('Useful fallback');
    expect(sanitizeTemplateCategory('Raids')).toBe('Raids');
    expect(sanitizeTemplateCategory('Not a category')).toBe('Mixed');
    expect(sanitizeTemplateVisibility('public')).toBe('public');
    expect(sanitizeTemplateVisibility('unlisted')).toBe('unlisted');
    expect(sanitizeTemplateVisibility('clan')).toBe('clan');
  });

  it('deduplicates and sanitizes tags without accepting an unbounded list', () => {
    expect(sanitizeTemplateTags('Raids, raids, CM 5s, <script>, mixed-levels, weekend, points, extra')).toEqual([
      'Raids', 'CM 5s', 'script', 'mixed-levels', 'weekend', 'points',
    ]);
  });

  it('accepts only supported gallery sort modes', () => {
    expect(sanitizeGallerySort('votes')).toBe('votes');
    expect(sanitizeGallerySort('difficulty')).toBe('difficulty');
    expect(sanitizeGallerySort('type')).toBe('type');
    expect(sanitizeGallerySort('rating')).toBe('popular');
    expect(sanitizeGallerySort('unexpected')).toBe('popular');
    expect(sanitizeGalleryDifficulty('expert')).toBe('expert');
    expect(sanitizeGalleryDifficulty('legendary')).toBe('all');
  });

  it('summarizes the overall board difficulty and flags experimental tasks', () => {
    const tasks = structuredClone(builtinGalleryTemplates()[0].configuration.tasks);
    tasks.forEach((task) => { task.difficulty = 'hard'; });
    expect(overallBoardDifficulty(tasks)).toBe('hard');
    tasks[0].difficulty = 'experimental';
    expect(overallBoardDifficulty(tasks)).toBe('experimental');
  });

  it('escapes user-authored structured data before embedding it in a script tag', () => {
    const serialized = serializeStructuredData({ name: '</script><script>alert(1)</script>' });
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
