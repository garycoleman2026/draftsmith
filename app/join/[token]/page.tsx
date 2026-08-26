import { SignupForm } from '../../../components/SignupForm';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SignupForm token={token} />;
}
