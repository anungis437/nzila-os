/**
 * Corporate Stewardship Appendix — procurement-grade content.
 *
 * This page is INTENTIONALLY deep and not surfaced in primary navigation.
 * It exists for procurement reviewers, RFP follow-ups, and diligence requests
 * that need to understand UnionEyes' corporate stewardship structure.
 *
 * Per organizational realignment directive: vendor-side governance mechanics
 * (ownership structure, founder protections, control mechanics) are NOT
 * surfaced as public marketing pillars. They live here as a procurement
 * appendix only.
 *
 * The word "governance" in UnionEyes public surfaces refers exclusively to
 * the CUSTOMER's organizational governance ecosystem.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Users, FileText, Vote } from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

const APPENDIX_COPY = {
  'en-CA': {
    title: 'Corporate Stewardship Appendix | UnionEyes',
    description:
      'Procurement-grade appendix documenting UnionEyes corporate stewardship structure. For diligence and procurement reviewers.',
    kicker: 'Procurement appendix',
    heading: 'Corporate stewardship structure',
    intro:
      'This appendix documents the corporate stewardship structure of UnionEyes for procurement diligence and RFP follow-up. It is not part of the public marketing narrative.',
    note:
      'The word “governance” on UnionEyes public surfaces refers to the customer’s organizational governance operating environment, not corporate stewardship mechanics.',
    overviewHeading: 'Structural overview',
    overviewBody1:
      'UnionEyes carries a reserved class of equity with veto rights over defined decisions, regardless of ordinary share distribution. The reserved share is held by a labour council elected by partner organizations.',
    overviewBody2:
      'The structure was established at incorporation and cannot be removed without reserved-shareholder consent. It is designed to preserve procedural neutrality, mission alignment, and operational sovereignty across ownership transitions.',
    reservedHeading: 'Reserved matters',
    faqHeading: 'Frequently asked (procurement)',
    faqs: [
      {
        q: 'What if UnionEyes raises venture capital?',
        a: 'Investors may hold ordinary shares. The reserved share is separate, non-dilutive, and remains in force.',
      },
      {
        q: 'Can the stewardship model be changed later?',
        a: 'Only with reserved-share consent. The protection is designed specifically to prevent unilateral changes.',
      },
      {
        q: 'Who provides stewardship oversight?',
        a: 'A labour-elected council structure with reserved powers and documented oversight responsibilities.',
      },
      {
        q: 'Why is this content not in the main navigation?',
        a: 'Corporate stewardship mechanics are procurement-grade context, not public marketing identity. UnionEyes external narrative is built around the customer’s organizational governance, continuity, and operational trust, not vendor ownership structure.',
      },
    ],
    closing:
      'Continuity-layer tooling that surfaces structural stewardship data operates under human oversight, with full explainability available to any party conducting procurement review. No governance decision is automated; every output is reviewable by counsel, auditors, or labour-elected oversight bodies.',
    backLink: 'Back to Trust & Stewardship',
    contactLink: 'Procurement enquiries',
    provisions: [
      {
        icon: Vote,
        title: 'Veto on change of control',
        body: 'A reserved special share gives an elected labour council authority to block any sale, merger, or transfer of controlling interest without affirmative labour consent.',
      },
      {
        icon: Shield,
        title: 'Mission lock',
        body: 'Changes to the company mission require reserved-share consent, protecting worker-first purpose against investor or executive drift.',
      },
      {
        icon: Users,
        title: 'Labour-elected council seats',
        body: 'Reserved board seats are held by labour-elected representatives with full voting rights on strategic decisions.',
      },
      {
        icon: FileText,
        title: 'Reserved matters',
        body: 'Critical decisions such as major pricing changes, data-sharing policy, and data residency shifts require reserved-share approval.',
      },
    ],
  },
  'fr-CA': {
    title: 'Annexe de gérance corporative | UnionEyes',
    description:
      'Annexe destinée à l’approvisionnement qui documente la structure de gérance corporative de UnionEyes pour la diligence raisonnable.',
    kicker: 'Annexe d’approvisionnement',
    heading: 'Structure de gérance corporative',
    intro:
      'Cette annexe documente la structure de gérance corporative de UnionEyes pour la diligence raisonnable et les suivis d’appels d’offres. Elle ne fait pas partie du récit marketing public.',
    note:
      'Le mot « gouvernance » sur les surfaces publiques de UnionEyes renvoie à l’environnement de gouvernance organisationnelle du client, et non aux mécanismes de gérance corporative.',
    overviewHeading: 'Vue structurelle',
    overviewBody1:
      'UnionEyes comprend une catégorie réservée d’équité assortie d’un droit de veto sur des décisions définies, peu importe la répartition des actions ordinaires. Cette action réservée est détenue par un conseil du travail élu par les organisations partenaires.',
    overviewBody2:
      'La structure a été établie à la constitution et ne peut être retirée sans le consentement du détenteur de l’action réservée. Elle vise à préserver la neutralité procédurale, l’alignement de mission et la souveraineté opérationnelle à travers les transitions de propriété.',
    reservedHeading: 'Matières réservées',
    faqHeading: 'Questions fréquentes (approvisionnement)',
    faqs: [
      {
        q: 'Que se passe-t-il si UnionEyes lève du capital de risque?',
        a: 'Des investisseurs peuvent détenir des actions ordinaires. L’action réservée est distincte, non dilutive et demeure en vigueur.',
      },
      {
        q: 'Le modèle de gérance peut-il être modifié plus tard?',
        a: 'Seulement avec le consentement de l’action réservée. Cette protection existe précisément pour empêcher des changements unilatéraux.',
      },
      {
        q: 'Qui assure la surveillance de la gérance?',
        a: 'Une structure de conseil du travail élu, dotée de pouvoirs réservés et de responsabilités de surveillance documentées.',
      },
      {
        q: 'Pourquoi ce contenu n’apparaît-il pas dans la navigation principale?',
        a: 'Les mécanismes de gérance corporative relèvent du contexte d’approvisionnement, pas de l’identité marketing publique. Le récit externe de UnionEyes porte sur la gouvernance organisationnelle du client, la continuité et la confiance opérationnelle, et non sur la structure de propriété du fournisseur.',
      },
    ],
    closing:
      'L’outillage de couche de continuité qui fait ressortir des données structurelles de gérance fonctionne sous supervision humaine, avec une explicabilité complète accessible à toute partie menant une revue d’approvisionnement. Aucune décision de gouvernance n’est automatisée; chaque résultat peut être révisé par le service juridique, les auditeurs ou les instances de surveillance élues par le travail.',
    backLink: 'Retour à Confiance et gérance',
    contactLink: 'Demandes d’approvisionnement',
    provisions: [
      {
        icon: Vote,
        title: 'Veto sur le changement de contrôle',
        body: 'Une action spéciale réservée donne à un conseil du travail élu le pouvoir de bloquer toute vente, fusion ou cession du contrôle sans consentement affirmatif du travail.',
      },
      {
        icon: Shield,
        title: 'Verrou de mission',
        body: 'Les changements à la mission de l’entreprise exigent le consentement de l’action réservée afin de protéger la finalité centrée sur le travail contre la dérive d’investisseurs ou de dirigeants.',
      },
      {
        icon: Users,
        title: 'Sièges au conseil élus par le travail',
        body: 'Des sièges réservés au conseil sont occupés par des représentantes et représentants élus par le travail, avec plein droit de vote sur les décisions stratégiques.',
      },
      {
        icon: FileText,
        title: 'Matières réservées',
        body: 'Les décisions critiques, comme les grands changements de prix, les politiques de partage de données et les déplacements de résidence des données, exigent l’approbation de l’action réservée.',
      },
    ],
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = APPENDIX_COPY[locale as keyof typeof APPENDIX_COPY] ?? APPENDIX_COPY['en-CA'];
  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/trust/stewardship-appendix'),
    robots: {
      index: true,
      follow: true,
      nocache: true,
    },
  };
}

const provisions = [
  {
    icon: Vote,
    title: 'Veto on change of control',
    body: 'A reserved special share gives an elected labour council authority to block any sale, merger, or transfer of controlling interest without affirmative labour consent.',
  },
  {
    icon: Shield,
    title: 'Mission lock',
    body: 'Changes to the company mission require reserved-share consent, protecting worker-first purpose against investor or executive drift.',
  },
  {
    icon: Users,
    title: 'Labour-elected council seats',
    body: 'Reserved board seats are held by labour-elected representatives with full voting rights on strategic decisions.',
  },
  {
    icon: FileText,
    title: 'Reserved matters',
    body: 'Critical decisions such as major pricing changes, data-sharing policy, and data residency shifts require reserved-share approval.',
  },
];

export default async function StewardshipAppendixPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = APPENDIX_COPY[locale as keyof typeof APPENDIX_COPY] ?? APPENDIX_COPY['en-CA'];

  return (
    <div className="bg-white min-h-screen">
      {/* Neutral procurement header — no marketing chrome, no hero imagery */}
      <header className="bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-300 mb-4">
            {copy.kicker}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {copy.heading}
          </h1>
          <p className="text-lg text-gray-200 leading-relaxed max-w-2xl">
            {copy.intro}
          </p>
          <p className="text-sm text-gray-300 mt-4 max-w-2xl">
            {copy.note}
          </p>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">{copy.overviewHeading}</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            {copy.overviewBody1}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {copy.overviewBody2}
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">{copy.reservedHeading}</h2>
          <div className="space-y-6">
            {copy.provisions.map((p) => (
              <div
                key={p.title}
                className="flex gap-5 p-6 rounded-2xl border border-gray-100 shadow-sm"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-electric/10 text-electric flex items-center justify-center">
                  <p.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-navy mb-2">{p.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">{copy.faqHeading}</h2>
          <div className="space-y-6 divide-y divide-gray-100">
            {copy.faqs.map(({ q, a }) => (
              <div key={q} className="pt-6 first:pt-0">
                <h3 className="font-semibold text-navy mb-2">{q}</h3>
                <p className="text-gray-700 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-10">
          {copy.closing}
        </p>

        <div className="border-t border-gray-100 pt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link href="../" className="text-sm text-electric font-semibold hover:underline">
            ← {copy.backLink}
          </Link>
          <Link
            href="../../contact"
            className="text-sm text-electric font-semibold hover:underline"
          >
            {copy.contactLink} →
          </Link>
        </div>
      </section>
    </div>
  );
}
