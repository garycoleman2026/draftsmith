import { describe, expect, it } from 'vitest';
import {
  builtinGalleryTemplates,
  sanitizeGallerySort,
  sanitizeTemplateCategory,
  sanitizeTemplateSummary,
  sanitizeTemplateTags,
  sanitizeTemplateVisibility,
} from '../lib/bingo-gallery-core';
import { serializeStructuredData } from '../lib/structured-data';

describe('bingo template gallery', () => {
  it('publishes six complete official starters under stable slugs', () => {
    const templates = builtinGalleryTemplates();
    expect(templates).toHaveLength(6);
    expect(new Set(templates.map((template) => template.slug)).size).toBe(6);
    expect(templates.every((template) => template.official)).toBe(true);
    expect(templates.every((template) => template.configuration.tasks.length === template.gridSize ** 2)).toBe(true);
    expect(templates.map((template) => template.slug)).toContain('starter-lockout');
  });

  it('normalizes public metadata into bounded, reusable values', () => {
    expect(sanitizeTemplateSummary('  Raid   weekend\nfor mixed levels  ', 'fallback')).toBe('Raid weekend for mixed levels');
    expect(sanitizeTemplateSummary('', '  Useful   fallback  ')).toBe('Useful fallback');
    expect(sanitizeTemplateCategory('Raids')).toBe('Raids');
    expect(sanitizeTemplateCategory('Not a category')).toBe('Mixed');
    expect(sanitizeTemplateVisibility('public')).toBe('public');
    expect(sanitizeTemplateVisibility('unlisted')).toBe('private');
  });

  it('deduplicates and sanitizes tags without accepting an unbounded list', () => {
    expect(sanitizeTemplateTags('Raids, raids, CM 5s, <script>, mixed-levels, weekend, points, extra')).toEqual([
      'Raids', 'CM 5s', 'script', 'mixed-levels', 'weekend', 'points',
    ]);
  });

  it('accepts only supported gallery sort modes', () => {
    expect(sanitizeGallerySort('rating')).toBe('rating');
    expect(sanitizeGallerySort('unexpected')).toBe('popular');
  });

  it('escapes user-authored structured data before embedding it in a script tag', () => {
    const serialized = serializeStructuredData({ name: '</script><script>alert(1)</script>' });
    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
