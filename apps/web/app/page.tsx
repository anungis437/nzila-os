import type { Metadata } from 'next';
import Image from 'next/image';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import HomeExperience from '@/components/public/HomeExperience';
import SectionHeading from '@/components/public/SectionHeading';
import TechStackBar from '@/components/public/TechStackBar';
import InvestorCTA from '@/components/public/InvestorCTA';
import SectionDivider from '@/components/public/SectionDivider';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Nzila Ventures builds organizational continuity infrastructure for trust-sensitive organizations that need governance, operational memory, evidence, and trust to survive transition.',
  openGraph: {
    title: 'Nzila Ventures | Organizational Continuity Infrastructure',
    description: 'Governed operational infrastructure for continuity, operational memory, audit evidence, and organizational trust.',
    images: [{ url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Earth at night showing organizational continuity infrastructure' }],
  },
  alternates: { canonical: '/' },
};

const verticals = [
  { name: 'Fintech', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', alt: 'Financial trading charts with candlestick patterns on dark screens', description: 'Banking, payments, insurance', tam: '$100B+' },
  { name: 'Agrotech', image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', alt: 'Aerial view of lush green agricultural farmland rows', description: 'Farm management, supply chain', tam: '$8.6B' },
  { name: 'Uniontech', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800', alt: 'Workers gathered in a professional labor meeting', description: 'Labor rights, union management', tam: '$50B' },
  { name: 'Legaltech', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800', alt: 'Scales of justice on a desk with legal documents', description: 'Case management, legal support tools', tam: '$13B+' },
  { name: 'EdTech', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800', alt: 'Students collaborating around laptops in a modern classroom', description: 'Learning, training, certification', tam: '$13B+' },
  { name: 'Entertainment', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', alt: 'Musician performing live on stage under spotlight', description: 'Streaming, content platforms', tam: '$50B' },
  { name: 'Commerce', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', alt: 'Customer completing a digital payment at retail checkout', description: 'Order-centric trade ops, quoting, logistics', tam: '$25B' },
  { name: 'Healthtech', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800', alt: 'Doctor using digital tablet for patient health records', description: 'Care, wellness, cognitive', tam: '$20B' },
  { name: 'Insurtech', image: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=800', alt: 'Business analyst reviewing insurance risk data on screens', description: 'Arbitrage, underwriting support', tam: '$30B' },
  { name: 'Justice', image: 'https://images.unsplash.com/photo-1591291621164-2c6367723315?w=800', alt: 'Raised fist silhouette against sunset representing social justice advocacy', description: 'Advocacy, DEI training', tam: '$1.5B' },
];

const intelligenceCapabilities = [
  { name: 'Operational Memory', metric: 'Continuity', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', alt: 'Structured operational records connected across time', description: 'Preserved procedures, precedents, workflows, decisions, rationale, and organizational context' },
  { name: 'Governance Evidence', metric: 'Audit-ready', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', alt: 'Governance evidence dashboard with traceable records', description: 'Decision lineage, approvals, audit trails, reviewable records, and governance replay' },
  { name: 'Explainable Assistance', metric: 'Human-led', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800', alt: 'Explainable system infrastructure with visible controls', description: 'AI-assisted summaries and recommendations that remain traceable, inspectable, and overridable' },
  { name: 'Sovereign Federation', metric: 'Portable', image: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800', alt: 'Federated infrastructure preserving local data boundaries', description: 'Cross-organization coordination without centralizing control or weakening local ownership' },
];

const verticalDescriptionFr: Record<string, string> = {
  Fintech: 'Banque, paiements, assurance',
  Agrotech: 'Gestion agricole, chaine logistique',
  Uniontech: 'Droits du travail, gestion syndicale',
  Legaltech: 'Gestion des dossiers et outils juridiques',
  EdTech: 'Apprentissage, formation, certification',
  Entertainment: 'Streaming et plateformes de contenu',
  Commerce: 'Opérations commerciales, devis et logistique',
  Healthtech: 'Soins, bien-etre, cognition',
  Insurtech: 'Arbitrage et soutien a la souscription',
  Justice: 'Plaidoyer et formation DEI',
};

const intelligenceFr: Record<string, { name: string; metric: string; description: string }> = {
  'Operational Memory': {
    name: 'Mémoire opérationnelle',
    metric: 'Continuité',
    description: 'Procédures, précédents, décisions, raisons et contexte institutionnel préservés',
  },
  'Governance Evidence': {
    name: 'Preuves de gouvernance',
    metric: 'Audit-ready',
    description: 'Lignée des décisions, approbations, journaux d audit et gouvernance rejouable',
  },
  'Explainable Assistance': {
    name: 'Assistance explicable',
    metric: 'Responsabilité humaine',
    description: 'Résumés et recommandations traçables, inspectables et révisables par des humains',
  },
  'Sovereign Federation': {
    name: 'Fédération souveraine',
    metric: 'Portable',
    description: 'Coordination entre organisations sans centraliser le contrôle ni affaiblir la propriété locale',
  },
};

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* Product-led homepage hero and interactive journey introduction */}
      <HomeExperience isFr={isFr} />

      {/* ═══════════════════════ DUAL ENTRY GTM ═══════════════════════ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Modèle commercial' : 'Go-To-Market Model'}
            title={isFr ? 'Deux parcours d entrée valides. Une seule architecture de continuité.' : 'Two valid entry paths. One continuity architecture.'}
            subtitle={isFr
              ? 'Les organisations peuvent entrer par la stratégie de continuité (OCRA) ou par la stabilisation opérationnelle (Union Eyes). Les deux parcours convergent vers la même infrastructure.'
              : 'Organizations can enter through continuity intelligence (OCRA-first) or operational stabilization (Operations-first). Both paths converge into the same continuity infrastructure.'}
          />

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-xs uppercase tracking-wider text-electric font-semibold mb-2">{isFr ? 'Parcours A' : 'Path A'}</p>
              <h3 className="text-2xl font-bold text-navy mb-3">{isFr ? 'OCRA-first' : 'OCRA-first'}</h3>
              <p className="text-gray-700 mb-4">{isFr ? 'Diagnostiquer puis opérationnaliser. Pour la direction, la modernisation et la gouvernance.' : 'Diagnose then operationalize. Best for executive, modernization, and governance-led buyers.'}</p>
              <TrackedLink
                href="/continuity-assessment"
                eventName="cta_dual_path_ocra"
                eventProps={{ source: 'home_dual_entry' }}
                className="inline-flex items-center justify-center px-5 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-light transition-all"
              >
                {isFr ? 'Entrer par OCRA' : 'Enter via OCRA'}
              </TrackedLink>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-xs uppercase tracking-wider text-electric font-semibold mb-2">{isFr ? 'Parcours B' : 'Path B'}</p>
              <h3 className="text-2xl font-bold text-navy mb-3">{isFr ? 'Operations-first' : 'Operations-first'}</h3>
              <p className="text-gray-700 mb-4">{isFr ? 'Opérationnaliser puis diagnostiquer. Pour les équipes qui ont besoin d un soulagement workflow immédiat.' : 'Operationalize then diagnose. Best for teams that need immediate workflow stabilization.'}</p>
              <TrackedLink
                href="/union-eyes"
                eventName="cta_dual_path_ops"
                eventProps={{ source: 'home_dual_entry' }}
                className="inline-flex items-center justify-center px-5 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-light transition-all"
              >
                {isFr ? 'Entrer par les opérations' : 'Enter via Operations'}
              </TrackedLink>
            </div>
          </div>

          <div className="rounded-xl border border-navy/15 bg-white p-6">
            <p className="text-sm text-gray-700">
              {isFr
                ? 'Règle architecture: ne jamais séparer la continuité en produits fragmentés. Les parcours se distinguent à l entrée, puis se reconnectent rapidement dans la même ontologie de continuité.'
                : 'Architecture rule: never split continuity into fragmented products. Paths diverge at entry and reconnect quickly in the same continuity ontology.'}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ MISSION ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                {isFr ? 'Le problème' : 'The Problem'}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                {isFr ? 'La gouvernance devient fragile quand ' : 'Governance becomes fragile when '}<span className="text-electric">{isFr ? 'la mémoire opérationnelle disparaît' : 'operational memory disappears'}</span>
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {isFr
                  ? 'La plupart des institutions dépendent de quelques personnes qui se souviennent des décisions, des précédents, des relations et des exceptions. Quand ces personnes partent, l organisation perd plus que du temps: elle perd du contexte, de la confiance et de la capacité de gouverner.'
                  : 'Most institutions depend on a few people who remember the decisions, precedents, relationships, and exceptions. When those people leave, the organization loses more than time: it loses context, trust, and the ability to govern consistently.'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {(isFr
                  ? ['Mémoire opérationnelle', 'Gouvernance visible', 'Preuves auditables', 'Souveraineté des données']
                  : ['Operational Memory', 'Visible Governance', 'Auditable Evidence', 'Data Sovereignty']).map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-electric" />
                    <span className="text-sm font-medium text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="rounded-3xl border border-slate-200 bg-[#101a2c] p-6 shadow-[0_25px_70px_rgba(8,14,28,0.16)] sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">
                  {isFr ? 'À préserver lors d’une transition' : 'What should survive a transition'}
                </p>
                <div className="mt-7 space-y-5">
                  {[
                    {
                      index: '01',
                      title: isFr ? 'Le contexte' : 'The context',
                      description: isFr ? 'Pourquoi une décision a été prise' : 'Why a decision was made',
                    },
                    {
                      index: '02',
                      title: isFr ? 'Les responsabilités' : 'The ownership',
                      description: isFr ? 'Qui doit agir et qui peut consulter' : 'Who acts, and who has authorized access',
                    },
                    {
                      index: '03',
                      title: isFr ? 'Les preuves' : 'The evidence',
                      description: isFr ? 'Ce qui permet de vérifier la suite' : 'What the next team can verify',
                    },
                  ].map((item) => (
                    <div key={item.index} className="flex items-start gap-4 border-b border-white/10 pb-5 last:border-0 last:pb-0">
                      <span className="rounded-lg border border-white/15 px-2.5 py-2 text-xs font-semibold text-[#dfbe70]">{item.index}</span>
                      <div>
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-8 rounded-xl bg-white/5 px-4 py-3 text-sm leading-relaxed text-slate-300">
                  {isFr ? 'Le savoir institutionnel ne devrait pas dépendre d’une seule personne.' : 'Institutional continuity should not depend on one person remembering everything.'}
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal className="mt-12">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <TrackedLink
                href="/organizational-continuity"
                eventName="cta_organizational_continuity"
                eventProps={{ source: 'home_mission' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                {isFr ? 'Comprendre la continuité' : 'Understand Continuity'}
              </TrackedLink>
              <TrackedLink
                href="/starter-kit"
                eventName="cta_starter_kit"
                eventProps={{ source: 'home_mission' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-navy text-white font-bold rounded-xl border border-navy hover:bg-navy-light transition-all text-lg btn-press"
              >
                {isFr ? 'Kit de démarrage' : 'Get the Starter Kit'}
              </TrackedLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Priority product paths are explicit; portfolio maturity is not implied. */}
      <section className="bg-[#f6f8fb] py-24" id="solutions">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-electric">
              {isFr ? 'Nos solutions' : 'Our solutions'}
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-navy md:text-5xl">
              {isFr ? 'Une architecture commune. Des réalités institutionnelles distinctes.' : 'Shared foundations. Different institutional realities.'}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              {isFr
                ? 'Union Eyes et CIVIC abordent des enjeux concrets avec des parcours adaptés. Les autres initiatives du portefeuille ont leur propre portée et niveau de maturité.'
                : 'Union Eyes and CIVIC address specific institutional challenges through distinct journeys. Other portfolio initiatives have their own scope and maturity.'}
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Organisations syndicales' : 'Labour organizations'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-navy">Union Eyes</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                {isFr
                  ? 'Protéger la continuité des dossiers, les transitions de représentation et la mémoire opérationnelle du syndicat.'
                  : 'Preserve case history, representative handoffs and union operational memory across transitions.'}
              </p>
              <p className="mt-7 text-xs font-semibold text-slate-500">{isFr ? 'Parcours de validation pilote' : 'Pilot-validation journey'}</p>
              <TrackedLink href="/union-eyes" eventName="home_solution_union_eyes" className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-electric underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
                {isFr ? 'Explorer Union Eyes' : 'Explore Union Eyes'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>

            <article className="flex flex-col rounded-3xl border border-slate-200 bg-[#101a2c] p-7 shadow-lg sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#dfbe70]">{isFr ? 'Institutions publiques' : 'Public institutions'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white">CIVIC</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-300">
                {isFr
                  ? 'Relier les engagements, les responsables, les preuves et les décisions au fil des programmes de modernisation.'
                  : 'Connect commitments, accountable owners, evidence and decisions across modernization initiatives.'}
              </p>
              <p className="mt-7 text-xs font-semibold text-slate-400">{isFr ? 'Présentations et découverte' : 'Briefings and discovery'}</p>
              <TrackedLink href="/public-service" eventName="home_solution_civic" className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-[#dfbe70] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {isFr ? 'Explorer CIVIC' : 'Explore CIVIC'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>

            <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Studio de produits' : 'Product studio'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-navy">{isFr ? 'Portefeuille Nzila' : 'Nzila portfolio'}</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                {isFr
                  ? 'Découvrir les autres produits et les secteurs que nous explorons, sans confondre initiative, pilote et disponibilité commerciale.'
                  : 'Discover other product lines and sectors we are exploring, with clear distinctions between concepts, pilots and commercial availability.'}
              </p>
              <p className="mt-7 text-xs font-semibold text-slate-500">{isFr ? 'Explorer par produit' : 'Explore by product'}</p>
              <TrackedLink href="/products" eventName="home_solution_portfolio" className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-electric underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
                {isFr ? 'Voir les produits' : 'View products'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* ═══════════════════════ INTELLIGENCE DIFFERENTIATOR ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Ce que Nzila OS préserve' : 'What Nzila OS Preserves'}
            title={isFr ? 'La continuité devient une propriété du système' : 'Continuity becomes a system property'}
            subtitle={isFr ? 'Le système structure les décisions, la mémoire, les preuves et les droits d accès pour que l institution puisse rester gouvernable.' : 'The system structures decisions, memory, evidence, and access rights so the institution remains governable across change.'}
            light
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {intelligenceCapabilities.map((cap, i) => (
              <ScrollReveal key={cap.name} delay={i * 0.1}>
                <div className="group relative rounded-2xl overflow-hidden aspect-3/4 hover-lift">
                  <Image
                    src={cap.image}
                    alt={cap.alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-navy via-navy/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-gold/20 text-gold mb-3">
                      {isFr ? (intelligenceFr[cap.name]?.metric ?? cap.metric) : cap.metric}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-1">{isFr ? (intelligenceFr[cap.name]?.name ?? cap.name) : cap.name}</h3>
                    <p className="text-sm text-gray-400">{isFr ? (intelligenceFr[cap.name]?.description ?? cap.description) : cap.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider variant="dots" />

      {/* ═══════════════════════ VERTICALS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Institutions servies' : 'Who We Serve'}
            title={isFr ? 'Des secteurs où la continuité est matérielle' : 'Sectors where continuity is materially important'}
            subtitle={isFr ? 'Nous servons les organisations qui ne peuvent pas se permettre de perdre mémoire, preuves ou gouvernance lors des transitions.' : 'We serve organizations that cannot afford to lose memory, evidence, or governance during transitions.'}
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {verticals.map((vertical, i) => (
              <ScrollReveal key={vertical.name} delay={i * 0.05}>
                <TrackedLink
                  href={`/verticals/${vertical.name.toLowerCase().replace('/', '')}`}
                  eventName="vertical_open"
                  eventProps={{ vertical: vertical.name, source: 'home_vertical_grid' }}
                >
                  <div className="group relative rounded-2xl overflow-hidden aspect-3/4 hover-lift cursor-pointer">
                    <Image
                      src={vertical.image}
                      alt={vertical.alt}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      sizes="(max-width: 768px) 50vw, 20vw"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="font-bold text-white text-lg mb-0.5">{vertical.name}</h3>
                      <p className="text-xs text-gray-300">{isFr ? (verticalDescriptionFr[vertical.name] ?? vertical.description) : vertical.description}</p>
                    </div>
                  </div>
                </TrackedLink>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* ═══════════════════════ IP & VALUE ═══════════════════════ */}
      <section className="py-24 bg-navy-light relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Confiance et preuves' : 'Trust and Evidence'}
            title={isFr ? 'L adoption institutionnelle exige des preuves, pas du bruit' : 'Organizational adoption requires evidence, not noise'}
            subtitle={isFr ? 'Les pilotes, évaluations et études de cas doivent montrer des améliorations mesurables de continuité, gouvernance et confiance.' : 'Pilots, assessments, and case studies must show measurable improvement in continuity, governance, and trust.'}
            light
          />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { value: 'OCRA', label: isFr ? 'Diagnostic de continuité' : 'Continuity Diagnostic', color: 'from-electric to-violet' },
              { value: 'UE', label: isFr ? 'Validation Union Eyes' : 'Union Eyes Validation', color: 'from-gold to-gold-light' },
              { value: 'ICI', label: isFr ? 'Indice de continuité' : 'Continuity Index', color: 'from-emerald to-cyan-400' },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 0.15}>
                <div className="relative rounded-2xl p-8 text-center bg-white/5 border border-white/10 hover-lift">
                  <div className={`text-4xl md:text-5xl font-bold bg-linear-to-r ${item.color} bg-clip-text text-transparent mb-3`}>
                    {item.value}
                  </div>
                  <div className="text-gray-400 font-medium">{item.label}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TECH STACK ═══════════════════════ */}
      <section className="py-16 bg-white">
        <TechStackBar />
      </section>

      {/* ═══════════════════════ INVESTOR / PARTNER CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}
