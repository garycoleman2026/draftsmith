import type { Metadata } from 'next';
import { ClanJoin } from '../../../../components/ClanJoin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Join a clan — Terry’s Drafting', robots: { index: false, follow: false } };

export default async function ClanJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClanJoin token={token} />;
}
