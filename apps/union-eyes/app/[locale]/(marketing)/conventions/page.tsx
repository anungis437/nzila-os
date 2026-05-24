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
 * Conventions & Federated Governance — Category-defining surface
 *
 * Positions UE as organizational governance operations infrastructure for
 * federated democratic institutions. Procedural continuity, constitutional
 * traceability, governance-safe coordination across locals, regions, nationals.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  ShieldCheck,
  Network,
  ArrowRight,
  Layers,
  GitBranch,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

const CONVENTIONS_COPY = {
  'en-CA': {
    metaTitle: 'Conventions & Federated Governance | UnionEyes',
    metaDescription:
      'Federated democratic institutions operating with procedural continuity, constitutional traceability, and governance-safe coordination across locals, regions, and nationals.',
    badge: 'Platform · Conventions & Federated Governance',
    headingLine1: 'Federated democratic institutions,',
    headingLine2: 'operating with procedural continuity.',
    heroDescription:
      'UnionEyes Conventions & Federated Governance is the continuity layer for organizational governance operations — preserving constitutional intent, delegate continuity, and resolution lifecycle integrity across locals, regions, and nationals.',
    ctaPrimary: 'Explore Governance Coordination',
    ctaSecondary: 'Book Organizational Discovery',
    tabChallenge: 'Challenge',
    tabPathways: 'Pathways',
    tabProof: 'Proof',
    tabAction: 'Action',
    challengeTitle: 'Federated institutions are coordination structures, not events',
    challengeP1:
      'Federated democratic institutions operate across locals, regions, and nationals — each with constitutional autonomy, procedural rules, and historical lineage. Coordination breaks when resolutions, amendments, and delegate context fragment across documents, spreadsheets, and individual memory between cycles.',
    challengeP2:
      'UnionEyes Conventions & Federated Governance is a continuity layer that preserves constitutional intent, delegate continuity, and resolution lifecycle integrity — alongside existing parliamentary practice, not in place of it.',
    journeyTitle: 'From procedural fragmentation to federated resilience',
    pillarsTitle: 'Six governance continuity capabilities. One federated structure.',
    pillarsDescription:
      'Each capability is modular and adoptable independently — or together as a coherent continuity layer for federated democratic institutions.',
    trust1Label: 'Procedural neutrality',
    trust1Sub: 'Alongside existing parliamentary practice',
    trust2Label: 'Human oversight required',
    trust2Sub: 'Chairs and parliamentarians retain authority',
    trust3Label: 'Constitutional traceability',
    trust3Sub: 'Every resolution carries its full lineage',
    actionTitle: 'Ready to strengthen federated governance continuity?',
    actionDescription:
      'See how UnionEyes preserves constitutional intent, delegate continuity, and resolution lifecycle integrity across your locals, regions, and nationals.',
    coexistenceTitle: 'Coexistence with existing systems',
    governanceAiTitle: 'Governance-safe assistive intelligence',
    operationalReassuranceTitle: 'Operational reassurance for constitutional review',
    proofArtifactsTitle: 'Procedural artifacts that make governance reviewable',
    openProofPage: 'Open the proof page',
    fragToCoherenceTitle: 'From procedural fragmentation to constitutional coherence',
    adoptionGovernableTitle: 'How federated adoption remains governable',
    stepLabel: 'Step',
    phaseLabel: 'Phase',
  },
  'fr-CA': {
    metaTitle: 'Congres et gouvernance federée | UnionEyes',
    metaDescription:
      'Des institutions democratiques federées avec continuite procedurale, tracabilite constitutionnelle et coordination compatible avec la gouvernance a travers les sections locales, regions et instances nationales.',
    badge: 'Plateforme · Congres et gouvernance federée',
    headingLine1: 'Des institutions democratiques federées,',
    headingLine2: 'avec une continuite procedurale.',
    heroDescription:
      'UnionEyes Congres et gouvernance federée est une couche de continuite pour les operations de gouvernance organisationnelle, preservant l intention constitutionnelle, la continuite des delegues et l integrite du cycle de vie des resolutions a travers les sections locales, regions et instances nationales.',
    ctaPrimary: 'Explorer la coordination de gouvernance',
    ctaSecondary: 'Planifier une decouverte organisationnelle',
    tabChallenge: 'Defi',
    tabPathways: 'Parcours',
    tabProof: 'Preuve',
    tabAction: 'Action',
    challengeTitle: 'Les institutions federées sont des structures de coordination, pas des evenements',
    challengeP1:
      'Les institutions democratiques federées operent entre sections locales, regions et instances nationales, chacune avec son autonomie constitutionnelle, ses regles procedurales et sa trajectoire historique. La coordination se fragmente lorsque les resolutions, amendements et contextes des delegues sont disperses entre documents, feuilles de calcul et memoire individuelle.',
    challengeP2:
      'UnionEyes Congres et gouvernance federée est une couche de continuite qui preserve l intention constitutionnelle, la continuite des delegues et l integrite du cycle de vie des resolutions, en accompagnement des pratiques parlementaires existantes, et non en remplacement.',
    journeyTitle: 'De la fragmentation procedurale a la resilience federée',
    pillarsTitle: 'Six capacites de continuite de gouvernance. Une structure federée.',
    pillarsDescription:
      'Chaque capacite est modulaire et peut etre adoptee independamment, ou ensemble comme une couche coherente de continuite pour les institutions democratiques federées.',
    trust1Label: 'Neutralite procedurale',
    trust1Sub: 'Aux cotes des pratiques parlementaires existantes',
    trust2Label: 'Supervision humaine requise',
    trust2Sub: 'Les presidents et parlementaires conservent l autorite',
    trust3Label: 'Tracabilite constitutionnelle',
    trust3Sub: 'Chaque resolution conserve sa lignee complete',
    actionTitle: 'Pret a renforcer la continuite de gouvernance federée?',
    actionDescription:
      'Voyez comment UnionEyes preserve l intention constitutionnelle, la continuite des delegues et l integrite du cycle de vie des resolutions dans vos sections locales, regions et instances nationales.',
    coexistenceTitle: 'Coexistence avec les systemes existants',
    governanceAiTitle: 'Intelligence d assistance compatible avec la gouvernance',
    operationalReassuranceTitle: 'Assurance operationnelle pour la revue constitutionnelle',
    proofArtifactsTitle: 'Artefacts proceduraux qui rendent la gouvernance verifiable',
    openProofPage: 'Ouvrir la page de preuve',
    fragToCoherenceTitle: 'De la fragmentation procedurale a la coherence constitutionnelle',
    adoptionGovernableTitle: 'Comment l adoption federée reste gouvernable',
    stepLabel: 'Etape',
    phaseLabel: 'Phase',
  },
} as const;

const CONVENTIONS_CONTENT = {
  'en-CA': {
    pillars: [
      {
        icon: Network,
        title: 'Constitutional & Federated Topology',
        desc: 'Locals, regions, and nationals operate with their own constitutional autonomy, procedural rules, and historical lineage — preserved as a coherent federated structure rather than flattened into a single hierarchy.',
      },
      {
        icon: GitBranch,
        title: 'Resolution Lifecycle Infrastructure',
        desc: 'Resolutions, amendments, and successor language carry their full lineage — origin local, sponsoring committee, prior versions, and procedural disposition — so constitutional intent survives across cycles.',
      },
      {
        icon: Layers,
        title: 'Committee & Procedural Coordination',
        desc: 'Committees, sub-committees, and procedural roles coordinate alongside existing parliamentary practice — without replacing the procedural authority of chairs, parliamentarians, or constitutional officers.',
      },
      {
        icon: Users,
        title: 'Delegate & Representation Continuity',
        desc: 'Delegate context — credentials, mandates, prior interventions, constituency continuity — is preserved across conventions so representation remains coherent rather than starting from zero each cycle.',
      },
      {
        icon: ShieldCheck,
        title: 'Procedural Trust & Auditability',
        desc: 'Every procedural action — recognition, motion, amendment, vote disposition — is traceable to its source record, with human oversight and explainable governance controls throughout.',
      },
      {
        icon: BookOpen,
        title: 'Organizational Memory & Governance Continuity',
        desc: 'Constitutional decisions, precedent rulings, and governance evolution remain accessible across leadership transitions — so organizational memory outlasts any single administration.',
      },
    ],
    journeySteps: [
      { step: '01', label: 'Procedural Fragmentation', desc: 'Resolutions, amendments, and delegate context fragment across documents, spreadsheets, and individual memory between cycles.' },
      { step: '02', label: 'Resolution Traceability', desc: 'Every resolution and amendment carries its lineage — origin, sponsor, prior versions, and disposition — in a reviewable structure.' },
      { step: '03', label: 'Delegate Continuity', desc: 'Credentials, mandates, and constituency context persist across conventions so representation remains coherent.' },
      { step: '04', label: 'Committee Coordination', desc: 'Committees coordinate procedural work alongside chairs and parliamentarians, without replacing constitutional authority.' },
      { step: '05', label: 'Constitutional Coherence', desc: 'Constitutional intent and precedent rulings remain reviewable across cycles, supporting governance-safe decision making.' },
      { step: '06', label: 'Federated Resilience', desc: 'The federation operates as a coherent institution — locals, regions, and nationals aligned on procedural continuity and shared organizational memory.' },
    ],
    coexistenceDescription:
      'UnionEyes operates as overlay infrastructure — a continuity layer that runs alongside existing constitutional documents, resolution archives, delegate registration systems, and parliamentary practice. Non-disruptive implementation is the default operating posture.',
    coexistenceItems: [
      { title: 'Overlay infrastructure', desc: 'A continuity layer that augments existing constitutional and procedural systems rather than replacing them.' },
      { title: 'Alongside existing systems', desc: 'Resolution archives, delegate registries, and parliamentary tools continue to operate — UnionEyes adds traceability and continuity.' },
      { title: 'Non-disruptive implementation', desc: 'Phased adoption sequencing with explicit governance checkpoints — operational calm preserved throughout.' },
      { title: 'Coexistence with parliamentary practice', desc: 'Procedural authority remains with chairs, parliamentarians, and constitutional officers; UnionEyes provides supporting continuity.' },
      { title: 'Canadian-hosted', desc: 'Organizational data residency aligned with Canadian governance and procurement expectations.' },
      { title: 'Bilingual-first', desc: 'English and French as first-class procedural surfaces, reflecting how federated Canadian institutions actually operate.' },
    ],
    governanceAiDescription:
      'Where intelligence supports procedural work, it operates as assistive intelligence under full human oversight. Every suggestion is reviewable, explainable, and traceable to its source evidence — never autonomous, never substituting for procedural authority.',
    governanceAiItems: [
      { title: 'Human oversight', desc: 'Chairs, parliamentarians, and committee officers retain procedural authority over every decision.' },
      { title: 'Explainability', desc: 'Every assistive suggestion is traceable to its source record — constitutional clause, prior resolution, or procedural precedent.' },
      { title: 'Reviewability', desc: 'Procedural artifacts are reviewable end-to-end so disposition can be audited by delegates and constitutional officers.' },
      { title: 'Assistive, not autonomous', desc: 'Intelligence supports procedural continuity; it does not direct, dispose, or replace deliberative authority.' },
    ],
    operationalItems: [
      {
        title: 'Adoption Calm',
        desc: 'Phased rollout pacing with explicit governance checkpoints — adoption proceeds at the pace constitutional review permits.',
      },
      {
        title: 'Procedural Stability',
        desc: 'Constitutional officers and parliamentarians retain procedural authority; UnionEyes supports rather than substitutes.',
      },
      {
        title: 'Federated Resilience',
        desc: 'Constitutional intent and delegate continuity persist across cycles, leadership transitions, and federated coordination.',
      },
    ],
    proofIntro:
      'Evidence is presented as procedural artifacts — resolution lineage records, delegate continuity registries, amendment trails, and committee disposition logs — not marketing claims. Constitutional officers can inspect each surface directly.',
    proofCards: [
      { purpose: 'Resolution lifecycle', title: 'Amendment Lineage Records', note: 'Every amendment carries origin local, sponsoring committee, prior versions, and procedural disposition in a reviewable structure.' },
      { purpose: 'Delegate continuity', title: 'Credential & Mandate Registry', note: 'Delegate credentials, constituency mandates, and prior interventions persist across cycles for representational coherence.' },
      { purpose: 'Committee coordination', title: 'Committee Disposition Logs', note: 'Committee work — referrals, recommendations, and procedural dispositions — is traceable across the convention lifecycle.' },
      { purpose: 'Constitutional memory', title: 'Precedent Ruling Archive', note: 'Chair rulings and constitutional interpretations persist as organizational memory available to future deliberations.' },
      { purpose: 'Procedural trust', title: 'Recognition & Vote Trails', note: 'Recognition order, motion sequencing, and vote dispositions are traceable to source records for auditability.' },
      { purpose: 'Federated topology', title: 'Federation Structure Map', note: 'Locals, regions, and nationals are represented as a coherent constitutional topology rather than flattened lists.' },
    ],
    progressionStages: [
      'Resolutions and amendments fragmented across documents',
      'Delegate context reset each cycle',
      'Committee work disconnected from prior cycles',
      'Resolution lineage preserved across cycles',
      'Delegate continuity persists across conventions',
      'Committee work coordinates with prior precedent',
    ],
    adoptionPhases: [
      'Constitutional review and scoping with federation officers',
      'Pilot deployment with one local or region',
      'Resolution lifecycle and delegate continuity onboarding',
      'Committee coordination and procedural traceability',
      'Federated rollout across locals, regions, and nationals',
      'Continuity-centered operating posture established',
    ],
  },
  'fr-CA': {
    pillars: [
      {
        icon: Network,
        title: 'Topologie constitutionnelle et federée',
        desc: 'Les sections locales, regions et instances nationales operent avec leur autonomie constitutionnelle, leurs regles procedurales et leur trajectoire historique, preservees dans une structure federée coherente.',
      },
      {
        icon: GitBranch,
        title: 'Infrastructure du cycle de vie des resolutions',
        desc: 'Les resolutions, amendements et formulations successives conservent leur lignee complete, de l origine locale a la disposition procedurale.',
      },
      {
        icon: Layers,
        title: 'Coordination des comites et des procedures',
        desc: 'Les comites et sous-comites se coordonnent avec les pratiques parlementaires existantes sans remplacer l autorite procedurale.',
      },
      {
        icon: Users,
        title: 'Continuite des delegues et de la representation',
        desc: 'Le contexte des delegues, mandats et interventions anterieures est preserve d un congres a l autre pour maintenir la coherence de representation.',
      },
      {
        icon: ShieldCheck,
        title: 'Confiance procedurale et auditabilite',
        desc: 'Chaque action procedurale est tracable a sa source avec supervision humaine et controles de gouvernance explicables.',
      },
      {
        icon: BookOpen,
        title: 'Memoire organisationnelle et continuite de gouvernance',
        desc: 'Les decisions constitutionnelles, precedents et evolutions de gouvernance restent accessibles a travers les transitions de leadership.',
      },
    ],
    journeySteps: [
      { step: '01', label: 'Fragmentation procedurale', desc: 'Les resolutions, amendements et contextes des delegues se fragmentent entre documents, feuilles de calcul et memoire individuelle.' },
      { step: '02', label: 'Tracabilite des resolutions', desc: 'Chaque resolution et amendement conserve sa lignee : origine, parrainage, versions precedentes et disposition.' },
      { step: '03', label: 'Continuite des delegues', desc: 'Les accreditations, mandats et contextes de circonscription persistent entre les congres.' },
      { step: '04', label: 'Coordination des comites', desc: 'Les comites coordonnent le travail procedural avec les presidents et parlementaires, sans remplacer l autorite constitutionnelle.' },
      { step: '05', label: 'Coherence constitutionnelle', desc: 'L intention constitutionnelle et les precedents restent verifiables a travers les cycles.' },
      { step: '06', label: 'Resilience federée', desc: 'La federation opere comme une institution coherente, alignee sur la continuite procedurale et la memoire organisationnelle partagee.' },
    ],
    coexistenceDescription:
      'UnionEyes opere comme une infrastructure en surcouche : une couche de continuite qui fonctionne aux cotes des documents constitutionnels, archives de resolutions, systemes d inscription des delegues et pratiques parlementaires existantes.',
    coexistenceItems: [
      { title: 'Infrastructure en surcouche', desc: 'Une couche de continuite qui renforce les systemes constitutionnels et proceduraux existants au lieu de les remplacer.' },
      { title: 'Aux cotes des systemes existants', desc: 'Les archives de resolutions, registres des delegues et outils parlementaires continuent de fonctionner avec plus de tracabilite.' },
      { title: 'Mise en oeuvre non disruptive', desc: 'Adoption progressive avec points de controle explicites pour preserver le calme operationnel.' },
      { title: 'Coexistence parlementaire', desc: 'L autorite procedurale reste aux presidents, parlementaires et officiers constitutionnels.' },
      { title: 'Hebergement canadien', desc: 'Residence des donnees alignee aux attentes canadiennes de gouvernance et d approvisionnement.' },
      { title: 'Bilingue par conception', desc: 'Le francais et l anglais sont traites comme surfaces procedurales de premier niveau.' },
    ],
    governanceAiDescription:
      'Lorsque l intelligence assiste le travail procedural, elle demeure assistive sous supervision humaine complete. Chaque suggestion est verifiable, explicable et tracable a sa preuve source.',
    governanceAiItems: [
      { title: 'Supervision humaine', desc: 'Les presidents, parlementaires et officiers de comite conservent l autorite procedurale sur chaque decision.' },
      { title: 'Explicabilite', desc: 'Chaque suggestion assistive est reliee a sa source : clause constitutionnelle, resolution precedente ou precedent procedural.' },
      { title: 'Verifiabilite', desc: 'Les artefacts proceduraux sont verifiables de bout en bout pour audit par les delegues et officiers constitutionnels.' },
      { title: 'Assistive, non autonome', desc: 'L intelligence soutient la continuite procedurale sans diriger, disposer ou remplacer l autorite deliberative.' },
    ],
    operationalItems: [
      {
        title: 'Adoption calme',
        desc: 'Un rythme de deploiement progressif avec points de controle explicites, au rythme permis par la revue constitutionnelle.',
      },
      {
        title: 'Stabilite procedurale',
        desc: 'Les officiers constitutionnels et parlementaires conservent l autorite procedurale; UnionEyes soutient sans se substituer.',
      },
      {
        title: 'Resilience federée',
        desc: 'L intention constitutionnelle et la continuite des delegues persistent a travers les cycles et transitions de leadership.',
      },
    ],
    proofIntro:
      'Les preuves sont presentees sous forme d artefacts proceduraux : lignee des resolutions, registres de continuite des delegues, traces d amendements et journaux de dispositions des comites.',
    proofCards: [
      { purpose: 'Cycle de vie des resolutions', title: 'Registres de lignee des amendements', note: 'Chaque amendement conserve son origine locale, son parrainage, ses versions precedentes et sa disposition procedurale.' },
      { purpose: 'Continuite des delegues', title: 'Registre des accreditations et mandats', note: 'Les accreditations, mandats de circonscription et interventions anterieures persistent entre les cycles.' },
      { purpose: 'Coordination des comites', title: 'Journaux de disposition des comites', note: 'Le travail des comites est tracable sur tout le cycle des congres.' },
      { purpose: 'Memoire constitutionnelle', title: 'Archive des decisions de precedent', note: 'Les decisions de la presidence et interpretations constitutionnelles restent disponibles pour les deliberations futures.' },
      { purpose: 'Confiance procedurale', title: 'Traces de reconnaissance et de vote', note: 'L ordre de reconnaissance, le sequence des motions et les dispositions de vote sont tracables a la source.' },
      { purpose: 'Topologie federée', title: 'Carte de structure federée', note: 'Les sections locales, regions et instances nationales sont representees comme topologie constitutionnelle coherente.' },
    ],
    progressionStages: [
      'Resolutions et amendements fragmentes entre documents',
      'Contexte des delegues reinitialise a chaque cycle',
      'Travail des comites deconnecte des cycles precedents',
      'Lignee des resolutions preservee entre les cycles',
      'Continuite des delegues maintenue entre les congres',
      'Coordination des comites alignee aux precedents',
    ],
    adoptionPhases: [
      'Revue constitutionnelle et cadrage avec les responsables federatifs',
      'Deploiement pilote avec une section locale ou une region',
      'Onboarding du cycle de vie des resolutions et de la continuite des delegues',
      'Coordination des comites et tracabilite procedurale',
      'Deploiement federé entre sections locales, regions et national',
      'Posture operationnelle centree sur la continuite etablie',
    ],
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = CONVENTIONS_COPY[locale as keyof typeof CONVENTIONS_COPY] ?? CONVENTIONS_COPY['en-CA'];
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: buildLocaleAlternates(locale, '/conventions'),
  };
}

export default async function ConventionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = CONVENTIONS_COPY[locale as keyof typeof CONVENTIONS_COPY] ?? CONVENTIONS_COPY['en-CA'];
  const content = CONVENTIONS_CONTENT[locale as keyof typeof CONVENTIONS_CONTENT] ?? CONVENTIONS_CONTENT['en-CA'];

  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.conventions}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            {copy.badge}
          </span>
        }
        heading={<>{copy.headingLine1}<br />{copy.headingLine2}</>}
        description={copy.heroDescription}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/institutional-continuity-risk`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
            >
              {copy.ctaPrimary}
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              {copy.ctaSecondary}
            </Link>
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="challenge" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="challenge" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabChallenge}
              </TabsTrigger>
              <TabsTrigger value="pathways" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabPathways}
              </TabsTrigger>
              <TabsTrigger value="proof" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabProof}
              </TabsTrigger>
              <TabsTrigger value="action" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabAction}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="challenge" className="space-y-12">

      {/* ── The Core Problem ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-navy mb-4">
              {copy.challengeTitle}
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              {copy.challengeP1}
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              {copy.challengeP2}
            </p>
          </div>
        </div>
      </section>

      {/* ── Continuity Journey ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-navy mb-2">
              {copy.journeyTitle}
            </h2>
          </div>
          <div className="space-y-0">
            {content.journeySteps.map((step, i) => (
              <div
                key={step.step}
                className={`flex gap-6 py-6 ${i < content.journeySteps.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="shrink-0 w-12">
                  <span className="text-xs font-bold text-electric tracking-wider">{step.step}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy mb-1">{step.label}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
                {i < content.journeySteps.length - 1 && (
                  <div className="shrink-0 self-end pb-1">
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy mb-3">
              {copy.pillarsTitle}
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {copy.pillarsDescription}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.pillars.map((p) => (
              <div key={p.title} className="p-6 rounded-2xl bg-white border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <p.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-base font-bold text-navy mb-2">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Signal ── */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { label: copy.trust1Label, sub: copy.trust1Sub },
              { label: copy.trust2Label, sub: copy.trust2Sub },
              { label: copy.trust3Label, sub: copy.trust3Sub },
            ].map((item) => (
              <div key={item.label} className="p-6 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-sm font-bold text-navy mb-1">{item.label}</div>
                <div className="text-xs text-gray-500">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
          </TabsContent>

          <TabsContent value="pathways" className="space-y-12">

      {/* ── Coexistence ── */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3">{copy.coexistenceTitle}</h2>
          <p className="text-gray-600 max-w-3xl mb-8">
            {content.coexistenceDescription}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.coexistenceItems.map((item) => (
              <article key={item.title} className="p-5 rounded-xl bg-white border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Governance-safe AI ── */}
      <section className="py-20 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3">{copy.governanceAiTitle}</h2>
          <p className="text-gray-600 max-w-3xl mb-8">
            {content.governanceAiDescription}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {content.governanceAiItems.map((item) => (
              <article key={item.title} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Operational reassurance ── */}
      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-8">{copy.operationalReassuranceTitle}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {content.operationalItems.map((item) => (
              <article key={item.title} className="p-5 rounded-xl bg-white border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

          </TabsContent>

          <TabsContent value="proof" className="space-y-12">

      <section className="py-20 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-navy mb-3">{copy.proofArtifactsTitle}</h2>
              <p className="text-gray-600 max-w-3xl">
                {content.proofIntro}
              </p>
            </div>
            <Link href="/proof" className="inline-flex items-center gap-2 text-sm font-semibold text-electric hover:text-blue-700">
              {copy.openProofPage} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {content.proofCards.map((item) => (
              <article key={item.title} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{item.purpose}</p>
                <h3 className="text-base font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-navy mb-3">{copy.fragToCoherenceTitle}</h2>
              <div className="space-y-2">
                {content.progressionStages.map((stage, index) => (
                  <article key={stage} className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy">{stage}</span>
                    <span className="text-xs text-gray-400">{copy.stepLabel} {index + 1}</span>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-navy mb-3">{copy.adoptionGovernableTitle}</h2>
              <div className="space-y-2">
                {content.adoptionPhases.map((stage, index) => (
                  <article key={stage} className="p-3 rounded-lg border border-gray-100 bg-white">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{copy.phaseLabel} {index + 1}</p>
                    <p className="text-sm font-semibold text-navy">{stage}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

          </TabsContent>

          <TabsContent value="action" className="space-y-8">

      {/* ── CTA ── */}
      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {copy.actionTitle}
          </h2>
          <p className="text-white/70 mb-8">
            {copy.actionDescription}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/institutional-continuity-risk`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              {copy.ctaPrimary}
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              {copy.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
