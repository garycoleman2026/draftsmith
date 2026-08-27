import type { Metadata } from 'next';
import { OrganizerDashboard } from '../../components/OrganizerDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DashboardPage() {
  return <OrganizerDashboard />;
}
