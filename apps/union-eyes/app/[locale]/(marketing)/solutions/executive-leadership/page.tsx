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
import { TrendingUp, BookOpen, BarChart3, Users, ArrowRight, ShieldCheck } from 'lucide-react';
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

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Union Executive Leadership',
    heading: 'Lead with organizational history behind you.',
    description:
      'UnionEyes gives executive leaders clear continuity visibility, strategic clarity, and trusted governance intelligence for transitions.',
    challengeHeading: 'The continuity challenge every executive faces',
    challenges: [
      'Knowledge disappears when senior officers retire or leave',
      'New leaders take months to build the context they need',
      'Governance decisions lack history, so the same mistakes repeat',
      'Strategic continuity is at risk during every transition',
    ],
    outcomesHeading: 'What executive leaders gain with UnionEyes',
    outcomes: [
      { icon: TrendingUp, title: 'Continuity through change', desc: 'Keep direction and coherence through succession, reorganization, and strategic transitions.' },
      { icon: BookOpen, title: 'Memory at your fingertips', desc: 'Negotiation history, governance decisions, and precedents in executive summaries.' },
      { icon: BarChart3, title: 'Governance oversight', desc: 'See governance health, continuity risks, and modernization progress without technical reports.' },
      { icon: Users, title: 'Succession planning that works', desc: 'Find continuity risks early and build knowledge transfer paths before transitions.' },
      { icon: ShieldCheck, title: 'Labour-safe intelligence', desc: 'All intelligence is explainable, human-reviewed, and built on anti-surveillance principles.' },
    ],
    quote:
      '"The organizational knowledge that walks out the door when a president retires is irreplaceable — unless it was captured, governed, and made accessible. That\'s what continuity intelligence means."',
    quoteAttribution: 'UnionEyes Organizational Continuity Principle',
    relatedHeading: 'Explore related solutions',
    finalHeading: 'Ready to lead with clarity?',
    finalBody: 'Start with a review for executive leadership.',
    primaryCta: 'Start a review',
    finalCta: 'Start a review',
  },
  'fr-CA': {
    badge: 'Solutions · Direction exécutive syndicale',
    heading: "Diriger avec l'histoire organisationnelle derrière vous.",
    description:
      "UnionEyes donne aux directions exécutives une visibilité claire de continuité, de la clarté stratégique et une intelligence de gouvernance fiable pour les transitions.",
    challengeHeading: 'Le défi de continuité auquel chaque direction fait face',
    challenges: [
      'La connaissance disparaît quand des dirigeantes ou dirigeants quittent leurs fonctions',
      'Les nouvelles directions prennent des mois à reconstruire le contexte nécessaire',
      'Les décisions de gouvernance manquent d historique, et les mêmes erreurs se répètent',
      'La continuité stratégique devient fragile à chaque transition',
    ],
    outcomesHeading: 'Ce que les directions exécutives gagnent avec UnionEyes',
    outcomes: [
      { icon: TrendingUp, title: 'Continuité pendant le changement', desc: "Gardez l orientation et la cohérence pendant les successions, réorganisations et transitions." },
      { icon: BookOpen, title: 'Mémoire à portée de main', desc: 'Les historiques de négociation, décisions de gouvernance et précédents sont dans des synthèses exécutives.' },
      { icon: BarChart3, title: 'Surveillance de gouvernance', desc: 'Comprenez la santé de gouvernance, les risques de continuité et les progrès de modernisation sans rapports techniques.' },
      { icon: Users, title: 'Planification de relève', desc: 'Repérez tôt les vulnérabilités de continuité et créez des voies de transfert avant les transitions.' },
      { icon: ShieldCheck, title: 'Intelligence sûre pour le travail', desc: 'Toute intelligence est explicable, revue par des humains et fondée sur des principes anti-surveillance.' },
    ],
    quote:
      '"La connaissance organisationnelle qui quitte l’organisation au départ d’une présidence est irremplaçable, sauf si elle a été capturée, gouvernée et rendue accessible. C’est le sens de l’intelligence de continuité."',
    quoteAttribution: 'Principe de continuité organisationnelle UnionEyes',
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Prêt à diriger avec clarté?',
    finalBody: 'Commencez par une revue adaptée à votre contexte de direction.',
    primaryCta: 'Faire le bilan',
    finalCta: 'Faire le bilan',
  },
};

export default async function ExecutiveLeadershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('executive-leadership', locale);
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.executiveLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heading}</>}
        description={copy.description}
        cta={<Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
            {copy.primaryCta}
          </Link>}
      />

      {/* The challenge */}
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

      {/* Outcomes */}
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

      {/* Quote / proof */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <blockquote className="text-xl font-medium text-navy italic leading-relaxed mb-4">
            {copy.quote}
          </blockquote>
          <p className="text-sm text-gray-500">{copy.quoteAttribution}</p>
        </div>
      </section>

      {/* Adjacent Solutions - Carousel Navigation */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">{copy.relatedHeading}</h3>
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{copy.finalHeading}</h2>
          <p className="text-white/70 mb-8">{copy.finalBody}</p>
          <Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            {copy.finalCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
