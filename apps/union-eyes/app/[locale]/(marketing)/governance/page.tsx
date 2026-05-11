import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Users, FileText, Vote } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Governance Structure | UnionEyes',
    description:
      'How the UnionEyes golden share works and how labour governance protections are enforced.',
    alternates: buildLocaleAlternates(locale, '/governance'),
  };
}

const provisions = [
  {
    icon: Vote,
    title: 'Veto on change of control',
    body: 'The golden share gives the Labour Council authority to block any sale, merger, or transfer of controlling interest without affirmative labour consent.',
  },
  {
    icon: Shield,
    title: 'Mission lock',
    body: 'Changes to the company mission require golden share consent, protecting worker-first purpose against investor or executive drift.',
  },
  {
    icon: Users,
    title: 'Labour-elected council seats',
    body: 'Reserved board seats are held by labour-elected representatives with full voting rights on strategic decisions.',
  },
  {
    icon: FileText,
    title: 'Reserved matters',
    body: 'Critical decisions such as major pricing changes, data-sharing policy, and data residency shifts require golden share approval.',
  },
];

export default function GovernancePage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.governance}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Governance
          </span>
        }
        heading="The golden share, explained"
        description="This is a legal governance structure, not a brand claim. Here is what it protects and how."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">What is a golden share?</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            A golden share is a special class of equity with veto rights over defined decisions, regardless of ordinary share distribution.
          </p>
          <p className="text-gray-700 leading-relaxed">
            In UnionEyes, this share is held by a Labour Council elected by partner unions. The structure was established at incorporation and cannot be removed without golden-shareholder consent.
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">What the golden share protects</h2>
          <div className="space-y-6">
            {provisions.map((p) => (
              <div key={p.title} className="flex gap-5 p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-electric/10 text-electric flex items-center justify-center">
                  <p.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-2">{p.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">Frequently asked</h2>
          <div className="space-y-6 divide-y divide-gray-100">
            {[
              {
                q: 'What if UnionEyes raises venture capital?',
                a: 'Investors can hold ordinary shares. The golden share is separate, non-dilutive, and remains in force.',
              },
              {
                q: 'Can the governance model be changed later?',
                a: 'Only with golden share consent. The protection is designed specifically to prevent unilateral changes.',
              },
              {
                q: 'Who provides governance oversight?',
                a: 'A labour-elected council structure with reserved powers and documented oversight responsibilities.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="pt-6 first:pt-0">
                <h3 className="font-semibold text-navy mb-2">{q}</h3>
                <p className="text-gray-700 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="../story" className="text-sm text-electric font-semibold hover:underline">
            ← Back to Our Story
          </Link>
          <Link href="../trust" className="text-sm text-electric font-semibold hover:underline">
            View Trust Center →
          </Link>
        </div>
      </section>
    </div>
  );
}
