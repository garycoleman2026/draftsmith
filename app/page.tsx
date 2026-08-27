import type { Metadata } from 'next';
import { CreateDraft } from '../components/CreateDraft';

export const metadata: Metadata = {
  title: 'Terry’s Drafting — fair clan teams and live OSRS bingo',
  description: 'Create fair clan teams from private captain scores, live picks, sign-up surveys, and together/apart rules—then run a custom OSRS bingo.',
  alternates: { canonical: '/' },
};

export default function Home() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Terry’s Drafting',
    url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site', applicationCategory: 'GameApplication',
    operatingSystem: 'Web', description: 'Clan team drafting and custom OSRS bingo event tools.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c') }} /><CreateDraft /></>;
}
