export const BINGO_TEAM_COLOR_OPTIONS = [
  { name: 'Guthix green', value: '#3f6a45' },
  { name: 'Mystic purple', value: '#714a79' },
  { name: 'Dragon orange', value: '#9b542f' },
  { name: 'Sea blue', value: '#2f6875' },
  { name: 'Dwarven gold', value: '#8a7330' },
  { name: 'Blood red', value: '#88424a' },
  { name: 'Rune blue', value: '#506b8b' },
  { name: 'Moss', value: '#6f693c' },
  { name: 'Arceuus violet', value: '#58518a' },
  { name: 'Karamja teal', value: '#327467' },
  { name: 'Mahogany', value: '#7a4935' },
  { name: 'Rose', value: '#95556b' },
] as const;

export function normalizeBingoTeamColor(value: unknown) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.trim())) return null;
  return value.trim().toLocaleLowerCase('en-US');
}

export function readableTextColor(background: string) {
  const normalized = normalizeBingoTeamColor(background) ?? '#3f6a45';
  const [red, green, blue] = [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const luminance = [red, green, blue]
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.48 ? '#24180d' : '#fff4cf';
}

export function completedTileStyle(colors: string[]) {
  const valid = [...new Set(colors.map(normalizeBingoTeamColor).filter((color): color is string => Boolean(color)))];
  const primary = valid[0] ?? '#3f6a45';
  if (valid.length < 2) {
    return {
      backgroundColor: primary,
      backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.18), rgba(0,0,0,0.2))',
      color: readableTextColor(primary),
    };
  }
  const width = 100 / valid.length;
  const bands = valid.map((color, index) => `${color} ${(index * width).toFixed(2)}% ${((index + 1) * width).toFixed(2)}%`).join(', ');
  return {
    backgroundColor: primary,
    backgroundImage: `linear-gradient(rgba(10,14,8,0.28), rgba(10,14,8,0.42)), linear-gradient(135deg, ${bands})`,
    color: '#fff4cf',
  };
}
