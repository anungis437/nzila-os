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
import type { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp, BookOpen, BarChart3, Users, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getCarouselNav } from '@/lib/solutions-carousel';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.executive' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions/executive-leadership'),
  };
}

const outcomes = [
  { icon: TrendingUp, title: 'Strategic continuity through change',       desc: 'Maintain organizational direction and coherence through succession, reorganization, and strategic transitions.' },
  { icon: BookOpen,   title: 'Organizational Memory at your fingertips',      desc: 'Decades of negotiation history, governance decisions, and precedents — accessible in executive-grade summaries.' },
  { icon: BarChart3,  title: 'Governance oversight with confidence',       desc: 'Understand governance health, continuity risks, and modernization progress without reading technical reports.' },
  { icon: Users,      title: 'Succession planning that works',             desc: 'Identify continuity vulnerabilities early and build knowledge transfer pathways before leadership transitions occur.' },
  { icon: ShieldCheck,'title': 'Labour-safe intelligence, guaranteed',     desc: 'All intelligence is explainable, human-reviewed, and built on anti-surveillance principles.' },
];

const challenges = [
  'Decades of corporate knowledge disappears when senior officers retire or leave',
  'New leaders take 12–18 months to build the context they need to be effective',
  'Governance decisions lack historical context — the same mistakes repeat',
  'Strategic continuity is at risk during every leadership transition',
];

export default async function ExecutiveLeadershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('executive-leadership', locale);
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.executiveLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions · Union Executive Leadership
          </span>
        }
        heading={<>Lead with the full weight of<br />institutional history behind you.</>}
        description="UnionEyes gives executive leaders the institutional continuity visibility, strategic clarity, and governance-of-record intelligence to lead confidently through any transition — without wading through operational complexity."
        cta={<Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
            Request an Institutional Briefing
          </Link>}
      />

      {/* The challenge */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">The continuity challenge every executive faces</h2>
            <ul className="space-y-3">
              {challenges.map((c) => (
                <li key={c} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">What executive leaders gain with UnionEyes</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {outcomes.map((o) => (
              <div key={o.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <o.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-sm font-bold text-navy mb-2">{o.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote / proof */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <blockquote className="text-xl font-medium text-navy italic leading-relaxed mb-4">
            "The institutional knowledge that walks out the door when a president retires is
            irreplaceable — unless it was captured, governed, and made accessible. That's what
            continuity intelligence means."
          </blockquote>
          <p className="text-sm text-gray-500">UnionEyes Institutional Continuity Principle</p>
        </div>
      </section>

      {/* Adjacent Solutions - Carousel Navigation */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">Explore related solutions</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {carousel.next ? (
              <Link href={carousel.next.href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 text-sm font-medium text-navy hover:text-electric transition-colors">
                {carousel.next.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to lead with institutional clarity?</h2>
          <p className="text-white/70 mb-8">Request an Executive Briefing tailored to your executive leadership context.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request an Institutional Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
