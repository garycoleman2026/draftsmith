import { BingoPublicBoard } from '../../../../components/BingoPublicBoard';

export default async function BingoEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BingoPublicBoard slug={slug} />;
}
