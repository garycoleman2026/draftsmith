import { Manager } from '../../../components/Manager';

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Manager token={token} />;
}
