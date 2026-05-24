/**
 * ARTIFACT TYPE: Marketing Landing Page (standalone)
 * DOCTRINE_VERSION: 1.1.0
 * ROUTE: /[locale]/organizational-continuity-risk
 *
 * OCI Category Awakening Page — distinct from the /organizational-continuity
 * product substrate page. This page defines the category of Organizational
 * Continuity Infrastructure (OCI) as an institutional concern and introduces
 * the ICRA self-assessment as the entry point.
 *
 * Layout note:
 * Intentionally placed OUTSIDE the (marketing) route group so it does not
 * inherit the full site navigation or footer. A minimal branded top bar is
 * provided by the sibling layout.tsx. The page must therefore stand on its
 * own visually — hero imagery anchors it.
 *
 * Typography note:
 * Tailwind's `font-sans` resolves to var(--font-poppins) via
 * apps/union-eyes/tailwind.config.ts. All headings use Poppins weights
 * (300 / 500 / 600 / 700) rather than a serif fallback.
 *
 * Tone:
 * - Calm, credible, unhurried
 * - Institutional, not startup
 * - Editorial, not sales
 * - "Quietly devastating" observations where appropriate
 * - No AI language anywhere above the fold or in the hero
 * - No scarcity, urgency, or FOMO
 *
 * Bilingual: EN-CA (default) / FR-CA (locale=fr-CA)
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { COPY } from '@/lib/icra/copy';
import HumanScenesCarousel from './_components/HumanScenesCarousel';

// Institutional imagery — classical, calm, never stock-cliché.
// All Unsplash; CSP allows img-src https: + Unsplash is whitelisted in next.config.
const HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1568667256549-094345857637?w=1920&q=80&auto=format';
const MEMORY_HOLDERS_IMAGE_URL =
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1400&q=80&auto=format'; // hands writing in a ledger
const INTERSTITIAL_IMAGE_URL =
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=2400&q=80&auto=format'; // empty boardroom
const MOTIF_IMAGE_URL =
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1920&q=80&auto=format'; // archive shelves
const ASSESSMENT_IMAGE_URL =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1400&q=80&auto=format'; // people in conversation

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFr = locale === 'fr-CA';
  return {
    title: isFr
      ? 'Risque de continuité institutionnelle | UnionEyes'
      : 'Institutional Continuity Risk | UnionEyes',
    description: isFr
      ? "La plupart des organisations portent plus de risques de continuité qu'elles ne le réalisent. Découvrez les signaux silencieux qui indiquent une fragilité institutionnelle."
      : 'Most institutions are carrying more continuity risk than they realize. Discover the quiet signals that indicate institutional fragility — and what to do about them.',
    alternates: buildLocaleAlternates(locale, '/organizational-continuity-risk'),
  };
}

export default async function OrganizationalContinuityRiskPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isFr = locale === 'fr-CA';

  const humanScenes = isFr
    ? [
        {
          id: 'scene_1',
          title: 'La réunion après la réunion',
          body: "Après chaque rencontre de gouvernance, il y a quelqu'un qui reste pour expliquer le contexte que le procès-verbal n'a pas capturé. Qui explique pourquoi la décision de 2019 a pris la forme qu'elle a prise. Ce travail n'est jamais consigné.",
        },
        {
          id: 'scene_2',
          title: "La personne que tout le monde appelle",
          body: "Dans presque chaque organisation, il y a une personne vers qui les collègues se tournent pour comprendre comment les choses fonctionnent vraiment. Elle sait où se trouvent les fichiers, qui a de l'autorité sur quoi, et pourquoi la procédure n'est plus tout à fait conforme à la politique.",
        },
        {
          id: 'scene_3',
          title: 'Le nouveau dirigeant qui reconstruit à partir de zéro',
          body: "Chaque nouveau leader ou directeur général reprend les rênes avec enthousiasme, puis passe six à dix-huit mois à reconstituer le contexte opérationnel que son prédécesseur avait acquis sur plusieurs années. La plupart ne réalisent jamais combien il leur manque.",
        },
        {
          id: 'scene_4',
          title: 'La transition technologique qui efface tout',
          body: "Lors du passage au nouveau système, l'organisation a migré les données mais pas l'intelligence. Les interprétations des politiques, les conventions informelles, les rationnels des décisions passées — tout cela a été laissé dans l'ancien système. Ou dans la tête des personnes qui sont parties.",
        },
        {
          id: 'scene_5',
          title: 'Le conseil qui hérite sans contexte',
          body: "Un nouveau membre du conseil d'administration prend ses fonctions. Elle reçoit les politiques, les procès-verbaux et les organigrammes. Ce qu'elle ne reçoit pas, c'est le contexte qui explique pourquoi les politiques existent, quels débats ont précédé les décisions, et quels engagements informels lient encore l'organisation.",
        },
      ]
    : [
        {
          id: 'scene_1',
          title: 'The meeting after the meeting',
          body: "After every governance session, there is someone who stays to explain the context the minutes didn't capture. Who explains why the 2019 decision took the shape it did. That work is never documented.",
        },
        {
          id: 'scene_2',
          title: 'The person everyone calls',
          body: "In almost every organization, there is a person colleagues turn to when they need to understand how things actually work. She knows where the files are, who holds authority over what, and why the procedure no longer quite matches the policy.",
        },
        {
          id: 'scene_3',
          title: 'The new leader who rebuilds from scratch',
          body: 'Every new executive or operations lead takes the role with energy, then spends six to eighteen months reconstituting the operational context their predecessor accumulated over years. Most never realize how much they are missing.',
        },
        {
          id: 'scene_4',
          title: 'The technology transition that erased everything',
          body: 'When the organization moved to the new system, it migrated the data but not the intelligence. Policy interpretations, informal conventions, the rationale behind past decisions — left in the old system. Or in the heads of people who left.',
        },
        {
          id: 'scene_5',
          title: 'The board that inherits without context',
          body: "A new board member joins. She receives the policies, minutes, and org charts. What she does not receive is the context that explains why the policies exist, what debates preceded the decisions, and which informal commitments still bind the organization.",
        },
      ];

  const quietRiskCards = isFr
    ? [
        { label: 'Érosion', body: 'La connaissance institutionnelle disparaît progressivement, sans événement unique et perceptible.' },
        { label: 'Dérive', body: "La gouvernance pratique s'écarte des politiques documentées, souvent sans que personne ne le remarque." },
        { label: 'Oubli', body: "L'organisation résout des problèmes qu'elle a déjà résolus, parce que la solution antérieure n'a pas été préservée." },
        { label: 'Fardeau', body: "La continuité de l'institution repose sur un nombre restreint de personnes — qui la portent silencieusement." },
        { label: 'Fragilité', body: "L'organisation semble résiliente jusqu'à ce qu'une ou deux personnes clés partent en même temps." },
        { label: 'Travail invisible', body: "La traduction du contexte institutionnel, le maintien des relations et la préservation de la mémoire sont absorbés dans des rôles individuels et ne figurent pas dans les descriptions de poste." },
      ]
    : [
        { label: 'Erosion', body: 'Institutional knowledge disappears gradually, without any single noticeable event.' },
        { label: 'Drift', body: 'Practiced governance diverges from documented policy, often without anyone noticing.' },
        { label: 'Forgetting', body: 'The organization solves problems it has already solved, because the earlier solution was not preserved.' },
        { label: 'Burden', body: 'The institution\'s continuity rests on a small number of people — who carry it quietly.' },
        { label: 'Fragility', body: 'The organization appears resilient until one or two key people leave at the same time.' },
        { label: 'Invisible labour', body: 'Translating institutional context, maintaining relationships, and preserving memory are absorbed into individual roles and never appear in job descriptions.' },
      ];

  const techWithSoulLines = isFr
    ? [
        'Les évaluations sont déterministes — aucun modèle opaque, seulement des pondérations de questions publiées.',
        "Les profils de maturité sont explicables et réexaminables, pas des sorties algorithmiques.",
        "Chaque score reflète ce que l'organisation a renseigné — pas ce qu'un système a inféré.",
        "L'outil aide à voir ce qui est déjà là. Il ne crée pas de nouvelles dépendances.",
        "La méthodologie est documentée et peut être contestée, réfutée ou améliorée.",
      ]
    : [
        'Assessments are deterministic — no opaque model, only published question weights.',
        'Maturity profiles are explainable and reviewable, not algorithmic outputs.',
        'Every score reflects what the organization reported — not what a system inferred.',
        'The tool helps surface what is already present. It does not create new dependencies.',
        'The methodology is documented and can be contested, disputed, or improved.',
      ];

  const tiers = [
    {
      id: 'continuity_reflection',
      name: isFr ? 'Réflexion sur la continuité' : 'Continuity Reflection',
      price: isFr ? 'Gratuit' : 'Free',
      description: isFr
        ? 'Profil complet de maturité en continuité institutionnelle avec signaux et indice de fardeau.'
        : 'Full institutional continuity maturity profile with signals and burden index.',
      includes: isFr
        ? ['Bande OCI et indice de continuité', 'Observations sur la continuité', 'Signaux institutionnels', 'Indice de fardeau de continuité', '1 recommandation']
        : ['OCI band and continuity score', 'Continuity observations', 'Institutional signals', 'Continuity burden index', '1 recommendation'],
      cta: isFr ? 'Commencer l\'évaluation' : 'Start the assessment',
      ctaHref: '/continuity-assessment/start',
      featured: false,
    },
    {
      id: 'executive_continuity_brief',
      name: isFr ? 'Note de continuité executive' : 'Executive Continuity Brief',
      price: isFr ? '1 200 $' : '$1,200',
      description: isFr
        ? 'Analyse institutionnelle approfondie avec analyse de la dette de continuité, des dépendances et des risques de modernisation.'
        : 'In-depth institutional analysis with governance entropy, continuity debt, dependency review, and modernization risk.',
      includes: isFr
        ? ['Tout dans Réflexion', 'Analyse de l\'entropie de gouvernance', 'Analyse de la dette de continuité', 'Examen des dépendances institutionnelles', 'Couche de risque de modernisation', 'Recommandations complètes']
        : ['Everything in Reflection', 'Governance entropy analysis', 'Continuity debt analysis', 'Institutional dependency review', 'Modernization risk layer', 'Full recommendations'],
      cta: isFr ? 'Commencer l\'évaluation' : 'Start the assessment',
      ctaHref: '/continuity-assessment/start?intendedTier=executive_continuity_brief',
      featured: true,
    },
    {
      id: 'institutional_continuity_diagnostic',
      name: isFr ? 'Diagnostic institutionnel de continuité' : 'Institutional Continuity Diagnostic',
      price: isFr ? '6 500 $' : '$6,500',
      description: isFr
        ? 'Engagement complet avec revue facilitée, atelier et cartographie de la mémoire institutionnelle.'
        : 'Full engagement with facilitated review, workshop, and institutional memory lineage mapping.',
      includes: isFr
        ? ['Tout dans la Note executive', 'Revue diagnostique facilitée', 'Atelier de continuité institutionnelle', 'Cartographie de la lignée mémorielle', 'Note de synthèse exécutive']
        : ['Everything in the Brief', 'Facilitated diagnostic review', 'Institutional continuity workshop', 'Memory lineage mapping', 'Executive briefing note'],
      cta: isFr ? 'Demander ce diagnostic' : 'Request this diagnostic',
      ctaHref: '/contact?topic=institutional-continuity-diagnostic',
      featured: false,
    },
  ];

  const memoryHolderRoles = isFr
    ? [
        { role: 'Porteur de continuité', desc: 'La personne dont la présence maintient la cohérence opérationnelle — souvent sans reconnaissance formelle.' },
        { role: 'Gardien du contexte', desc: "La personne qui comprend le contexte derrière les décisions, pas seulement les résultats." },
        { role: 'Historien de gouvernance', desc: "La personne qui peut expliquer pourquoi les politiques existent et quels précédents les ont façonnées." },
        { role: "Interprète opérationnel", desc: "La personne qui traduit entre la politique officielle et la pratique réelle — et sait quand et pourquoi elles divergent." },
        { role: 'Mémoire organisationnelle', desc: "La personne dont la présence dans la pièce change la qualité des décisions qui y sont prises." },
      ]
    : [
        { role: 'Continuity Carrier', desc: 'The person whose presence maintains operational coherence — often without formal recognition.' },
        { role: 'Context Keeper', desc: 'The person who understands the context behind decisions, not only the outcomes.' },
        { role: 'Governance Historian', desc: 'The person who can explain why policies exist and what precedents shaped them.' },
        { role: 'Operational Interpreter', desc: 'The person who translates between official policy and actual practice — and knows when and why they diverge.' },
        { role: 'Organizational Memory', desc: 'The person whose presence in the room changes the quality of the decisions made there.' },
      ];

  const personas = isFr
    ? [
        { role: 'Directeur général', signal: "Vous approchez une transition de leadership et vous réalisez que la mémoire institutionnelle de l'organisation n'est pas documentée." },
        { role: 'Direction syndicale', signal: "La cohérence des décisions de représentation à travers les cycles électoraux vous préoccupe." },
        { role: 'Direction des opérations de santé', signal: "La continuité de l'intégration et la fragmentation des systèmes affectent la qualité des soins." },
        { role: 'DPI / DSO', signal: "Vous dirigez une modernisation technologique et réalisez que le contexte institutionnel ne peut pas être migré comme les données." },
        { role: 'Gouvernance / Conseil', signal: "Vous souhaitez comprendre comment la résilience institutionnelle est exercée dans la pratique opérationnelle." },
        { role: 'Organisation fédérée', signal: "La cohérence de la continuité entre vos unités ou sections affiliées varie significativement." },
      ]
    : [
        { role: 'Executive Director', signal: 'You are approaching a leadership transition and realize the organization\'s institutional memory is not documented.' },
        { role: 'Union Leadership', signal: 'You are concerned about representation decision consistency across electoral cycles.' },
        { role: 'Healthcare Ops Leadership', signal: 'Onboarding continuity and system fragmentation are affecting care quality.' },
        { role: 'CIO / COO', signal: 'You are leading a technology modernization and realizing that institutional context cannot be migrated like data.' },
        { role: 'Governance / Board', signal: 'You want to understand how institutional resilience is actually exercised in operational practice.' },
        { role: 'Federated Organization', signal: 'Continuity coherence across your affiliated units or locals varies significantly.' },
      ];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Hero (full-bleed institutional image, light text) ── */}
      <section
        className="relative isolate flex min-h-[640px] items-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(15,12,9,0.78) 0%, rgba(15,12,9,0.62) 50%, rgba(15,12,9,0.85) 100%), url(${HERO_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Soft top vignette helps the branded top bar in layout.tsx float legibly */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent"
        />

        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-36 pb-28 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-300">
            {isFr ? 'Évaluation de la continuité institutionnelle' : 'OCI Continuity Risk Assessment'}
          </p>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-light leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {isFr
              ? "La plupart des institutions portent plus de risques de continuité qu'elles ne le réalisent."
              : COPY.hero.headline}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg font-light leading-relaxed text-stone-200">
            {isFr
              ? "Chaque organisation a des personnes qui maintiennent silencieusement la continuité longtemps après que les systèmes autour d'elles ont cessé de le faire."
              : COPY.hero.humanContinuityLine}
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/continuity-assessment/start"
              className="rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-stone-900 shadow-sm transition-colors hover:bg-stone-100"
            >
              {isFr ? 'Évaluer le risque de continuité institutionnelle' : COPY.hero.primaryCta}
            </Link>
            <Link
              href="#tiers"
              className="rounded-lg border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              {isFr ? 'Voir les options de rapport' : 'See report options'}
            </Link>
          </div>
          <p className="mt-6 text-xs font-light text-stone-300/90">
            {isFr
              ? 'Gratuit. Pseudonyme. Aucune connexion requise.'
              : 'Free. Pseudonymous. No login required.'}
          </p>
        </div>
      </section>

      {/* ── Human Scenes (interactive carousel) ── */}
      <section className="bg-stone-50 py-20">
        <div className="mx-auto max-w-5xl space-y-12 px-6">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
              {isFr ? 'Ce que vous reconnaîtrez peut-être' : 'What you may recognize'}
            </h2>
            <p className="mx-auto max-w-xl text-sm font-light text-stone-500">
              {isFr
                ? "Ces situations ne sont pas rares. Elles sont la façon normale dont la continuité s'érode — silencieusement, dans la pratique ordinaire."
                : "These situations are not unusual. They are the normal way continuity erodes — quietly, in ordinary practice."}
            </p>
          </div>
          <HumanScenesCarousel
            scenes={humanScenes}
            labels={{
              previous: isFr ? 'Scène précédente' : 'Previous scene',
              next: isFr ? 'Scène suivante' : 'Next scene',
              sceneOf: isFr ? 'Scène {current} sur {total}' : 'Scene {current} of {total}',
            }}
          />
        </div>
      </section>

      {/* ── Interstitial imagery band ── */}
      <section
        aria-hidden="true"
        className="relative h-64 sm:h-80"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(15,12,9,0.35) 0%, rgba(15,12,9,0.55) 100%), url(${INTERSTITIAL_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="max-w-2xl text-center text-xl font-light italic leading-relaxed text-stone-100 sm:text-2xl">
            &ldquo;{isFr
              ? 'Les institutions oublient lentement. Puis tout à la fois.'
              : 'Institutions forget slowly. Then all at once.'}&rdquo;
          </p>
        </div>
      </section>

      {/* ── Quiet Risk Signals ── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl space-y-12 px-6">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
              {isFr ? 'Les signaux de risque silencieux' : 'The quiet risk signals'}
            </h2>
            <p className="mx-auto max-w-2xl text-sm font-light text-stone-500">
              {isFr
                ? "Le risque de continuité institutionnelle ne se manifeste pas comme une crise. Il se manifeste comme des frictions quotidiennes, légèrement trop élevées, légèrement trop fréquentes."
                : "Institutional continuity risk does not present as a crisis. It presents as daily friction — slightly too high, slightly too frequent."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quietRiskCards.map((card) => (
              <div
                key={card.label}
                className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-5 transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white hover:shadow-sm"
              >
                <p className="font-semibold tracking-tight text-stone-900">{card.label}</p>
                <p className="text-sm font-light leading-relaxed text-stone-600">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Institutional Memory Holders (side-by-side imagery + roles) ── */}
      <section className="bg-stone-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <div
                className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-stone-200 ring-1 ring-stone-200"
                style={{
                  backgroundImage: `url(${MEMORY_HOLDERS_IMAGE_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                role="img"
                aria-label={
                  isFr
                    ? 'Mains écrivant dans un registre institutionnel'
                    : 'Hands writing in an institutional ledger'
                }
              />
              <p className="mt-4 text-xs font-light italic text-stone-500">
                {isFr
                  ? 'La continuité institutionnelle est portée par des personnes, pas par des systèmes.'
                  : 'Institutional continuity is carried by people, not by systems.'}
              </p>
            </div>

            <div className="space-y-8 lg:col-span-7">
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
                  {isFr ? 'Les détenteurs de mémoire institutionnelle' : 'Institutional Memory Holders'}
                </h2>
                <p className="font-light leading-relaxed text-stone-600">
                  {isFr
                    ? "Dans chaque organisation, il y a des personnes dont la présence maintient la cohérence institutionnelle — qui ne se définissent pas comme des détenteurs de mémoire, et dont l'organisation ne reconnaît pas toujours le rôle. Ces personnes constituent la première ligne de risque de continuité institutionnelle."
                    : "In every organization, there are people whose presence maintains institutional coherence — who do not think of themselves as memory holders, and whose role the organization does not always recognize. These people are the first line of institutional continuity risk."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {memoryHolderRoles.map((item) => (
                  <div
                    key={item.role}
                    className="space-y-1.5 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300"
                  >
                    <p className="text-sm font-semibold tracking-tight text-stone-900">{item.role}</p>
                    <p className="text-xs font-light leading-relaxed text-stone-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How the assessment works (side-by-side with imagery) ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="order-2 space-y-8 lg:order-1 lg:col-span-7">
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
                  {isFr ? "Comment fonctionne l'évaluation" : 'How the assessment works'}
                </h2>
                <p className="max-w-xl text-sm font-light text-stone-500">
                  {isFr
                    ? 'Déterministe, explicable, transparent. Aucun modèle opaque.'
                    : 'Deterministic, explainable, transparent. No opaque model.'}
                </p>
              </div>
              <ul className="space-y-4">
                {techWithSoulLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="mt-3 h-px w-5 shrink-0 bg-stone-300" />
                    <p className="font-light leading-relaxed text-stone-700">{line}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2 lg:col-span-5">
              <div
                className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-stone-200 ring-1 ring-stone-200"
                style={{
                  backgroundImage: `url(${ASSESSMENT_IMAGE_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                role="img"
                aria-label={
                  isFr
                    ? 'Conversation institutionnelle entre collègues'
                    : 'Institutional conversation between colleagues'
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── OCI Motif (image-backed, deep institutional tone) ── */}
      <section
        className="relative isolate overflow-hidden py-24 text-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,8,6,0.86) 0%, rgba(10,8,6,0.78) 100%), url(${MOTIF_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 mx-auto max-w-3xl space-y-4 px-6">
          <p className="text-xl font-light italic leading-relaxed text-stone-100 sm:text-2xl">
            &ldquo;{isFr
              ? "Les institutions sont finalement façonnées non seulement par ce qu'elles construisent, mais par ce qu'elles choisissent de se rappeler."
              : COPY.ociMotif}&rdquo;
          </p>
        </div>
      </section>

      {/* ── Tiers ── */}
      <section id="tiers" className="py-24">
        <div className="mx-auto max-w-6xl space-y-12 px-6">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
              {isFr ? 'Options de rapport' : 'Report options'}
            </h2>
            <p className="mx-auto max-w-2xl text-sm font-light text-stone-500">
              {isFr
                ? "Commencez gratuitement. Une analyse plus approfondie est disponible pour les équipes qui ont besoin d'un rapport institutionnel complet."
                : "Start free. Deeper analysis is available for organizations that need a full institutional report."}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`flex flex-col space-y-5 rounded-2xl border p-7 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  tier.featured
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                    {tier.name}
                  </p>
                  <p className={`text-2xl font-semibold tracking-tight ${tier.featured ? 'text-white' : 'text-stone-900'}`}>
                    {tier.price}
                  </p>
                </div>
                <p className={`text-sm font-light leading-relaxed ${tier.featured ? 'text-stone-300' : 'text-stone-600'}`}>
                  {tier.description}
                </p>
                <ul className="flex-1 space-y-2">
                  {tier.includes.map((item, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm font-light ${tier.featured ? 'text-stone-300' : 'text-stone-700'}`}>
                      <span className="mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={tier.ctaHref}
                  className={`block rounded-lg px-5 py-3 text-center text-sm font-semibold transition-colors ${
                    tier.featured
                      ? 'bg-white text-stone-900 hover:bg-stone-100'
                      : 'border border-stone-200 bg-stone-50 text-stone-900 hover:border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who this is for ── */}
      <section className="bg-stone-50 py-20">
        <div className="mx-auto max-w-5xl space-y-12 px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-stone-900">
            {isFr ? "À qui s'adresse cette évaluation" : 'Who this assessment is for'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((p) => (
              <div key={p.role} className="space-y-2 rounded-xl border border-stone-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-sm">
                <p className="font-semibold tracking-tight text-stone-900">{p.role}</p>
                <p className="text-sm font-light leading-relaxed text-stone-600">{p.signal}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl space-y-6 px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
            {isFr
              ? 'Évaluer le risque de continuité institutionnelle de votre organisation'
              : 'Assess your organization\'s institutional continuity risk'}
          </h2>
          <p className="font-light leading-relaxed text-stone-600">
            {isFr
              ? "L'évaluation prend environ vingt minutes. Elle est gratuite, pseudonyme et ne nécessite aucune connexion."
              : 'The assessment takes approximately twenty minutes. It is free, pseudonymous, and requires no login.'}
          </p>
          <Link
            href="/continuity-assessment/start"
            className="inline-block rounded-lg bg-stone-900 px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-stone-700"
          >
            {isFr ? 'Commencer l\'évaluation' : COPY.hero.primaryCta}
          </Link>
          <p className="text-xs font-light text-stone-400">
            {isFr
              ? "Aucune donnée personnelle n'est collectée. Les profils sont identifiés par des identifiants UUID uniquement."
              : 'No personal data is collected. Profiles are identified by UUID only.'}
          </p>
        </div>

        {/* Minimal branded footer line — no full marketing footer */}
        <div className="mx-auto mt-16 max-w-5xl border-t border-stone-200 px-6 pt-8">
          <div className="flex flex-col items-center justify-between gap-3 text-xs font-light text-stone-400 sm:flex-row">
            <p>
              {isFr
                ? '© UnionEyes — Infrastructure de continuité organisationnelle.'
                : '© UnionEyes — Organizational Continuity Infrastructure.'}
            </p>
            <div className="flex items-center gap-5">
              <Link href={`/${locale}`} className="hover:text-stone-700">
                {isFr ? 'Accueil' : 'Home'}
              </Link>
              <Link href={`/${locale}/contact`} className="hover:text-stone-700">
                {isFr ? 'Contact' : 'Contact'}
              </Link>
              <Link href={`/${locale}/trust`} className="hover:text-stone-700">
                {isFr ? 'Confiance et gouvernance' : 'Trust & governance'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
