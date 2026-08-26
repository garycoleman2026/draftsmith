import { json } from '../../../lib/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get('name') || '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 12 || !/^[A-Za-z0-9 _-]+$/.test(name)) {
    return json({ error: 'Enter a valid in-game name.' }, { status: 400 });
  }

  const encoded = encodeURIComponent(name);
  const headers = { Accept: 'application/json', 'User-Agent': 'Terrys-Drafting/1.0' };
  const [detailsResult, gainsResult, hiscoresResult] = await Promise.allSettled([
    fetch(`https://api.wiseoldman.net/v2/players/${encoded}`, { headers }),
    fetch(`https://api.wiseoldman.net/v2/players/${encoded}/gained?period=week`, { headers }),
    fetch(`https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encoded}`, {
      headers: { Accept: 'text/plain', 'User-Agent': 'Terrys-Drafting/1.0' },
    }),
  ]);

  let details: Record<string, unknown> | null = null;
  if (detailsResult.status === 'fulfilled' && detailsResult.value.ok) {
    details = (await detailsResult.value.json()) as Record<string, unknown>;
  }
  let gains: Record<string, unknown> | null = null;
  if (gainsResult.status === 'fulfilled' && gainsResult.value.ok) {
    gains = (await gainsResult.value.json()) as Record<string, unknown>;
  }
  let officialOverall: { rank: number | null; level: number | null; experience: number | null } | null = null;
  if (hiscoresResult.status === 'fulfilled' && hiscoresResult.value.ok) {
    const firstLine = (await hiscoresResult.value.text()).split(/\r?\n/, 1)[0] || '';
    const [rank, level, experience] = firstLine.split(',').map(Number);
    officialOverall = {
      rank: Number.isFinite(rank) && rank >= 0 ? rank : null,
      level: Number.isFinite(level) && level >= 0 ? level : null,
      experience: Number.isFinite(experience) && experience >= 0 ? experience : null,
    };
  }

  const latestSnapshot = asRecord(details?.latestSnapshot);
  const snapshotData = asRecord(latestSnapshot?.data);
  const skills = asRecord(snapshotData?.skills);
  const overall = asRecord(skills?.overall);
  const gainsData = asRecord(gains?.data);
  const gainsSkills = asRecord(gainsData?.skills);
  const gainsOverall = asRecord(gainsSkills?.overall);
  const gainedExperience = asRecord(gainsOverall?.experience);
  const gainedEhp = asRecord(gainsOverall?.ehp);

  return json({
    name,
    links: {
      officialHiscores: `https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=${encoded}`,
      wiseOldMan: `https://wiseoldman.net/players/${encoded}`,
    },
    official: officialOverall,
    wiseOldMan: details ? {
      displayName: typeof details.displayName === 'string' ? details.displayName : name,
      accountType: typeof details.type === 'string' ? details.type : null,
      combatLevel: numberOrNull(details.combatLevel),
      totalLevel: numberOrNull(overall?.level),
      experience: numberOrNull(details.exp) ?? numberOrNull(overall?.experience),
      ehp: numberOrNull(details.ehp),
      ehb: numberOrNull(details.ehb),
      updatedAt: typeof details.updatedAt === 'string' ? details.updatedAt : null,
      weeklyExperience: numberOrNull(gainedExperience?.gained),
      weeklyEhp: numberOrNull(gainedEhp?.gained),
    } : null,
  });
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
