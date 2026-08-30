import { json } from '@/lib/db';

type WikiResponse = {
  query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string }> }> };
};

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name')?.trim().replace(/\s+/g, ' ').slice(0, 100) ?? '';
  if (!name || /[<>\r\n]/.test(name)) return json({ error: 'Choose an OSRS item or boss.' }, { status: 400 });
  const api = new URL('https://oldschool.runescape.wiki/api.php');
  api.search = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: name, gsrnamespace: '6', gsrlimit: '1',
    prop: 'imageinfo', iiprop: 'url', origin: '*',
  }).toString();
  try {
    const response = await fetch(api, { headers: { 'User-Agent': "Terry's Drafting artwork resolver" }, cf: { cacheTtl: 86_400, cacheEverything: true } });
    if (!response.ok) throw new Error(`Wiki returned ${response.status}`);
    const data = await response.json() as WikiResponse;
    const page = Object.values(data.query?.pages ?? {})[0];
    const imageUrl = page?.imageinfo?.[0]?.url;
    if (!imageUrl || !imageUrl.startsWith('https://')) return json({ error: 'Artwork not found.' }, { status: 404 });
    return new Response(null, { status: 302, headers: { Location: imageUrl, 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } });
  } catch {
    return json({ error: 'Artwork not found.' }, { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } });
  }
}
