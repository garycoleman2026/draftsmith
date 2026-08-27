import type { Metadata } from 'next';
import { BingoPublicBoard } from '../../../../components/BingoPublicBoard';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BingoEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BingoPublicBoard slug={slug} />;
}
