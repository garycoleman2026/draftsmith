import type { Metadata } from 'next';
import { PublicEvent } from '../../../components/PublicEvent';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicEvent slug={slug} />;
}
