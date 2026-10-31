import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Connect with the Nzila Ventures team about Union Eyes pilot discovery, CIVIC institutional briefings, partnerships, and responsible software design.',
  openGraph: {
    title: 'Contact Nzila Ventures',
    description: 'Start a human conversation about Union Eyes, CIVIC, institutional continuity, or collaboration.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Nzila Ventures — Human-centered institutional software' }],
  },
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
