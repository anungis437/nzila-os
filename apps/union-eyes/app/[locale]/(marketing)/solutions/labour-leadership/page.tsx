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
import Link from 'next/link';
import { ShieldCheck, Users, Eye, Scale, HeartHandshake, ArrowRight, ArrowLeft } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getCarouselNav } from '@/lib/solutions-carousel';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.labour' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions/labour-leadership'),
  };
}

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Policy & Labour Leadership',
    heading: 'Labour-safe modernization made clear.',
    description:
      'UnionEyes gives policy and labour leaders a clear path to modernization: explainable outputs, human oversight, and anti-surveillance protections built in.',
    primaryCta: 'Start a review',
    secondaryCta: 'View Governance & Trust',
    challengeHeading: 'The policy challenge',
    challenges: [
      'AI adoption pressure can outpace governance readiness and policy safeguards',
      'Members and representatives need clear guarantees against surveillance misuse',
      'Human review can be inconsistent when standards are not enforced structurally',
      'Policy intent gets diluted when operational teams work from fragmented systems',
    ],
    outcomesHeading: 'What policy and labour leaders gain',
    outcomes: [
      { icon: ShieldCheck, title: 'Built for labour safety', desc: 'Modernize without opening a surveillance path or weakening member protections.' },
      { icon: Eye, title: 'Human oversight stays in place', desc: 'No automated path bypasses elected leadership, policy review, or representation judgment.' },
      { icon: Scale, title: 'Democratic accountability kept', desc: 'Governance controls keep key decisions with people, not opaque systems.' },
      { icon: Users, title: 'Member trust grows', desc: 'Clear safeguards and explainable outputs increase confidence from members and reps.' },
      { icon: HeartHandshake, title: 'Teams stay aligned', desc: 'Policy, governance, and operations stay aligned through change.' },
    ],
    relatedHeading: 'Explore related solutions',
    finalHeading: 'Build member trust into modernization',
    finalBody: 'See a clear labour-safe implementation path in a guided demo.',
  },
  'fr-CA': {
    badge: 'Solutions · Leadership politique et syndical',
    heading: 'Modernisation sûre et claire pour le travail.',
    description:
      'UnionEyes donne aux responsables politiques et syndicaux une voie claire de modernisation : résultats explicables, surveillance humaine et protections anti-surveillance intégrées.',
    primaryCta: 'Faire le bilan',
    secondaryCta: 'Voir gouvernance et confiance',
    challengeHeading: 'Le défi politique',
    challenges: [
      'La pression d’adopter l’IA peut dépasser la préparation de gouvernance et les garanties politiques',
      'Les membres et représentantes ou représentants ont besoin de garanties claires contre les usages de surveillance',
      'La revue humaine devient incohérente lorsque les normes ne sont pas imposées structurellement',
      'L’intention politique se dilue quand les équipes travaillent à partir de systèmes fragmentés',
    ],
    outcomesHeading: 'Ce que les responsables politiques et syndicaux gagnent',
    outcomes: [
      { icon: ShieldCheck, title: 'Conçu pour la sécurité syndicale', desc: 'Modernisez les opérations sans ouvrir de voie de surveillance ni affaiblir les protections.' },
      { icon: Eye, title: 'La supervision humaine reste en place', desc: 'Aucun chemin automatisé ne contourne le leadership élu, la revue politique ou la représentation.' },
      { icon: Scale, title: 'Responsabilité démocratique gardée', desc: 'Les contrôles de gouvernance gardent les décisions stratégiques entre les mains des personnes.' },
      { icon: Users, title: 'La confiance des membres augmente', desc: 'Des garanties claires et des résultats explicables renforcent la confiance des membres et des représentants.' },
      { icon: HeartHandshake, title: 'Les équipes restent alignées', desc: 'La politique, la gouvernance et les opérations restent alignées pendant les changements.' },
    ],
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Intégrez la confiance des membres à la modernisation',
    finalBody: 'Voyez un parcours de mise en œuvre clair pour le travail dans une démonstration guidée.',
  },
};

export default async function LabourLeadershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('labour-leadership', locale);
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.labourLeadership}
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
            <Link href="../trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-navy font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
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
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-electric" />
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
