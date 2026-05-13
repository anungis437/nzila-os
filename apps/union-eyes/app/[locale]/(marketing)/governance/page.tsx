import Link from 'next/link';
import { Shield, Users, FileText, Vote } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Governance & Continuity | UnionEyes',
    description:
      'Our governance commitments: the principles UnionEyes is being built around to stay worker-first as the platform grows.',
    alternates: buildLocaleAlternates(locale, '/governance'),
  };
}

const commitments = [
  {
    icon: Vote,
    title: 'Worker consent on change of control',
    body: 'We are designing the company so that any sale, merger, or transfer of controlling interest will require affirmative consent from labour-elected representatives before it can proceed.',
  },
  {
    icon: Shield,
    title: 'Mission lock',
    body: 'We intend to bind changes to the company mission to labour approval, so worker-first purpose cannot be quietly redefined by investors or executives.',
  },
  {
    icon: Users,
    title: 'Labour-elected oversight seats',
    body: 'Our target governance structure includes reserved seats for labour-elected representatives with full voting rights on strategic decisions.',
  },
  {
    icon: FileText,
    title: 'Reserved matters',
    body: 'Critical decisions — major pricing changes, data-sharing policy, data residency shifts — are intended to require labour-side approval rather than executive discretion alone.',
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
        heading="Governance & continuity"
        description="The commitments UnionEyes is being built around so the platform stays worker-first as it scales."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">Where we are today</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            UnionEyes is in its early stage. The labour-side governance structures described on this page are commitments we are working toward — not bodies that exist today. We are publishing them now so that partner unions and stewards can hold us to them as the company is formalised.
          </p>
          <p className="text-gray-700 leading-relaxed">
            As specific governance instruments — such as labour-elected oversight seats, reserved-matters lists, and continuity protections — are formally established, we will document them here with effective dates and source agreements.
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">Our governance commitments</h2>
          <div className="space-y-6">
            {commitments.map((c) => (
              <div key={c.title} className="flex gap-5 p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-electric/10 text-electric flex items-center justify-center">
                  <c.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-2">{c.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{c.body}</p>
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
                q: 'Are these governance structures in place today?',
                a: 'No. They are commitments that will be formalised as the company is incorporated and partner unions come on board. We will update this page when each protection is in force, with a clear effective date.',
              },
              {
                q: 'What if UnionEyes raises venture capital?',
                a: 'Our intent is that investor capital sits alongside — not above — labour-side governance. Any capital raise will be designed so worker oversight cannot be diluted away.',
              },
              {
                q: 'How will partner unions hold UnionEyes to these commitments?',
                a: 'By treating this page as a public promise. We invite partner unions to review and comment on each commitment as it is formalised, and to push back if execution drifts from intent.',
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
