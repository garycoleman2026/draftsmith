import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('core UI colour contrast', () => {
  it.each([
    ['parchment copy', '--parchment-text', '--parchment-surface'],
    ['parchment muted copy', '--parchment-muted', '--parchment-surface'],
    ['wood copy', '--wood-text', '--wood-surface'],
    ['wood muted copy', '--wood-muted', '--wood-surface'],
    ['hidden task copy', '--hidden-task-text', '--hidden-task-surface'],
    ['light field copy', '--field-text', '--field-surface'],
    ['light field placeholder', '--field-placeholder', '--field-surface'],
  ])('%s meets WCAG AA for normal text', (_label, foreground, background) => {
    expect(contrast(variable(foreground), variable(background))).toBeGreaterThanOrEqual(4.5);
  });
});

function variable(name: string) {
  const value = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!value) throw new Error(`Missing CSS colour variable ${name}`);
  return value;
}

function contrast(foreground: string, background: string) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (light + 0.05) / (dark + 0.05);
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
