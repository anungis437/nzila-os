/**
 * ARTIFACT TYPE: Next.js Page
 * DOCTRINE_VERSION: 1.0.0
 *
 * Public landing page for the ICRA — OCI Continuity Risk Assessment.
 * No auth. Fully public. Organizational tone.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileText, BarChart3, ArrowRight, Clock, Lock } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { heroImagery } from '@/lib/marketing-hero-imagery';

interface PageProps {
  params: Promise<{ locale: string }>;
}

const PAGE_COPY = {
  'en-CA': {
    metadataTitle: 'OCI Continuity Risk Assessment | Union Eyes',
    metadataDescription:
      "Assess your labour organization's organizational continuity maturity. Identify governance fragility, operational dependencies, and transition readiness with a fully explainable, no-AI assessment.",
    badge: 'Organizational Assessment',
    heading: 'OCI Continuity Risk Assessment',
    description:
      "A structured, explainable assessment of your labour organization's organizational continuity maturity. No AI scoring. No surveillance. Full transparency.",
    begin: 'Begin Assessment',
    designEyebrow: 'Assessment Design',
    measuresHeading: 'What this assessment measures',
    measuresBody:
      "Organizational continuity is not about any individual's performance. It is about whether the organization can sustain its operations, governance, and organizational knowledge across transitions.",
    processEyebrow: 'Process',
    processHeading: 'How it works',
    footerHeading: 'Begin your continuity assessment',
    footerBody: 'A full organizational continuity profile in under 30 minutes.',
    footerCta: 'Start Assessment',
    dimensions: [
      { label: 'Organizational Continuity', desc: 'How well the institution persists through changes' },
      { label: 'Governance Fragility', desc: 'Risk of governance failure under leadership transition' },
      { label: 'Operational Memory', desc: 'Whether organizational knowledge survives personnel changes' },
      { label: 'Transition Readiness', desc: 'Preparedness for planned and unplanned leadership changes' },
      { label: 'Trust Debt', desc: 'Accumulated governance legitimacy risk from past conduct' },
    ],
    steps: [
      {
        icon: Lock,
        title: 'Informed Consent',
        body: 'You acknowledge how the assessment works before it begins — anti-surveillance, explainable scoring, pseudonymous storage.',
      },
      {
        icon: FileText,
        title: 'Organizational Context',
        body: 'Brief context about your organization. Not scored. Helps contextualize your results.',
      },
      {
        icon: BarChart3,
        title: 'Seven Scored Sections',
        body: '32 questions across operational dependency, governance visibility, organizational memory, transition readiness, operational coordination, explainability, and sovereignty.',
      },
      {
        icon: Shield,
        title: 'Explainable Profile',
        body: 'A full organizational continuity profile with dimension scores, maturity band, observations, and recommended next steps. Every score is traceable.',
      },
    ],
    facts: [
      {
        icon: Clock,
        title: '15–25 minutes',
        body: 'The assessment takes 15 to 25 minutes depending on how much you reflect on each question.',
      },
      {
        icon: Shield,
        title: 'No account required',
        body: 'Your results are accessible via a unique link. No login. No email required.',
      },
      {
        icon: BarChart3,
        title: 'Fully explainable',
        body: 'Every score traces to your answers and published weights. No opaque AI model.',
      },
    ],
  },
  'fr-CA': {
    metadataTitle: 'Évaluation du risque de continuité organisationnelle | Union Eyes',
    metadataDescription:
      "Évaluez la maturité de continuité organisationnelle de votre organisation syndicale. Repérez la fragilité de gouvernance, les dépendances opérationnelles et la préparation aux transitions avec une évaluation entièrement explicable, sans notation par IA.",
    badge: 'Évaluation organisationnelle',
    heading: 'Évaluation du risque de continuité organisationnelle',
    description:
      "Une évaluation structurée et explicable de la maturité de continuité organisationnelle de votre organisation syndicale. Aucune notation par IA. Aucune surveillance. Transparence complète.",
    begin: "Commencer l'évaluation",
    designEyebrow: "Conception de l'évaluation",
    measuresHeading: 'Ce que cette évaluation mesure',
    measuresBody:
      "La continuité organisationnelle ne porte pas sur la performance d'une personne. Elle examine si l'organisation peut maintenir ses opérations, sa gouvernance et ses connaissances organisationnelles pendant les transitions.",
    processEyebrow: 'Processus',
    processHeading: 'Comment cela fonctionne',
    footerHeading: 'Commencez votre évaluation de continuité',
    footerBody: 'Un profil complet de continuité organisationnelle en moins de 30 minutes.',
    footerCta: "Démarrer l'évaluation",
    dimensions: [
      { label: 'Continuité organisationnelle', desc: "Dans quelle mesure l'institution persiste pendant les changements" },
      { label: 'Fragilité de gouvernance', desc: 'Risque de défaillance de gouvernance pendant une transition de leadership' },
      { label: 'Mémoire opérationnelle', desc: 'Capacité des connaissances organisationnelles à survivre aux changements de personnel' },
      { label: 'Préparation aux transitions', desc: 'Préparation aux changements de leadership prévus et imprévus' },
      { label: 'Dette de confiance', desc: 'Risque accumulé de légitimité de gouvernance lié aux conduites passées' },
    ],
    steps: [
      {
        icon: Lock,
        title: 'Consentement éclairé',
        body: "Vous reconnaissez le fonctionnement de l'évaluation avant de commencer : anti-surveillance, notation explicable et stockage pseudonyme.",
      },
      {
        icon: FileText,
        title: 'Contexte organisationnel',
        body: "Un bref contexte sur votre organisation. Il n'est pas noté et sert à contextualiser vos résultats.",
      },
      {
        icon: BarChart3,
        title: 'Sept sections notées',
        body: "32 questions sur les dépendances opérationnelles, la visibilité de gouvernance, la mémoire organisationnelle, la préparation aux transitions, la coordination opérationnelle, l'explicabilité et la souveraineté.",
      },
      {
        icon: Shield,
        title: 'Profil explicable',
        body: 'Un profil complet de continuité organisationnelle avec scores par dimension, niveau de maturité, observations et prochaines étapes recommandées. Chaque score est traçable.',
      },
    ],
    facts: [
      {
        icon: Clock,
        title: '15 à 25 minutes',
        body: 'La durée dépend du temps de réflexion consacré à chaque question.',
      },
      {
        icon: Shield,
        title: 'Aucun compte requis',
        body: 'Vos résultats sont accessibles par un lien unique. Aucun compte ni courriel requis.',
      },
      {
        icon: BarChart3,
        title: 'Entièrement explicable',
        body: 'Chaque score découle de vos réponses et de pondérations publiées. Aucun modèle IA opaque.',
      },
    ],
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: buildLocaleAlternates(locale, '/continuity-assessment'),
  };
}

export default async function ContinuityAssessmentPage({ params }: PageProps) {
  const { locale } = await params;
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];

  return (
    <main>
      <MarketingHeroSection
        imageUrl={heroImagery.organizationalContinuity}
        badge={copy.badge}
        heading={copy.heading}
        description={copy.description}
        cta={
          <Link
            href={`/${locale}/continuity-assessment/start`}
            className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-100"
          >
            {copy.begin}
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
        tone="dark"
        overlayOpacity={0.6}
      />

      {/* What this measures */}
      <section className="mx-auto max-w-5xl px-6 py-20 space-y-12">
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            {copy.designEyebrow}
          </p>
          <h2 className="font-serif text-3xl font-bold text-stone-900">
            {copy.measuresHeading}
          </h2>
          <p className="mx-auto max-w-2xl text-stone-600 leading-relaxed">
            {copy.measuresBody}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {copy.dimensions.map((d) => (
            <div key={d.label} className="rounded-lg border border-stone-200 p-5 space-y-2">
              <p className="font-semibold text-stone-900">{d.label}</p>
              <p className="text-sm text-stone-600">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-stone-100 bg-stone-50 py-20">
        <div className="mx-auto max-w-5xl px-6 space-y-12">
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
              {copy.processEyebrow}
            </p>
            <h2 className="font-serif text-3xl font-bold text-stone-900">{copy.processHeading}</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map((step, i) => (
              <div key={step.title} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xs font-bold text-white">
                    {i + 1}
                  </div>
                  <step.icon className="h-4 w-4 text-stone-500" />
                </div>
                <h3 className="font-semibold text-stone-900">{step.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Time estimate and design principles */}
      <section className="mx-auto max-w-5xl px-6 py-20 space-y-12">
        <div className="grid gap-8 md:grid-cols-3">
          {copy.facts.map((fact) => (
          <div key={fact.title} className="flex items-start gap-4">
            <fact.icon className="mt-1 h-5 w-5 shrink-0 text-stone-400" />
            <div>
              <p className="font-semibold text-stone-900">{fact.title}</p>
              <p className="text-sm text-stone-600">{fact.body}</p>
            </div>
          </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-stone-200 bg-stone-900 py-20 text-center">
        <div className="mx-auto max-w-xl space-y-6 px-6">
          <h2 className="font-serif text-3xl font-bold text-white">
            {copy.footerHeading}
          </h2>
          <p className="text-stone-300 leading-relaxed">
            {copy.footerBody}
          </p>
          <Link
            href={`/${locale}/continuity-assessment/start`}
            className="inline-flex items-center gap-2 rounded-md bg-white px-8 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-100"
          >
            {copy.footerCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
