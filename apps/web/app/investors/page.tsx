import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import TechStackBar from '@/components/public/TechStackBar';
import TrackedLink from '@/components/public/TrackedLink';
import { MARKETING_FACTS, platformCoverageLabel, portfolioHeadlineLabel } from '@/lib/marketing-facts';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Investors',
  description: `Series A investment opportunity - ${MARKETING_FACTS.totalTamLabel} market size, ${MARKETING_FACTS.productPlatforms} products, ${MARKETING_FACTS.governedApplications} live tools, and one shared platform.`,
  openGraph: {
    title: 'Invest in Nzila Ventures',
    description: `${MARKETING_FACTS.totalTamLabel} market size. ${MARKETING_FACTS.productPlatforms} products. ${MARKETING_FACTS.governedApplications} live tools.`,
    images: [{ url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Modern glass skyscraper reaching skyward — representing growth and investment ambition' }],
  },
  alternates: { canonical: '/investors' },
};

const keyMetrics = [
  { label: 'Total Market Size', value: '$100B+', color: 'text-gold' },
  { label: 'Products', value: String(MARKETING_FACTS.productPlatforms), color: 'text-electric' },
  { label: 'Live Tools', value: String(MARKETING_FACTS.governedApplications), color: 'text-violet' },
  { label: 'Industries', value: MARKETING_FACTS.verticalsLabel, color: 'text-violet' },
  { label: 'IP Portfolio Value', value: '$5.7M–$7.5M', color: 'text-emerald' },

];

const flagships = [
  { name: 'UnionEyes', vertical: 'Uniontech', tam: '$50B', stage: 'Production', description: 'Comprehensive union operations platform — pension forecasting, grievance tracking, and analytics at enterprise scale.' },
  { name: 'Zonga', vertical: 'Music & Creator Economy', tam: '$20B+', stage: 'Production', description: 'Africa-first music distribution and streaming platform with catalog workflows and transparent creator royalty payouts.' },
  { name: 'Flow', vertical: 'Commerce & Operations', tam: '$100B+', stage: 'Production', description: 'Order-to-cash and commerce operations platform with inventory, production, and multi-channel execution flows.' },
  { name: 'Agrimo', vertical: 'Agriculture & Supply Chain', tam: '$8B', stage: 'Production', description: 'Agricultural supply-chain and field operations platform with harvest tracking, quality workflows, and traceability.' },
];

const useOfFunds = [
  { category: 'Engineering & Product R&D', percent: 40, color: 'bg-electric' },
  { category: 'Go-to-Market & Sales', percent: 25, color: 'bg-violet' },
  { category: 'Platform Infrastructure & Cloud', percent: 15, color: 'bg-emerald' },
  { category: 'Compliance & Legal', percent: 10, color: 'bg-gold' },
  { category: 'Working Capital', percent: 10, color: 'bg-coral' },
];

const timeline = [
  { year: '2019–2022', title: 'Foundation', description: 'Built core IP, a proprietary decision library, and pioneered union and diaspora banking technology.' },
  { year: '2023', title: 'Platform Expansion', description: 'Expanded to 15 products across 10 industries and 17 live tools. Shared platform architecture.' },
  { year: '2024', title: 'Migration & Scale', description: 'Legacy-to-cloud migration underway. UnionEyes 83% migrated. Production deployments on Azure.' },
  { year: '2025', title: 'Series A Ready', description: 'Revenue activation across flagships. $6M ARR target. Strategic partnerships pipeline.' },
];

const moats = [
  { title: 'Proprietary Data', description: 'A deeply curated proprietary data foundation across labor, finance, agriculture, and legal domains — difficult to replicate.' },
  { title: 'Proprietary Decision Systems', description: 'Purpose-built prompts and predictive models for social-impact verticals — proprietary and not available in off-the-shelf tools.' },
  { title: 'Multi-Vertical Network', description: 'Cross-pollination between 10+ verticals creates compounding defensibility and data flywheel effects.' },
  { title: 'First-Mover Advantage', description: 'Only platform company operating simultaneously across uniontech, diaspora banking, and agrotech.' },
];

const keyMetricFr: Record<string, string> = {
  'Total Market Size': 'Marché total',
  Products: 'Produits',
  'Live Tools': 'Outils en service',
  Industries: 'Industries',
  'IP Portfolio Value': 'Valeur portefeuille PI',

};

export default async function InvestorsPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920"
          alt="Glass skyscraper reaching into blue sky — symbolizing growth and investment ambition"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-50" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {isFr ? "Occasion d'investissement" : 'Investment Opportunity'}
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {isFr ? 'La plateforme qui alimente' : 'The Platform Powering'}<br />
              <span className="gradient-text">{isFr ? '100B+ de marchés' : '$100B+ in Markets'}</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mb-10">
              {isFr
                ? `${MARKETING_FACTS.productPlatforms} produits. ${MARKETING_FACTS.governedApplications} outils en service. Une plateforme partagée. Nzila Ventures est la couche d infrastructure pour la technologie à impact social en sante, finance, travail, agriculture et justice.`
                : `${MARKETING_FACTS.productPlatforms} products. ${MARKETING_FACTS.governedApplications} live tools. One shared platform. Nzila Ventures is the infrastructure layer for social-impact technology - healthcare, finance, labor, agriculture, and justice.`}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <TrackedLink
                href="/contact"
                eventName="cta_investment_deck"
                eventProps={{ source: 'investors_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-all text-lg shadow-lg shadow-gold/30"
              >
                {isFr ? 'Demander le deck investisseur' : 'Request Investment Deck'}
              </TrackedLink>
              <TrackedLink
                href="/portfolio"
                eventName="cta_portfolio"
                eventProps={{ source: 'investors_hero' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg"
              >
                {isFr ? 'Voir le portefeuille complet' : 'View Full Portfolio'}
              </TrackedLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ KEY METRICS ═══════════════════════ */}
      <section className="py-16 bg-navy-light relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {keyMetrics.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className={`text-2xl md:text-3xl font-bold ${metric.color} mb-1`}>
                  {metric.value}
                </div>
                <div className="text-xs text-gray-400 font-medium tracking-wider uppercase">
                  {isFr ? (keyMetricFr[metric.label] ?? metric.label) : metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ INVESTMENT THESIS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <SectionHeading
                badge={isFr ? "Thèse d'investissement" : 'Investment Thesis'}
                title={isFr ? 'Pourquoi Nzila Ventures ?' : 'Why Nzila Ventures?'}
                subtitle={isFr ? 'Une position unique et defensable dans les marchés les plus sous-desservis et a plus forte croissance de la prochaine decennie.' : 'A unique, defensible position in the most underserved and highest-growth markets of the next decade.'}
                align="left"
              />
              <div className="space-y-6 mt-8">
                {moats.map((moat) => (
                  <div key={moat.title} className="flex gap-4">
                    <div className="w-1.5 rounded-full bg-linear-to-b from-electric to-violet shrink-0" />
                    <div>
                      <h3 className="font-bold text-navy text-lg">{moat.title}</h3>
                      <p className="text-gray-600 text-sm">{moat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                <Image
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800"
                  alt="Data analytics dashboard with colorful charts showing portfolio performance"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-navy/60 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 glass-card rounded-xl p-4">
                  <div className="flex items-center gap-6 text-white">
                    <div>
                      <div className="text-2xl font-bold">$100B+</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Marché total' : 'Total Market Size'}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">{portfolioHeadlineLabel()}</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Plateformes / Applications' : 'Platforms / Apps'}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">4</div>
                      <div className="text-xs text-gray-300">{isFr ? 'Produits phares' : 'Flagships'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FLAGSHIP PORTFOLIO ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Portefeuille phare' : 'Flagship Portfolio'}
            title={isFr ? 'Quatre plateformes prêtes pour les revenus' : 'Four Revenue-Ready Platforms'}
            subtitle={isFr ? 'Chaque produit phare cible un marché majeur sous-desservi avec technologie et données proprietaires' : 'Each flagship addresses a massive, underserved market with proprietary technology and data'}
          />

          <div className="space-y-6">
            {flagships.map((platform, i) => (
              <ScrollReveal key={platform.name} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm hover-lift">
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-navy">{platform.name}</h3>
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-electric/10 text-electric">
                          {platform.stage}
                        </span>
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          {platform.vertical}
                        </span>
                      </div>
                      <p className="text-gray-600">{platform.description}</p>
                    </div>
                    <div className="flex gap-6 md:gap-8 text-center shrink-0">
                      <div>
                        <div className="text-2xl font-bold text-gold">{platform.tam}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">{isFr ? 'Marche' : 'Market'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TIMELINE ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Parcours' : 'Journey'}
            title={isFr ? "De la vision a l'exécution" : 'From Vision to Execution'}
            subtitle={isFr ? 'Cinq années de construction, curation de données et innovation produit' : 'Five years of relentless building, data curation, and product innovation'}
            light
          />

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-linear-to-b from-electric via-violet to-gold hidden md:block" />

            <div className="space-y-10">
              {timeline.map((milestone, i) => (
                <ScrollReveal key={milestone.year} delay={i * 0.15}>
                  <div className="flex gap-6 md:gap-10 items-start">
                    <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/20 shrink-0 z-10">
                      <span className="text-xs font-bold text-gold">{milestone.year.slice(0, 4)}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex-1">
                      <span className="text-sm text-gold font-semibold md:hidden">{milestone.year}</span>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {milestone.title} <span className="text-sm font-normal text-gray-400">• {milestone.year}</span>
                      </h3>
                      <p className="text-gray-400">{milestone.description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ USE OF FUNDS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Allocation du capital' : 'Capital Allocation'}
            title={isFr ? 'Utilisation proposee des fonds' : 'Proposed Use of Funds'}
            subtitle={isFr ? "Deploiement stratégique axe sur le levier ingénierie et l'exécution go-to-market" : 'Strategic deployment focused on engineering leverage and go-to-market execution'}
          />

          <div className="max-w-2xl mx-auto">
            <div className="space-y-5">
              {useOfFunds.map((item) => (
                <ScrollReveal key={item.category}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-navy">{item.category}</span>
                      <span className="font-bold text-navy">{item.percent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full transition-all duration-1000`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TECH STACK ═══════════════════════ */}
      <section className="py-16 bg-gray-50">
        <TechStackBar />
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920"
          alt="Earth at night with illuminated cities — Nzila global technology network"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-r from-navy/90 to-navy/80" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {isFr ? 'Prêt pour la Série A' : 'Series A Ready'}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {isFr ? 'Rejoignez la prochaine vague de' : 'Join the Next Wave of'}<br />{isFr ? 'technologie à impact social' : 'Social-Impact Technology'}
            </h2>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
              {isFr
                ? 'Nous recherchons activement des investisseurs et partenaires stratégiques qui partagent notre vision de construire une technologie éthique et impactante au service de milliards de personnes.'
                : 'We are actively seeking strategic investors and partners who share our vision of building ethical, impactful technology that serves billions.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-all text-lg shadow-lg shadow-gold/30"
              >
                {isFr ? 'Demander le deck investisseur' : 'Request Investment Deck'}
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg"
              >
                {isFr ? 'Decouvrir notre équipe' : 'Learn About Our Team'}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}









