import { BingoTeamBoard } from '../../../../components/BingoTeamBoard';

export default async function BingoTeamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BingoTeamBoard token={token} />;
}
