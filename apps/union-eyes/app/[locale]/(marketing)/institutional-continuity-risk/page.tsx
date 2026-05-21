/**
 * ARTIFACT TYPE: Marketing Landing Page
 * DOCTRINE_VERSION: 1.0.0
 * ROUTE: /[locale]/institutional-continuity-risk
 *
 * OCI Category Awakening Page — distinct from the /institutional-continuity
 * product substrate page. This page defines the category of Organizational
 * Continuity Infrastructure (OCI) as an institutional concern and introduces
 * the ICRA self-assessment as the entry point.
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
    alternates: buildLocaleAlternates(locale, '/institutional-continuity-risk'),
  };
}

export default async function InstitutionalContinuityRiskPage({
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
      price: isFr ? '750–1 500 $' : '$750–$1,500',
      description: isFr
        ? 'Analyse institutionnelle approfondie avec analyse de la dette de continuité, des dépendances et des risques de modernisation.'
        : 'In-depth institutional analysis with governance entropy, continuity debt, dependency review, and modernization risk.',
      includes: isFr
        ? ['Tout dans Réflexion', 'Analyse de l\'entropie de gouvernance', 'Analyse de la dette de continuité', 'Examen des dépendances institutionnelles', 'Couche de risque de modernisation', 'Recommandations complètes']
        : ['Everything in Reflection', 'Governance entropy analysis', 'Continuity debt analysis', 'Institutional dependency review', 'Modernization risk layer', 'Full recommendations'],
      cta: isFr ? 'Demander ce rapport' : 'Request this report',
      ctaHref: '/contact?topic=executive-continuity-brief',
      featured: true,
    },
    {
      id: 'institutional_continuity_diagnostic',
      name: isFr ? 'Diagnostic institutionnel de continuité' : 'Institutional Continuity Diagnostic',
      price: isFr ? '3 500–7 500 $' : '$3,500–$7,500',
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
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center space-y-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
          {isFr ? 'Évaluation de la continuité institutionnelle' : 'Institutional Continuity Risk Assessment'}
        </p>
        <h1 className="font-serif text-4xl font-bold leading-tight text-stone-900 sm:text-5xl lg:text-6xl max-w-4xl mx-auto">
          {isFr
            ? "La plupart des institutions portent plus de risques de continuité qu'elles ne le réalisent."
            : COPY.hero.headline}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-stone-600 leading-relaxed">
          {isFr
            ? "Chaque organisation a des personnes qui maintiennent silencieusement la continuité longtemps après que les systèmes autour d'elles ont cessé de le faire."
            : COPY.hero.humanContinuityLine}
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/continuity-assessment/start"
            className="rounded-lg bg-stone-900 px-7 py-3.5 text-sm font-semibold text-white hover:bg-stone-700 transition-colors"
          >
            {isFr ? 'Évaluer le risque de continuité institutionnelle' : COPY.hero.primaryCta}
          </Link>
          <Link
            href="#tiers"
            className="rounded-lg border border-stone-200 bg-white px-6 py-3.5 text-sm font-medium text-stone-700 hover:border-stone-300 transition-colors"
          >
            {isFr ? 'Voir les options de rapport' : 'See report options'}
          </Link>
        </div>
        <p className="text-xs text-stone-400">
          {isFr
            ? 'Gratuit. Pseudonyme. Aucune connexion requise.'
            : 'Free. Pseudonymous. No login required.'}
        </p>
      </section>

      {/* ── Human Scenes ── */}
      <section className="bg-stone-50 py-20">
        <div className="mx-auto max-w-5xl px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-3xl font-bold text-stone-900">
              {isFr ? 'Ce que vous reconnaîtrez peut-être' : 'What you may recognize'}
            </h2>
            <p className="text-stone-500 max-w-xl mx-auto text-sm">
              {isFr
                ? "Ces situations ne sont pas rares. Elles sont la façon normale dont la continuité s'érode — silencieusement, dans la pratique ordinaire."
                : "These situations are not unusual. They are the normal way continuity erodes — quietly, in ordinary practice."}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {humanScenes.map((scene) => (
              <div
                key={scene.id}
                className="rounded-xl border border-stone-200 bg-white p-6 space-y-3"
              >
                <h3 className="font-serif text-base font-semibold text-stone-900">{scene.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{scene.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quiet Risk Signals ── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-3xl font-bold text-stone-900">
              {isFr ? 'Les signaux de risque silencieux' : 'The quiet risk signals'}
            </h2>
            <p className="text-stone-500 max-w-2xl mx-auto text-sm">
              {isFr
                ? "Le risque de continuité institutionnelle ne se manifeste pas comme une crise. Il se manifeste comme des frictions quotidiennes, légèrement trop élevées, légèrement trop fréquentes."
                : "Institutional continuity risk does not present as a crisis. It presents as daily friction — slightly too high, slightly too frequent."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quietRiskCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-stone-200 bg-stone-50 p-5 space-y-2"
              >
                <p className="font-semibold text-stone-900">{card.label}</p>
                <p className="text-sm text-stone-600 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Institutional Memory Holders ── */}
      <section className="bg-stone-50 py-20">
        <div className="mx-auto max-w-5xl px-6 space-y-12">
          <div className="space-y-4 max-w-3xl">
            <h2 className="font-serif text-3xl font-bold text-stone-900">
              {isFr ? 'Les détenteurs de mémoire institutionnelle' : 'Institutional Memory Holders'}
            </h2>
            <p className="text-stone-600 leading-relaxed">
              {isFr
                ? "Dans chaque organisation, il y a des personnes dont la présence maintient la cohérence institutionnelle — qui ne se définissent pas comme des détenteurs de mémoire, et dont l'organisation ne reconnaît pas toujours le rôle. Ces personnes constituent la première ligne de risque de continuité institutionnelle."
                : "In every organization, there are people whose presence maintains institutional coherence — who do not think of themselves as memory holders, and whose role the organization does not always recognize. These people are the first line of institutional continuity risk."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memoryHolderRoles.map((item) => (
              <div key={item.role} className="rounded-xl border border-stone-200 bg-white p-5 space-y-2">
                <p className="font-semibold text-stone-900">{item.role}</p>
                <p className="text-sm text-stone-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech With Soul (operationalized) ── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 space-y-10">
          <div className="space-y-3">
            <h2 className="font-serif text-3xl font-bold text-stone-900">
              {isFr ? "Comment fonctionne l'évaluation" : 'How the assessment works'}
            </h2>
            <p className="text-stone-500 text-sm max-w-xl">
              {isFr
                ? "Déterministe, explicable, transparent. Aucun modèle opaque."
                : "Deterministic, explainable, transparent. No opaque model."}
            </p>
          </div>
          <ul className="space-y-4">
            {techWithSoulLines.map((line, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="mt-1 h-px w-5 shrink-0 bg-stone-300" />
                <p className="text-stone-700 leading-relaxed">{line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── OCI Motif ── */}
      <section className="bg-stone-900 py-16 text-center">
        <div className="mx-auto max-w-3xl px-6 space-y-4">
          <p className="font-serif text-xl italic text-stone-300 leading-relaxed">
            &ldquo;{isFr
              ? "Les institutions sont finalement façonnées non seulement par ce qu'elles construisent, mais par ce qu'elles choisissent de se rappeler."
              : COPY.ociMotif}&rdquo;
          </p>
        </div>
      </section>

      {/* ── Tiers ── */}
      <section id="tiers" className="py-24">
        <div className="mx-auto max-w-6xl px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="font-serif text-3xl font-bold text-stone-900">
              {isFr ? 'Options de rapport' : 'Report options'}
            </h2>
            <p className="text-stone-500 max-w-2xl mx-auto text-sm">
              {isFr
                ? "Commencez gratuitement. Une analyse plus approfondie est disponible pour les équipes qui ont besoin d'un rapport institutionnel complet."
                : "Start free. Deeper analysis is available for organizations that need a full institutional report."}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-2xl border p-7 space-y-5 flex flex-col ${
                  tier.featured
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-widest ${tier.featured ? 'text-stone-400' : 'text-stone-400'}`}>
                    {tier.name}
                  </p>
                  <p className={`text-2xl font-bold ${tier.featured ? 'text-white' : 'text-stone-900'}`}>
                    {tier.price}
                  </p>
                </div>
                <p className={`text-sm leading-relaxed ${tier.featured ? 'text-stone-300' : 'text-stone-600'}`}>
                  {tier.description}
                </p>
                <ul className="space-y-2 flex-1">
                  {tier.includes.map((item, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${tier.featured ? 'text-stone-300' : 'text-stone-700'}`}>
                      <span className="mt-0.5 shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href={tier.ctaHref}
                  className={`block rounded-lg px-5 py-3 text-sm font-semibold text-center transition-colors ${
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
        <div className="mx-auto max-w-5xl px-6 space-y-12">
          <h2 className="font-serif text-3xl font-bold text-stone-900 text-center">
            {isFr ? "À qui s'adresse cette évaluation" : 'Who this assessment is for'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personas.map((p) => (
              <div key={p.role} className="rounded-xl border border-stone-200 bg-white p-5 space-y-2">
                <p className="font-semibold text-stone-900">{p.role}</p>
                <p className="text-sm text-stone-600 leading-relaxed">{p.signal}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center space-y-6">
          <h2 className="font-serif text-3xl font-bold text-stone-900">
            {isFr
              ? 'Évaluer le risque de continuité institutionnelle de votre organisation'
              : 'Assess your organization\'s institutional continuity risk'}
          </h2>
          <p className="text-stone-600 leading-relaxed">
            {isFr
              ? "L'évaluation prend environ vingt minutes. Elle est gratuite, pseudonyme et ne nécessite aucune connexion."
              : 'The assessment takes approximately twenty minutes. It is free, pseudonymous, and requires no login.'}
          </p>
          <Link
            href="/continuity-assessment/start"
            className="inline-block rounded-lg bg-stone-900 px-8 py-4 text-sm font-semibold text-white hover:bg-stone-700 transition-colors"
          >
            {isFr ? 'Commencer l\'évaluation' : COPY.hero.primaryCta}
          </Link>
          <p className="text-xs text-stone-400">
            {isFr
              ? "Aucune donnée personnelle n'est collectée. Les profils sont identifiés par des identifiants UUID uniquement."
              : 'No personal data is collected. Profiles are identified by UUID only.'}
          </p>
        </div>
      </section>
    </div>
  );
}
