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
/**
 * Executive Intelligence — Strategic summaries & leadership continuity
 *
 * Exposes executive-grade operational clarity.
 * Hides internal cognition complexity.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, FileText, Users, TrendingUp, ShieldCheck, Layers } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const isFr = locale === 'fr-CA';
  return {
    title: isFr ? 'Intelligence exécutive | UnionEyes' : 'Executive Intelligence | UnionEyes',
    description: isFr
      ? 'Résumés stratégiques calmes et intelligence de continuité pour les directions syndicales. Clarté opérationnelle sans complexité technique.'
      : 'Calm, executive-grade strategic summaries and leadership continuity intelligence for union executives. Operational clarity without technical complexity.',
    alternates: buildLocaleAlternates(locale, '/executive-intelligence'),
  };
}

const surfaces = {
  'en-CA': [
    {
      icon: FileText,
      title: 'Strategic Summaries',
      desc: 'Executive-grade summaries of organizational status, continuity risks, and strategic priorities — human-readable and action-oriented.',
    },
    {
      icon: TrendingUp,
      title: 'Continuity Visibility',
      desc: 'See organizational continuity health at a glance: what knowledge is at risk, where transitions are occurring, and what requires leadership attention.',
    },
    {
      icon: Users,
      title: 'Leadership Continuity Tracking',
      desc: 'Track succession readiness, knowledge transfer progress, and continuity preparedness across the organization.',
    },
    {
      icon: BarChart3,
      title: 'Executive intelligence briefings',
      desc: 'Governance modernization progress, explainability status, and continuity summaries for leadership review.',
    },
    {
      icon: ShieldCheck,
      title: 'Trust & Compliance Dashboards',
      desc: 'Operational trust posture, compliance status, and audit readiness in one executive surface.',
    },
    {
      icon: Layers,
      title: 'Organizational Memory Snapshots',
      desc: 'Point-in-time views of organizational knowledge and precedents.',
    },
  ],
  'fr-CA': [
    {
      icon: FileText,
      title: 'Résumés stratégiques',
      desc: 'Des résumés de niveau direction sur l’état organisationnel, les risques de continuité et les priorités stratégiques — lisibles et orientés action.',
    },
    {
      icon: TrendingUp,
      title: 'Visibilité de la continuité',
      desc: 'Visualisez la santé de la continuité organisationnelle : savoir à risque, transitions en cours, points d’attention pour la direction.',
    },
    {
      icon: Users,
      title: 'Suivi de la continuité du leadership',
      desc: 'Suivez la préparation à la succession, le transfert de connaissances et la préparation à la continuité dans toute l’organisation.',
    },
    {
      icon: BarChart3,
      title: 'Briefings de gouvernance officielle',
      desc: 'Progrès de la modernisation de la gouvernance, audit d’explicabilité et synthèses de supervision — conçus pour le conseil d’administration.',
    },
    {
      icon: ShieldCheck,
      title: 'Tableaux de confiance et conformité',
      desc: 'Posture de confiance opérationnelle, conformité de gouvernance et préparation à l’audit organisationnel — tout sur une surface direction.',
    },
    {
      icon: Layers,
      title: 'Instantanés de mémoire organisationnelle',
      desc: 'Vues ponctuelles des connaissances, précédents historiques et contexte organisationnel disponibles pour la direction.',
    },
  ],
};

const principles = {
  'en-CA': [
    { label: 'Calm',              desc: 'No technical complexity exposed at executive surfaces' },
    { label: 'Strategic',         desc: 'Focused on organizational direction and continuity' },
    { label: 'Explainable',       desc: 'Every summary traces back to evidence' },
    { label: 'Governance-safe',   desc: 'Full human oversight at all decision points' },
    { label: 'Labour-safe',       desc: 'Zero individual monitoring or worker conduct grading' },
    { label: 'Enterprise-grade',  desc: 'Built for organizational trust, not lightweight tools' },
  ],
  'fr-CA': [
    { label: 'Calme',              desc: 'Aucune complexité technique exposée aux surfaces directionnelles' },
    { label: 'Stratégique',        desc: 'Axé sur la direction organisationnelle et la continuité' },
    { label: 'Explicable',         desc: 'Chaque résumé est traçable à ses preuves' },
    { label: 'Sûr pour la gouvernance', desc: 'Supervision humaine à chaque point de décision' },
    { label: 'Respectueux du travail',  desc: 'Aucune surveillance individuelle ni notation de conduite' },
    { label: 'De niveau entreprise',    desc: 'Conçu pour la confiance organisationnelle, pas pour des dashboards de startup' },
  ],
};

export default async function ExecutiveIntelligencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Demander une revue' : 'Request a review';
  const surfacesArr = surfaces[locale as keyof typeof surfaces] ?? surfaces['en-CA'];
  const principlesArr = principles[locale as keyof typeof principles] ?? principles['en-CA'];
  const stakeholderJourney = {
    'en-CA': [
      'See continuity risks before they become crises',
      'Lead governance modernization with explainable intelligence',
      'Maintain strategic coherence through succession and change',
      'Share organizational health with boards',
    ],
    'fr-CA': [
      'Voir les risques de continuité avant qu’ils ne deviennent des crises',
      'Piloter la modernisation de la gouvernance avec une intelligence explicable',
      'Maintenir la cohérence stratégique lors des successions et des changements',
      'Communiquer la santé organisationnelle aux conseils avec confiance',
    ],
  };
  const stakeholderJourneyArr = stakeholderJourney[locale as keyof typeof stakeholderJourney] ?? stakeholderJourney['en-CA'];
  const faqs = {
    'en-CA': [
      { q: 'Does this feel strategically trustworthy?',  a: 'Executive Intelligence is built to earn organizational trust through transparency and explainability.' },
      { q: 'Does this feel operationally mature?',       a: 'Calm, modular, and enterprise-grade — not lightweight tools or AI admin panels.' },
      { q: 'Does this feel labour-safe?',                a: 'Zero worker surveillance. Human oversight built into every intelligence output.' },
    ],
    'fr-CA': [
      { q: 'Est-ce stratégiquement digne de confiance ?', a: 'L’intelligence exécutive est conçue pour mériter la confiance organisationnelle par la transparence et l’explicabilité.' },
      { q: 'Est-ce opérationnellement mature ?', a: 'Calme, modulaire et de niveau entreprise — pas des dashboards de startup ou des panneaux IA.' },
      { q: 'Est-ce respectueux du travail ?', a: 'Aucune surveillance des travailleurs. Supervision humaine intégrée à chaque sortie d’intelligence.' },
    ],
  };
  const faqsArr = faqs[locale as keyof typeof faqs] ?? faqs['en-CA'];
  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.executiveIntelligenceModule}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Executive Intelligence
          </span>
        }
        heading={<>Strategic clarity.<br />Without technical complexity.</>}
        description="Executive Intelligence surfaces continuity, modernization status, and organizational health in calm, executive-readable formats."
        cta={
          <Link
            href={`/${locale}/organizational-continuity-risk`}
            className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
          >
            {briefingCta}
          </Link>
        }
      />

      {/* ── Design Principles ── */}
      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-8">
            Executive Intelligence Design Principles
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {principlesArr.map((p) => (
              <div key={p.label} className="text-center p-4 rounded-xl bg-white border border-gray-100">
                <div className="text-sm font-bold text-navy mb-1">{p.label}</div>
                <div className="text-xs text-gray-500 leading-tight">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Surfaces ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">            <h2 className="text-3xl font-bold text-navy mb-3">
              Built for organizational leadership
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Not analytics dashboards. Not engineering tools. Executive Intelligence surfaces
              are purpose-built for the clarity that union leaders need.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {surfacesArr.map((s) => (
              <div key={s.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <s.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-base font-bold text-navy mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stakeholder Journey ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>              <h2 className="text-3xl font-bold text-navy mb-4">
                For union executives who lead through complexity
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                Executive Intelligence is designed for the president, secretary-treasurer,
                or regional director who needs to lead through transitions, modernization,
                and continuity challenges without technical reports or fragmented data.
              </p>
              <ul className="space-y-3">
                {stakeholderJourneyArr.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
                {faqsArr.map((item) => (
                <div key={item.q} className="p-5 rounded-xl bg-white border border-gray-100">
                  <p className="text-sm font-semibold text-navy mb-2">{item.q}</p>
                  <p className="text-sm text-gray-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to lead with organizational clarity?
          </h2>
          <p className="text-white/70 mb-8">
            {locale === 'fr-CA'
              ? 'Commencez par une revue pour voir l’intelligence exécutive en action.'
                : 'Start with a review to see Executive Intelligence in action.'}
          </p>
          <Link
            href={`/${locale}/organizational-continuity-risk`}
            className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
          >
            {briefingCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
