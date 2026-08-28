import type { Metadata } from 'next';
import { CreateDraft } from '../../components/CreateDraft';

export const metadata: Metadata = {
  title: 'Draft fair clan teams — Terry’s Drafting',
  description: 'Collect players, send private captain ranking links, and build fair clan teams with live picks and together or apart rules.',
  alternates: { canonical: '/draft' },
};

export default function DraftPage() {
  return <CreateDraft />;
}
