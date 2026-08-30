import type { Metadata } from 'next';
import { BingoPublicBoard } from '../../../../components/BingoPublicBoard';
import { ensureSchema, getDatabase } from '../../../../lib/db';

const origin = 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await ensureSchema();
    const event = await getDatabase().prepare(
      `SELECT be.title, be.mode, be.status, be.public_spectator, be.public_listed,
              CASE WHEN c.public_listing = 1 THEN c.name END AS clan_name
       FROM bingo_events be JOIN drafts d ON d.id = be.draft_id LEFT JOIN clans c ON c.id = d.clan_id
       WHERE be.public_slug = ?`,
    ).bind(slug).first<{ title: string; mode: string; status: string; public_spectator: number; public_listed: number; clan_name: string | null }>();
    if (!event || !event.public_spectator) return { title: 'Bingo event unavailable — Terry’s Drafting', robots: { index: false, follow: false } };
    const description = `${event.status === 'live' ? 'Live' : event.status === 'paused' ? 'Paused' : event.status === 'complete' ? 'Completed' : 'Upcoming'} ${event.mode} OSRS clan bingo${event.clan_name ? ` hosted by ${event.clan_name}` : ''}. View the board, standings, and verified progress.`;
    const index = Boolean(event.public_listed);
    return {
      title: `${event.title} — OSRS clan bingo`, description,
      alternates: { canonical: `/bingo/event/${slug}` }, robots: { index, follow: index },
      openGraph: { title: event.title, description, url: `${origin}/bingo/event/${slug}`, images: [] },
      twitter: { title: event.title, description, images: [] },
    };
  } catch {
    return { title: 'OSRS clan bingo — Terry’s Drafting', robots: { index: false, follow: false } };
  }
}

export default async function BingoEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BingoPublicBoard slug={slug} />;
}
