import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://draftsmith-teams.companyscreeninginfo.chatgpt.site'),
  title: 'Terry’s Drafting — Clan bingo team drafts',
  description: 'Build clan bingo teams with public signups, private captain scores, roster rules, and live picks.',
  openGraph: {
    title: 'Terry’s Drafting — Clan bingo team drafts',
    description: 'Build clan bingo teams with public signups, private captain scores, roster rules, and live picks.',
    type: 'website',
    url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site',
    images: [
      {
        url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site/og.png',
        width: 1734,
        height: 907,
        alt: 'Terry’s Drafting — Clan bingo team drafts',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terry’s Drafting — Clan bingo team drafts',
    description: 'Build clan bingo teams with public signups, private captain scores, roster rules, and live picks.',
    images: ['https://draftsmith-teams.companyscreeninginfo.chatgpt.site/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
