/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * institutional trust for democratic infrastructure.
 */
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
      'How UnionEyes is governed today and the labour-side controls being put in place to keep the platform worker-first.',
    alternates: buildLocaleAlternates(locale, '/governance'),
  };
}

const commitments = [
  {
    icon: Vote,
    title: 'Worker consent on change of control',
    body: 'Any sale, merger, or transfer of controlling interest will require affirmative consent from labour-elected representatives. The instrument that binds this is in development with partner unions.',
  },
  {
    icon: Shield,
    title: 'Mission lock',
    body: 'Changes to the company mission will require labour-side approval, so worker-first purpose cannot be quietly redefined by investors or executives.',
  },
  {
    icon: Users,
    title: 'Labour-elected oversight seats',
    body: 'The governance structure will include reserved seats for labour-elected representatives with full voting rights on strategic decisions.',
  },
  {
    icon: FileText,
    title: 'Reserved matters',
    body: 'Critical decisions — major pricing changes, data-sharing policy, data residency shifts — will require labour-side approval rather than executive discretion alone.',
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
        description="How UnionEyes is governed today, and the labour-side controls being put in place to keep the platform worker-first."
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">Where things stand today</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            UnionEyes is an incorporated company operating under standard corporate governance. The labour-side controls described on this page — worker consent on change of control, mission lock, reserved oversight seats, and reserved matters — are not yet adopted. They are the controls we have publicly committed to put in place, and which partner unions are entitled to hold us to.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Each instrument will be documented here with its effective date and the underlying agreement once adopted. Until then, this page reflects commitments rather than ratified governance.
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">Labour-side controls being put in place</h2>
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
                q: 'Are these labour-side controls in force today?',
                a: 'No. UnionEyes is incorporated and operating, but the labour-side controls listed above have not yet been adopted into our governing instruments. Each will be added here with its effective date once in force.',
              },
              {
                q: 'What if UnionEyes raises outside capital?',
                a: 'Investor capital is expected to sit alongside — not above — labour-side governance. Any capital raise will be structured so worker oversight cannot be diluted away.',
              },
              {
                q: 'How can partner unions hold UnionEyes to these commitments?',
                a: 'By treating this page as a public undertaking. Partner unions are invited to review the wording of each control as it is drafted and to challenge execution that drifts from intent.',
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
