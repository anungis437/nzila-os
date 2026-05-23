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

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Union Executive Leadership',
    heading: 'Lead with the full weight of institutional history behind you.',
    description:
      'UnionEyes gives executive leaders the institutional continuity visibility, strategic clarity, and governance-of-record intelligence to lead confidently through any transition — without wading through operational complexity.',
    challengeHeading: 'The continuity challenge every executive faces',
    challenges: [
      'Decades of corporate knowledge disappears when senior officers retire or leave',
      'New leaders take 12–18 months to build the context they need to be effective',
      'Governance decisions lack historical context — the same mistakes repeat',
      'Strategic continuity is at risk during every leadership transition',
    ],
    outcomesHeading: 'What executive leaders gain with UnionEyes',
    outcomes: [
      { icon: TrendingUp, title: 'Strategic continuity through change', desc: 'Maintain organizational direction and coherence through succession, reorganization, and strategic transitions.' },
      { icon: BookOpen, title: 'Organizational Memory at your fingertips', desc: 'Decades of negotiation history, governance decisions, and precedents — accessible in executive-grade summaries.' },
      { icon: BarChart3, title: 'Governance oversight with confidence', desc: 'Understand governance health, continuity risks, and modernization progress without reading technical reports.' },
      { icon: Users, title: 'Succession planning that works', desc: 'Identify continuity vulnerabilities early and build knowledge transfer pathways before leadership transitions occur.' },
      { icon: ShieldCheck, title: 'Labour-safe intelligence, guaranteed', desc: 'All intelligence is explainable, human-reviewed, and built on anti-surveillance principles.' },
    ],
    quote:
      '"The institutional knowledge that walks out the door when a president retires is irreplaceable — unless it was captured, governed, and made accessible. That\'s what continuity intelligence means."',
    quoteAttribution: 'UnionEyes Institutional Continuity Principle',
    relatedHeading: 'Explore related solutions',
    finalHeading: 'Ready to lead with institutional clarity?',
    finalBody: 'Start with a free Continuity Reflection scoped to executive leadership.',
    primaryCta: 'Start the free Continuity Reflection',
    finalCta: 'Start the free Continuity Reflection',
  },
  'fr-CA': {
    badge: 'Solutions · Direction exécutive syndicale',
    heading: "Diriger avec toute l'histoire institutionnelle derrière vous.",
    description:
      "UnionEyes donne aux directions exécutives la visibilité de continuité institutionnelle, la clarté stratégique et l'intelligence de gouvernance officielle nécessaires pour diriger avec confiance pendant les transitions, sans devoir traverser toute la complexité opérationnelle.",
    challengeHeading: 'Le défi de continuité auquel chaque direction fait face',
    challenges: [
      'Des décennies de connaissance institutionnelle disparaissent quand des dirigeantes ou dirigeants quittent leurs fonctions',
      'Les nouvelles directions prennent souvent des mois à reconstruire le contexte nécessaire pour agir efficacement',
      'Les décisions de gouvernance manquent de contexte historique, et les mêmes erreurs se répètent',
      'La continuité stratégique devient fragile à chaque transition de leadership',
    ],
    outcomesHeading: 'Ce que les directions exécutives gagnent avec UnionEyes',
    outcomes: [
      { icon: TrendingUp, title: 'Continuité stratégique pendant le changement', desc: "Maintenez l'orientation et la cohérence organisationnelles pendant les successions, réorganisations et transitions stratégiques." },
      { icon: BookOpen, title: 'Mémoire organisationnelle à portée de main', desc: 'Des années d’historique de négociation, de décisions de gouvernance et de précédents accessibles sous forme de synthèses exécutives.' },
      { icon: BarChart3, title: 'Surveillance de gouvernance avec confiance', desc: 'Comprenez la santé de gouvernance, les risques de continuité et les progrès de modernisation sans lire de rapports techniques.' },
      { icon: Users, title: 'Planification de relève qui tient', desc: 'Repérez tôt les vulnérabilités de continuité et créez des voies de transfert de connaissances avant les transitions.' },
      { icon: ShieldCheck, title: 'Intelligence sûre pour le travail', desc: 'Toute intelligence est explicable, revue par des humains et fondée sur des principes anti-surveillance.' },
    ],
    quote:
      '"La connaissance institutionnelle qui quitte l’organisation au départ d’une présidence est irremplaçable, sauf si elle a été capturée, gouvernée et rendue accessible. C’est le sens de l’intelligence de continuité."',
    quoteAttribution: 'Principe de continuité institutionnelle UnionEyes',
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Prêt à diriger avec clarté institutionnelle?',
    finalBody: 'Commencez par une réflexion de continuité gratuite adaptée à votre contexte de direction exécutive.',
    primaryCta: 'Commencer la réflexion de continuité (gratuite)',
    finalCta: 'Commencer la réflexion de continuité (gratuite)',
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
        cta={<Link href={`/${locale}/continuity-assessment/start`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
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
          <Link href={`/${locale}/continuity-assessment/start`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            {copy.finalCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
