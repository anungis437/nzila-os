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
import { Network, RefreshCw, Users, AlertCircle, Layers, ArrowRight, ArrowLeft } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getCarouselNav } from '@/lib/solutions-carousel';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.operations' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions/operations-leadership'),
  };
}

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Operations Leadership',
    heading: 'Operational coherence that survives any transition.',
    description:
      'UnionEyes Operational Coherence gives operations leaders the institutional memory, fragmentation visibility, and continuity planning tools to keep distributed organizations aligned through any change.',
    primaryCta: 'Start the free Continuity Reflection',
    secondaryCta: 'Operational Coherence Architecture',
    challengeHeading: 'The operational fragmentation problem',
    challenges: [
      'Operational knowledge is siloed — regional offices duplicate work because they cannot see what others know',
      'Operational fragility builds invisibly until a leadership change or reorganization triggers a crisis',
      'Cross-functional alignment is assumed but rarely verified — until it breaks down',
      'Institutional processes are undocumented, so every new manager rebuilds from scratch',
    ],
    outcomesHeading: 'What operations leaders gain with UnionEyes',
    outcomes: [
      { icon: Network, title: 'Cross-functional alignment surfaced', desc: 'See alignment and coherence across distributed teams, regional offices, and functional areas — in one operational view.' },
      { icon: RefreshCw, title: 'Continuity through organizational change', desc: 'Maintain operational coherence through reorganization, expansion, and leadership transitions without losing institutional context.' },
      { icon: Users, title: 'Team continuity planning', desc: 'Identify knowledge gaps across teams and build transfer pathways before operational fragilities become crises.' },
      { icon: AlertCircle, title: 'Fragmentation risk made visible', desc: 'Understand the organizational fragmentation patterns undermining long-term operational effectiveness.' },
      { icon: Layers, title: 'Organizational Memory for operations', desc: 'Surface the operational precedents, decisions, and context that inform how your organization actually works.' },
    ],
    relatedHeading: 'Explore related solutions',
    finalHeading: 'Maintain coherence through every change',
    finalBody: 'See Operational Coherence in a live pilot demonstration.',
  },
  'fr-CA': {
    badge: 'Solutions · Direction des opérations',
    heading: 'Une cohérence opérationnelle qui survit à chaque transition.',
    description:
      'La cohérence opérationnelle d’UnionEyes donne aux responsables des opérations la mémoire institutionnelle, la visibilité sur la fragmentation et les outils de planification de continuité nécessaires pour garder les organisations distribuées alignées pendant le changement.',
    primaryCta: 'Commencer la réflexion de continuité (gratuite)',
    secondaryCta: 'Architecture de cohérence opérationnelle',
    challengeHeading: 'Le problème de fragmentation opérationnelle',
    challenges: [
      'La connaissance opérationnelle reste en silos, et les bureaux régionaux répètent le même travail faute de visibilité',
      'La fragilité opérationnelle s’accumule en silence jusqu’à ce qu’une transition ou une réorganisation la révèle',
      'L’alignement entre fonctions est présumé, mais rarement vérifié, jusqu’au moment où il se brise',
      'Les processus institutionnels non documentés forcent chaque nouvelle gestion à reconstruire depuis le départ',
    ],
    outcomesHeading: 'Ce que les responsables des opérations gagnent avec UnionEyes',
    outcomes: [
      { icon: Network, title: 'Alignement transversal rendu visible', desc: 'Voyez l’alignement et la cohérence entre équipes, bureaux régionaux et fonctions dans une seule vue opérationnelle.' },
      { icon: RefreshCw, title: 'Continuité pendant les changements organisationnels', desc: 'Maintenez la cohérence pendant les réorganisations, expansions et transitions sans perdre le contexte institutionnel.' },
      { icon: Users, title: 'Planification de continuité des équipes', desc: 'Repérez les écarts de connaissances et bâtissez des voies de transfert avant que les fragilités deviennent des crises.' },
      { icon: AlertCircle, title: 'Risque de fragmentation rendu visible', desc: 'Comprenez les modèles de fragmentation qui affaiblissent l’efficacité opérationnelle à long terme.' },
      { icon: Layers, title: 'Mémoire organisationnelle pour les opérations', desc: 'Faites ressortir les précédents, décisions et contextes qui expliquent comment votre organisation fonctionne réellement.' },
    ],
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Maintenez la cohérence à travers chaque changement',
    finalBody: 'Voyez la cohérence opérationnelle dans une démonstration pilote.',
  },
};

export default async function OperationsLeadershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('operations-leadership', locale);
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.operationsLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heading}</>}
        description={copy.description}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/continuity-assessment/start`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              {copy.primaryCta}
            </Link>
            <Link href="../platform/operational-coherence" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-navy font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
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
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 shrink-0" />
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
          <Link href={`/${locale}/continuity-assessment/start`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            {copy.primaryCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
