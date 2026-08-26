import { ParticipantProfile } from '../../../components/ParticipantProfile';

export default async function ParticipantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ParticipantProfile token={token} />;
}
