/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
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
 * organizational trust for democratic infrastructure.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Eye, FileCheck, GitBranch, Vote, ArrowRight, ArrowLeft } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getCarouselNav } from '@/lib/solutions-carousel';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.governance' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions/governance-leadership'),
  };
}

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Governance Leadership',
    heading: 'Governance modernization that earns trust.',
    description:
      'UnionEyes gives governance leaders explainability, audit trails, and context to modernize operations.',
    primaryCta: 'Start a review',
    secondaryCta: 'Governance intelligence layer',
    challengeHeading: 'The governance continuity problem',
    challenges: [
      'Governance decisions lack history, even when precedent exists',
      'Modernization stalls when the reason for current structures is unclear',
      'Audit and compliance requests take weeks when evidence is scattered',
      'Leadership transitions erode organizational memory fast',
    ],
    outcomesHeading: 'What governance leaders gain with UnionEyes',
    outcomes: [
      { icon: ShieldCheck, title: 'Modernization you can defend', desc: 'Every governance change is explainable, traceable, and auditable.' },
      { icon: Eye, title: 'Continuity across transitions', desc: 'Track governance health across leadership changes with history intact.' },
      { icon: FileCheck, title: 'Audit-ready intelligence', desc: 'Keep complete audit trails for governance decisions and human review.' },
      { icon: GitBranch, title: 'Governance evolution made visible', desc: 'See how bylaws, policies, and structures have changed, and why.' },
      { icon: Vote, title: 'Democratic structures preserved', desc: 'Intelligence recommends. Democratic structures decide. Human oversight stays in place.' },
    ],
    commitmentsHeading: 'Governance & Trust commitments',
    commitments: [
      'Full explainability for every output',
      'Complete audit trails, always',
      'Human oversight enforced by design',
      'Democratic governance structures preserved',
    ],
    relatedHeading: 'Explore related solutions',
    finalHeading: 'Modernize governance',
    finalBody: 'See the governance platform in a live pilot.',
  },
  'fr-CA': {
    badge: 'Solutions · Direction de la gouvernance',
    heading: 'Une modernisation de la gouvernance qui inspire confiance.',
    description:
      "UnionEyes donne aux responsables de gouvernance l’explicabilité, les pistes d’audit et le contexte nécessaires pour moderniser les opérations.",
    primaryCta: 'Faire le bilan',
    secondaryCta: 'Substrat d’intelligence de gouvernance officielle',
    challengeHeading: 'Le problème de continuité de gouvernance',
    challenges: [
      "Les décisions de gouvernance manquent d'histoire, même quand le précédent existe",
      'La modernisation ralentit quand la raison des structures n’est pas claire',
      'Les demandes d’audit et de conformité prennent des semaines quand les preuves sont dispersées',
      'Les transitions de leadership érodent vite la mémoire organisationnelle',
    ],
    outcomesHeading: 'Ce que les responsables de gouvernance gagnent avec UnionEyes',
    outcomes: [
      { icon: ShieldCheck, title: 'Modernisation défendable', desc: 'Chaque changement de gouvernance est explicable, traçable et vérifiable.' },
      { icon: Eye, title: 'Continuité pendant les transitions', desc: 'Suivez la santé des structures de gouvernance avec le contexte intact.' },
      { icon: FileCheck, title: 'Intelligence prête pour l’audit', desc: 'Gardez des pistes d’audit complètes pour les décisions et les revues humaines.' },
      { icon: GitBranch, title: 'Évolution rendue visible', desc: 'Montrez comment les statuts, politiques et structures ont changé, et pourquoi.' },
      { icon: Vote, title: 'Structures démocratiques préservées', desc: 'L’intelligence recommande. Les structures démocratiques décident. La surveillance humaine reste en place.' },
    ],
    commitmentsHeading: 'Engagements de gouvernance et de confiance',
    commitments: [
      'Explicabilité complète pour chaque résultat',
      'Pistes d’audit complètes, toujours',
      'Surveillance humaine imposée par conception',
      'Structures de gouvernance démocratique préservées',
    ],
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Modernisez la gouvernance avec confiance',
    finalBody: 'Voyez la plateforme de gouvernance dans un pilote.',
  },
};

export default async function GovernanceLeadershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('governance-leadership', locale);
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.governanceLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heading}</>}
        description={copy.description}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              {copy.primaryCta}
            </Link>
            <Link href="../platform/governance-intelligence" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-navy font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              {copy.secondaryCta}
            </Link>
          </div>
        }
      />

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">{copy.challengeHeading}</h2>
            <ul className="space-y-3">
              {copy.challenges.map((c) => (
                <li key={c} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">{copy.outcomesHeading}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {copy.outcomes.map((o) => (
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

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">{copy.commitmentsHeading}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {copy.commitments.map((label) => (
              <div key={label} className="flex items-center gap-2 p-4 rounded-xl bg-white border border-gray-100 text-sm font-medium text-navy">
                <ShieldCheck className="h-4 w-4 text-electric flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">{copy.relatedHeading}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {carousel.previous ? (
              <Link href={carousel.previous.href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 text-sm font-medium text-navy hover:text-electric transition-colors">
                <ArrowLeft className="h-4 w-4" /> {carousel.previous.label}
              </Link>
            ) : null}
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{copy.finalHeading}</h2>
          <p className="text-white/70 mb-8">{copy.finalBody}</p>
          <Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            {copy.primaryCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
