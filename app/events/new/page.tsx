import type { Metadata } from 'next';
import { EventSetupWizard } from '../../../components/EventSetupWizard';
import { SiteFooter } from '../../../components/SiteFooter';
import { SiteHeader } from '../../../components/SiteHeader';

export const metadata: Metadata = {
  title: 'Start a clan event — Terry’s Drafting',
  description: 'Start a team draft, an OSRS bingo, or a complete clan event from one guided setup.',
  alternates: { canonical: '/events/new' },
};

export default function NewEventPage() {
  return <main className="realm-bg min-h-screen text-[#eadcb9]">
    <SiteHeader badge="New event" />
    <EventSetupWizard />
    <SiteFooter />
  </main>;
}
