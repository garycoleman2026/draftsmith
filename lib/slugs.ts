import { getDatabase } from './db';

export async function uniqueDraftSlug(title: string) {
  const base = title.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44) || 'clan-draft';
  const db = getDatabase();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = `-${crypto.randomUUID().slice(0, 6)}`;
    const slug = `${base.slice(0, 55 - suffix.length)}${suffix}`;
    if (!(await db.prepare('SELECT id FROM drafts WHERE public_slug = ?').bind(slug).first())) return slug;
  }
  return crypto.randomUUID();
}
