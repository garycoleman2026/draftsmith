import { BingoOrganizer } from '../../../../../components/BingoOrganizer';

export default async function BingoManagePage({ params }: { params: Promise<{ token: string; eventId: string }> }) {
  const { token, eventId } = await params;
  return <BingoOrganizer token={token} eventId={eventId} />;
}
