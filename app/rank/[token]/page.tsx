import { CaptainRanker } from '../../../components/CaptainRanker';

export default async function RankPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CaptainRanker token={token} />;
}
