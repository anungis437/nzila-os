import type { Metadata } from 'next';
import Image from 'next/image';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import AnimatedCounter from '@/components/public/AnimatedCounter';
import SectionHeading from '@/components/public/SectionHeading';
import ImageCard from '@/components/public/ImageCard';
import TechStackBar from '@/components/public/TechStackBar';
import InvestorCTA from '@/components/public/InvestorCTA';
import SectionDivider from '@/components/public/SectionDivider';
import TrackedLink from '@/components/public/TrackedLink';
import { MARKETING_FACTS } from '@/lib/marketing-facts';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Nzila Ventures builds institutional continuity infrastructure for trust-sensitive organizations that need governance, operational memory, evidence, and trust to survive transition.',
  openGraph: {
    title: 'Nzila Ventures | Institutional Continuity Infrastructure',
    description: 'Governed operational infrastructure for continuity, operational memory, audit evidence, and institutional trust.',
    images: [{ url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Earth at night showing institutional continuity infrastructure' }],
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

const flagships = [
  { name: 'Union Eyes', vertical: 'Flagship validation wedge', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800', alt: 'Union Eyes - continuity infrastructure for labor organizations', tam: 'Pilot-paid', description: 'Continuity and governance infrastructure for unions: grievance lineage, steward handoffs, operational memory, and evidence-sealed audit trails.' },
  { name: 'TrustCore', vertical: 'Governance operations', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800', alt: 'TrustCore - governance and compliance operations infrastructure', tam: 'Governance', description: 'Governance and compliance operations infrastructure for organizations that need decisions, approvals, and evidence to remain explainable.' },
  { name: 'Veridian Care', vertical: 'Healthcare continuity', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800', alt: 'Veridian Care - healthcare coordination and continuity infrastructure', tam: 'Healthcare', description: 'Continuity-first coordination infrastructure for healthcare organizations, designed around handoffs, auditability, privacy, and human accountability.' },
  { name: 'Memora', vertical: 'Cognitive continuity', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', alt: 'Memora - cognitive continuity systems designed around dignity and memory', tam: 'Dignity', description: 'Cognitive continuity systems designed around dignity, memory, care, and consent-aware operational support.' },
];

const intelligenceCapabilities = [
  { name: 'Operational Memory', metric: 'Continuity', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', alt: 'Structured operational records connected across time', description: 'Preserved procedures, precedents, workflows, decisions, rationale, and institutional context' },
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

const flagshipDescriptionFr: Record<string, string> = {
  'Union Eyes': 'Infrastructure de continuité et de gouvernance pour les syndicats: griefs, transitions de délégués, mémoire opérationnelle et journaux de preuve.',
  TrustCore: 'Infrastructure d opérations de gouvernance et conformité pour rendre décisions, approbations et preuves explicables.',
  'Veridian Care': 'Infrastructure de coordination santé axée continuité, transferts, auditabilité, confidentialité et responsabilité humaine.',
  Memora: 'Systèmes de continuité cognitive conçus autour de la dignité, de la mémoire, du soin et du consentement.',
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
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920"
          alt="Earth at night showing illuminated cities and global digital connectivity networks"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-60" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {isFr ? 'Infrastructure de continuité institutionnelle' : 'Institutional Continuity Infrastructure'}
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-emerald/10 text-emerald mb-4 border border-emerald/20">
              {isFr ? 'Anti-surveillance par doctrine' : 'Anti-surveillance by doctrine'}
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              {isFr ? 'Les organisations ne devraient pas perdre' : 'Organizations should not lose'}<br />
              <span className="gradient-text">{isFr ? 'leur continuité' : 'continuity when key people leave'}</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              {isFr
                ? 'Nzila Ventures construit Nzila OS: une infrastructure gouvernée qui préserve la mémoire opérationnelle, les décisions, les preuves et la confiance institutionnelle pendant les transitions.'
                : 'Nzila Ventures builds Nzila OS: governed infrastructure that preserves operational memory, decision rationale, evidence, and institutional trust across leadership change, restructuring, and system transition.'}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.25}>
            <div className="flex flex-col sm:flex-row gap-4">
              <TrackedLink
                href="/continuity-assessment"
                eventName="cta_continuity_assessment"
                eventProps={{ source: 'home_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-all text-lg shadow-lg shadow-gold/30 btn-press"
              >
                {isFr ? 'Commencer l évaluation' : 'Begin Continuity Assessment'}
              </TrackedLink>
              <TrackedLink
                href="/union-eyes"
                eventName="cta_union_eyes"
                eventProps={{ source: 'home_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                {isFr ? 'Explorer Union Eyes' : 'Explore Union Eyes'}
              </TrackedLink>
              <TrackedLink
                href="/anti-surveillance"
                eventName="cta_anti_surveillance"
                eventProps={{ source: 'home_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-white font-bold rounded-xl border border-white/20 hover:bg-white/10 transition-all text-lg btn-press"
              >
                {isFr ? 'Lire l engagement' : 'Read the Commitment'}
              </TrackedLink>
            </div>
          </ScrollReveal>

        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-white/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════ STATS BAR ═══════════════════════ */}
      <section className="relative bg-navy-light py-16 overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { target: 1, prefix: '', suffix: '', label: isFr ? 'Produit de validation phare' : 'Flagship Validation Wedge' },
              { target: MARKETING_FACTS.governedApplications, prefix: '', suffix: '', label: isFr ? 'Applications gouvernées' : 'Governed Applications' },
              { target: 10, prefix: '', suffix: '+', label: isFr ? 'Secteurs sensibles à la confiance' : 'Trust-Sensitive Sectors' },
              { target: 7, prefix: '', suffix: '', label: isFr ? 'Piliers de doctrine' : 'Doctrine Pillars' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  <AnimatedCounter
                    target={stat.target}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </div>
                <div className="text-gray-400 font-medium text-sm tracking-wider uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
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
              <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                <Image
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800"
                  alt="Diverse team of engineers collaborating around laptops in a sunlit workspace"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 glass-card rounded-xl p-4">
                  <div className="flex items-center gap-6 text-white">
                    <div>
                      <div className="text-2xl font-bold">$4M+</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Investissement ingénierie' : 'Engineering Investment'}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">56%</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Réduction pilote visée' : 'Pilot Reduction Target'}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">80%+</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Réutilisation gouvernée' : 'Governed Reuse'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal className="mt-12">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <TrackedLink
                href="/institutional-continuity"
                eventName="cta_institutional_continuity"
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

      {/* ═══════════════════════ FLAGSHIP PLATFORMS ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Architecture de marque' : 'Brand Architecture'}
            title={isFr ? 'Une infrastructure, un produit de validation, plusieurs lignes de continuité' : 'One operating infrastructure, one flagship wedge, multiple continuity lines'}
            subtitle={isFr ? 'Nzila Ventures est la société d exploitation. Nzila OS est l infrastructure gouvernée. Union Eyes est la preuve commerciale la plus claire.' : 'Nzila Ventures is the operating company. Nzila OS is the governed infrastructure. Union Eyes is the clearest commercial proof point.'}
          />

          <div className="grid md:grid-cols-2 gap-6">
            {flagships.map((platform, i) => (
              <ScrollReveal key={platform.name} delay={i * 0.1}>
                <ImageCard src={platform.image} alt={platform.alt} aspect="video">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-electric/80 text-white">
                      {platform.name === 'Union Eyes' ? (isFr ? 'Produit phare' : 'Flagship') : (isFr ? 'Ligne produit' : 'Product line')}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                      {platform.vertical}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{platform.name}</h3>
                  <p className="text-gray-300 text-sm mb-3">{isFr ? (flagshipDescriptionFr[platform.name] ?? platform.description) : platform.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gold font-semibold">{platform.tam}</span>
                  </div>
                </ImageCard>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="text-center mt-12">
            <TrackedLink
              href="/union-eyes"
              eventName="cta_union_eyes"
              eventProps={{ source: 'home_flagships' }}
              className="inline-flex items-center text-electric font-semibold hover:text-blue-700 text-lg"
            >
              {isFr ? 'Voir le chemin Union Eyes ->' : 'View the Union Eyes path ->'}
            </TrackedLink>
          </ScrollReveal>
        </div>
      </section>

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
                      <span className="inline-block mt-2 text-xs font-semibold text-gold">
                        {vertical.tam} TAM
                      </span>
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
            title={isFr ? 'L adoption institutionnelle exige des preuves, pas du bruit' : 'Institutional adoption requires evidence, not noise'}
            subtitle={isFr ? 'Les pilotes, évaluations et études de cas doivent montrer des améliorations mesurables de continuité, gouvernance et confiance.' : 'Pilots, assessments, and case studies must show measurable improvement in continuity, governance, and trust.'}
            light
          />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { value: 'ICRA', label: isFr ? 'Diagnostic de continuité' : 'Continuity Diagnostic', color: 'from-electric to-violet' },
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
