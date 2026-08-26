import { PublicEvent } from '../../../components/PublicEvent';

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicEvent slug={slug} />;
}
