import { BingoCollaboratorJoin } from '../../../../components/BingoCollaboratorJoin';

export default async function CollaboratePage({ params }: { params: Promise<{ token: string }> }) {
  return <BingoCollaboratorJoin token={(await params).token} />;
}
