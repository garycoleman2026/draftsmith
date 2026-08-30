import type { Metadata } from 'next';
import { CreateDraft } from '../../components/CreateDraft';

export const metadata: Metadata = {
  title: 'Draft fair clan teams — Terry’s Drafting',
  description: 'Collect players, send private captain ranking links, and build fair clan teams with live picks and together or apart rules.',
  alternates: { canonical: '/draft' },
};

export default async function DraftPage({ searchParams }: { searchParams: Promise<{ clanId?: string; intent?: string }> }) {
  const query = await searchParams;
  return <CreateDraft initialClanId={query.clanId ?? ''} bingoIntent={query.intent === 'bingo'} />;
}
