/**
 * Governance & Continuity (customer-organizational).
 *
 * Per realignment directive, "governance" on UnionEyes public surfaces refers
 * to the CUSTOMER's organizational governance operating environment:
 * constitutional operations, resolutions, committees, delegate coordination,
 * and continuity of mandate across leadership transitions.
 *
 * Vendor-side corporate stewardship mechanics live exclusively at
 * /trust/stewardship-appendix and are not surfaced here.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Landmark, ScrollText, Network, Infinity as InfinityIcon } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: buildLocaleAlternates(locale, '/governance'),
  };
}

const PAGE_COPY = {
  'en-CA': {
    metadataTitle: 'Governance & Continuity | UnionEyes',
    metadataDescription:
      'Constitutional operations infrastructure for federated democratic organizations — resolutions, committees, mandates, and continuity of organizational memory across leadership transitions.',
    badge: 'Governance & Continuity',
    heading: 'Constitutional operations for federated organizations.',
    description:
      'UnionEyes turns your constitution, resolutions, and mandates into operational infrastructure — so organizational reasoning survives every leadership transition.',
    introHeading: 'Why organizational governance is operational infrastructure',
    introBody1:
      "For federated democratic organizations, governance is not paperwork or quarterly ritual. It is the protocol that determines what the organization is allowed to decide, who is allowed to decide it, and what happens when an officer's term ends.",
    introBody2:
      'UnionEyes treats that protocol as production infrastructure: durable, versioned, queryable, and continuously auditable.',
    pillarsHeading: 'The four governance pillars',
    pillars: [
      {
        icon: Landmark,
        title: 'Constitutional operations',
        body: 'Constitutions, bylaws, and standing orders are first-class operational artifacts — versioned, queryable, and enforced through procedural workflow rather than tribal knowledge.',
      },
      {
        icon: ScrollText,
        title: 'Resolutions & mandate lifecycle',
        body: 'Every motion, amendment, vote, and ratification flows through an auditable lifecycle. Mandates are tracked from adoption through expiration, with explicit ownership at every stage.',
      },
      {
        icon: Network,
        title: 'Committees & delegate coordination',
        body: 'Standing committees, ad-hoc working groups, and delegate bodies operate inside the same governance fabric — with explicit reporting lines, scoped authority, and traceable deliverables.',
      },
      {
        icon: InfinityIcon,
        title: 'Continuity beyond any individual',
        body: 'Decisions, deliberation context, and organizational reasoning survive every leadership transition. New officers inherit the full body of work, not a blank desk and a pile of binders.',
      },
    ],
    faqHeading: 'Frequently asked',
    faqs: [
      {
        q: 'Is this a document management system?',
        a: 'No. Documents are an artifact of governance, not its substance. UnionEyes models the procedural mechanics — motions, amendments, votes, mandates, committee authority — as first-class state, with documents attached as evidence.',
      },
      {
        q: 'How does this handle federated structures?',
        a: 'Local, regional, and national bodies each carry their own governance state, with explicit delegation, escalation, and ratification pathways. Cross-tier resolutions are coordinated through the same protocol — not over email threads.',
      },
      {
        q: 'What happens when leadership changes?',
        a: 'Incoming officers inherit complete deliberation history, active mandates, pending motions, and committee state. Procedural neutrality is enforced by the platform, not by trust in the outgoing officer.',
      },
      {
        q: 'How is UnionEyes itself governed?',
        a: 'UnionEyes operates under a documented corporate stewardship structure designed to keep operating-environment neutrality and labour alignment durable across ownership transitions. Procurement reviewers can find structural details in the stewardship appendix.',
      },
    ],
    aiNote:
      'Where assistive intelligence surfaces governance patterns or drafts procedural summaries, it operates under human oversight and explainability constraints. Every automated suggestion is reviewable and requires explicit officer action before it affects any record of proceedings.',
    continuityLink: 'Organizational Memory →',
    trustLink: 'Trust & Stewardship →',
  },
  'fr-CA': {
    metadataTitle: 'Gouvernance et continuité | UnionEyes',
    metadataDescription:
      'Infrastructure d’opérations constitutionnelles pour les organisations démocratiques fédérées : résolutions, comités, mandats et continuité de la mémoire organisationnelle pendant les transitions.',
    badge: 'Gouvernance et continuité',
    heading: 'Des opérations constitutionnelles pour les organisations fédérées.',
    description:
      'UnionEyes transforme votre constitution, vos résolutions et vos mandats en infrastructure opérationnelle afin que le raisonnement organisationnel survive à chaque transition.',
    introHeading: 'Pourquoi la gouvernance organisationnelle est une infrastructure opérationnelle',
    introBody1:
      'Pour les organisations démocratiques fédérées, la gouvernance n’est pas de la paperasse ni un rituel trimestriel. C’est le protocole qui détermine ce que l’organisation peut décider, qui peut le décider et ce qui se passe à la fin d’un mandat.',
    introBody2:
      'UnionEyes traite ce protocole comme une infrastructure de production : durable, versionnée, interrogeable et continuellement vérifiable.',
    pillarsHeading: 'Les quatre piliers de gouvernance',
    pillars: [
      {
        icon: Landmark,
        title: 'Opérations constitutionnelles',
        body: 'Constitutions, règlements et règles permanentes deviennent des artefacts opérationnels de premier ordre : versionnés, interrogeables et appliqués par des flux procéduraux plutôt que par la mémoire informelle.',
      },
      {
        icon: ScrollText,
        title: 'Cycle de vie des résolutions et mandats',
        body: 'Chaque motion, amendement, vote et ratification suit un cycle vérifiable. Les mandats sont suivis de l’adoption à l’expiration, avec une responsabilité explicite à chaque étape.',
      },
      {
        icon: Network,
        title: 'Coordination des comités et délégués',
        body: 'Comités permanents, groupes de travail et corps de délégués opèrent dans le même tissu de gouvernance, avec lignes de reddition explicites, autorité délimitée et livrables traçables.',
      },
      {
        icon: InfinityIcon,
        title: 'Continuité au-delà des personnes',
        body: 'Les décisions, le contexte de délibération et le raisonnement organisationnel survivent à chaque transition. Les nouveaux responsables héritent du travail complet, pas d’un bureau vide et de classeurs dispersés.',
      },
    ],
    faqHeading: 'Questions fréquentes',
    faqs: [
      {
        q: 'Est-ce un système de gestion documentaire?',
        a: 'Non. Les documents sont des artefacts de gouvernance, pas la gouvernance elle-même. UnionEyes modélise les mécanismes procéduraux — motions, amendements, votes, mandats et autorité de comité — comme un état de gouvernance, avec les documents comme preuves.',
      },
      {
        q: 'Comment les structures fédérées sont-elles prises en charge?',
        a: 'Les instances locales, régionales et nationales conservent chacune leur propre état de gouvernance, avec délégation, escalade et ratification explicites. Les résolutions entre niveaux sont coordonnées par le même protocole, pas par des fils de courriels.',
      },
      {
        q: 'Que se passe-t-il lors d’un changement de leadership?',
        a: 'Les personnes entrantes héritent de l’historique complet des délibérations, des mandats actifs, des motions en cours et de l’état des comités. La neutralité procédurale est portée par la plateforme, pas par la confiance envers la personne sortante.',
      },
      {
        q: 'Comment UnionEyes lui-même est-il gouverné?',
        a: 'UnionEyes fonctionne selon une structure de gérance documentée qui maintient la neutralité de la plateforme et l’alignement avec le travail pendant les transitions de propriété. Les détails destinés à l’approvisionnement se trouvent dans l’annexe de gérance.',
      },
    ],
    aiNote:
      'Lorsque l’intelligence assistive fait ressortir des tendances de gouvernance ou prépare des résumés procéduraux, elle fonctionne sous surveillance humaine et contraintes d’explicabilité. Chaque suggestion automatisée est révisable et exige une action explicite avant d’affecter un registre de procédures.',
    continuityLink: 'Mémoire organisationnelle →',
    trustLink: 'Confiance et gérance →',
  },
};

export default async function GovernancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.governance}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={copy.heading}
        description={copy.description}
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-4">
            {copy.introHeading}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            {copy.introBody1}
          </p>
          <p className="text-gray-700 leading-relaxed">
            {copy.introBody2}
          </p>
        </div>

        <div className="mb-14">
          <h2 className="text-2xl font-bold text-navy mb-8">{copy.pillarsHeading}</h2>
          <div className="space-y-6">
            {copy.pillars.map((p) => (
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
          {copy.aiNote}
        </p>

        <div className="border-t border-gray-100 pt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="../organizational-continuity"
            className="text-sm text-electric font-semibold hover:underline"
          >
            {copy.continuityLink}
          </Link>
          <Link href="../trust" className="text-sm text-electric font-semibold hover:underline">
            {copy.trustLink}
          </Link>
        </div>
      </section>
    </div>
  );
}
