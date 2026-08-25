import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://draftsmith-teams.companyscreeninginfo.chatgpt.site'),
  title: 'DraftSmith — Captain-ranked team maker',
  description: 'Upload players, collect captain rankings, and generate balanced teams.',
  openGraph: {
    title: 'DraftSmith — Captain-ranked team maker',
    description: 'Upload players, collect captain rankings, and generate balanced teams.',
    type: 'website',
    url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site',
    images: [
      {
        url: 'https://draftsmith-teams.companyscreeninginfo.chatgpt.site/og.png',
        width: 1731,
        height: 909,
        alt: 'DraftSmith — Captain-ranked team maker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DraftSmith — Captain-ranked team maker',
    description: 'Upload players, collect captain rankings, and generate balanced teams.',
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
