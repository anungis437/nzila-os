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
  description: `Nzila Ventures builds ${MARKETING_FACTS.productPlatforms} software products and ${MARKETING_FACTS.governedApplications} live tools across healthcare, finance, agriculture, labor rights, and justice.`,
  openGraph: {
    title: 'Nzila Ventures | Trusted Technology for Social Impact',
    description: `${MARKETING_FACTS.productPlatforms} products and ${MARKETING_FACTS.governedApplications} live tools for essential industries.`,
    images: [{ url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Earth at night showing global digital connectivity — Nzila Ventures' }],
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
  { name: 'UnionEyes', vertical: 'Uniontech', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800', alt: 'UnionEyes — comprehensive union management platform', tam: '$50B', description: 'Union management, pension forecasting, grievance tracking' },
  { name: 'Zonga', vertical: 'Music & Creator Economy', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800', alt: 'Zonga — African music platform for artists, streaming, and creator royalties', tam: '$20B+', description: 'Africa-first music distribution and streaming platform for artists and creator payouts' },
  { name: 'Flow', vertical: 'Commerce & Operations', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800', alt: 'Flow — enterprise order-to-cash and supply chain management platform', tam: '$100B+', description: 'Commerce operations platform covering order-to-cash, inventory, and multi-channel workflows' },
  { name: 'FAIRCASE', vertical: 'Justice & Equity', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800', alt: 'FAIRCASE — institutional anti-racism governance and legal intelligence platform', tam: '$1.5B+', description: 'Institutional anti-racism governance platform with evidence-grade case workflows, analytics, and remediation oversight' },
];

const intelligenceCapabilities = [
  { name: 'Natural Language Processing', metric: 'Domain-specific', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', alt: 'Digital language processing with connected data nodes', description: 'Context-aware assistance across legal, healthcare, and education' },
  { name: 'Predictive Analytics', metric: 'Purpose-built', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', alt: 'Predictive analytics dashboard with colorful data visualizations', description: 'Pension forecasting, crop yields, insurance risk scoring' },
  { name: 'Anomaly Détéction', metric: 'Real-time', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800', alt: 'Real-time network monitoring console détécting anomalies', description: 'Fraud prevention, compliance monitoring, threat intelligence' },
  { name: 'Computer Vision', metric: 'Multi-modal', image: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800', alt: 'Computer vision system analyzing visual data with recognition overlays', description: 'Document processing, agricultural imaging, identity verification' },
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
  UnionEyes: 'Gestion syndicale, prevision des pensions, suivi des griefs',
  Zonga: 'Plateforme africaine de distribution et de streaming musical pour artistes et paiements de redevances.',
  Flow: 'Plateforme d operations commerciales couvrant order-to-cash, inventaire et flux multicanaux.',
  FAIRCASE: 'Plateforme de gouvernance anti-racisme avec workflows de preuve, intelligence juridique et pilotage de remediation.',
};

const intelligenceFr: Record<string, { name: string; metric: string; description: string }> = {
  'Natural Language Processing': {
    name: 'Traitement du langage naturel',
    metric: 'Specifique au domaine',
    description: 'Assistance contextuelle en droit, sante et education',
  },
  'Predictive Analytics': {
    name: 'Analytique predictive',
    metric: 'Concu pour usage réel',
    description: 'Prevision des pensions, rendements agricoles et notation du risque',
  },
  'Anomaly Détéction': {
    name: 'Détéction des anomalies',
    metric: 'Temps réel',
    description: 'Prevention de la fraude, suivi de conformite et intelligence de menace',
  },
  'Computer Vision': {
    name: 'Vision par ordinateur',
    metric: 'Multimodale',
    description: 'Traitement documentaire, imagerie agricole et verification d identite',
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
              {isFr ? "Technologie de confiance pour l'impact social" : 'Trusted Technology for Social Impact'}
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.05}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-emerald/10 text-emerald mb-4 border border-emerald/20">
              🌿 {isFr ? 'Démarché de certification B Corp - Personnes, Planète, Mission' : 'Pursuing B Corp Certification - People, Planet, Purpose'}
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              {isFr ? "Construire l'avenir" : 'Building the Future'}<br />
              <span className="gradient-text">{isFr ? 'Un secteur à la fois' : 'One Vertical at a Time'}</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              {isFr
                ? `${MARKETING_FACTS.productPlatforms} produits logiciels dans ${MARKETING_FACTS.verticalsLabel} industries - livres via ${MARKETING_FACTS.governedApplications} outils en service pour la sante, la finance, l agriculture, les droits du travail et la justice.`
                : `${MARKETING_FACTS.productPlatforms} software products across ${MARKETING_FACTS.verticalsLabel} industries - delivered through ${MARKETING_FACTS.governedApplications} live tools for healthcare, finance, agriculture, labor rights, and justice.`}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <TrackedLink
                href="/portfolio"
                eventName="cta_portfolio"
                eventProps={{ source: 'home_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                {isFr ? 'Explorer notre portefeuille' : 'Explore Our Portfolio'}
              </TrackedLink>
              <TrackedLink
                href="/investors"
                eventName="cta_investors"
                eventProps={{ source: 'home_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                {isFr ? 'Pour les investisseurs' : 'For Investors'}
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
              { target: MARKETING_FACTS.productPlatforms, suffix: '', label: isFr ? 'Produits' : 'Products' },
              { target: MARKETING_FACTS.governedApplications, suffix: '', label: isFr ? 'Outils en service' : 'Live Tools' },
              { target: 10, suffix: '+', label: isFr ? 'Industries' : 'Industries' },
              { target: 100, prefix: '$', suffix: 'B+', label: isFr ? 'Marché total' : 'Total Market Size' },
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
                {isFr ? 'Notre mission' : 'Our Mission'}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                {isFr ? 'Infrastructure pour ' : 'Infrastructure for '}<span className="text-electric">{isFr ? "l'impact social" : 'Social Impact'}</span>{isFr ? ' à grande échelle' : ' at Scale'}
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {isFr
                  ? "Nous transformons des systèmes existants en logiciels modernes et évolutifs, au service des communautés en santé, en droit, en assurance, en agriculture et au-delà. Notre infrastructure partagée accélère l'innovation tout en préservant une forte intégrité éthique, conformément aux normes sociales, environnementales et de gouvernance de la certification B Corp."
                  : 'We transform legacy platforms into modern, scalable software that serves communities across healthcare, legal systems, insurance, agriculture, and beyond. Our shared platform infrastructure powers innovation while maintaining ethical integrity - built to meet the rigorous social, environmental, and governance standards of B Corp certification.'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {(isFr
                  ? ['Pilote par les données', "Centre sur l'humain", 'Automatisation de confiance', 'Aligne B Corp']
                  : ['Data-Driven', 'Human-Centered', 'Trusted Automation', 'B Corp Aligned']).map((item) => (
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
                      <div className="text-xs text-gray-300">{isFr ? 'Gain de temps' : 'Time Savings'}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">80%+</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Reutilisation de code' : 'Code Reuse'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* ═══════════════════════ FLAGSHIP PLATFORMS ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Produits phares' : 'Flagship Products'}
            title={isFr ? 'Plateformes prêtes pour la production' : 'Production-Ready Platforms'}
            subtitle={isFr ? 'Quatre produits phares qui resolvent des problemes critiques avec une automatisation pragmatique' : 'Four flagship products solving critical problems with practical automation across diverse sectors'}
          />

          <div className="grid md:grid-cols-2 gap-6">
            {flagships.map((platform, i) => (
              <ScrollReveal key={platform.name} delay={i * 0.1}>
                <ImageCard src={platform.image} alt={platform.alt} aspect="video">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-electric/80 text-white">
                      {isFr ? 'Phare' : 'Flagship'}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                      {platform.vertical}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{platform.name}</h3>
                  <p className="text-gray-300 text-sm mb-3">{isFr ? (flagshipDescriptionFr[platform.name] ?? platform.description) : platform.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gold font-semibold">{platform.tam} {isFr ? 'taille du marché' : 'market size'}</span>
                  </div>
                </ImageCard>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="text-center mt-12">
            <TrackedLink
              href="/portfolio"
              eventName="cta_portfolio"
              eventProps={{ source: 'home_flagships' }}
              className="inline-flex items-center text-electric font-semibold hover:text-blue-700 text-lg"
            >
              {isFr ? `Voir ${MARKETING_FACTS.productPlatforms} plateformes produit ->` : `View ${MARKETING_FACTS.productPlatforms} Product Platforms ->`}
            </TrackedLink>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ INTELLIGENCE DIFFERENTIATOR ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Moteur d intelligence' : 'Intelligence Engine'}
            title={isFr ? 'Des insights pour chaque verticale' : 'The Insights Behind Every Vertical'}
            subtitle={isFr ? 'Modeles et automatisations concus pour produire des actions utiles sur toutes les plateformes' : 'Purpose-built models and automation powering actionable insights across all platforms'}
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
            badge={isFr ? 'Couverture de marché' : 'Market Reach'}
            title={isFr ? '10+ industries stratégiques' : '10+ Strategic Industries'}
            subtitle={isFr ? 'Notre portefeuille couvre des secteurs divers, chacun alimente par une technologie concue pour son domaine' : 'Our portfolio spans diverse sectors, each powered by purpose-built technology'}
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
            badge={isFr ? 'Propriété intellectuelle' : 'Intellectual Property'}
            title={isFr ? 'Avantage a long terme' : 'Long-Term Advantage'}
            subtitle={isFr ? 'Des années d expertise metier encodees dans des modèles, systemes de données et secrets commerciaux proprietaires' : 'Years of domain expertise encoded into proprietary models, data systems, and trade secrets'}
            light
          />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { value: '$5.7M-$7.5M', label: isFr ? 'Valeur du portefeuille PI' : 'IP Portfolio Value', color: 'from-electric to-violet' },
              { value: isFr ? 'Proprietaire' : 'Proprietary', label: isFr ? 'Bibliotheque de prompts de decision' : 'Decision Prompt Library', color: 'from-gold to-gold-light' },
              { value: '12,000+', label: isFr ? 'Entités de base de données' : 'Database Entities', color: 'from-emerald to-cyan-400' },
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








