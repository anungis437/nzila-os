import type { Metadata } from 'next';
import Image from 'next/image';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import TrackedLink from '@/components/public/TrackedLink';
import { MARKETING_FACTS, governedCoverageLabel, platformCoverageLabel } from '@/lib/marketing-facts';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Portfolio',
  description: `${platformCoverageLabel()}, ${governedCoverageLabel()}. Explore the full Nzila Ventures portfolio.`,
  openGraph: {
    title: 'Nzila Ventures Portfolio',
    description: `${MARKETING_FACTS.productPlatforms} product platforms, ${MARKETING_FACTS.governedApplications} governed applications, 12,000+ data entities, ${MARKETING_FACTS.totalTamLabel} TAM.`,
    images: [{ url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Data analytics dashboard with glowing charts and metrics' }],
  },
  alternates: { canonical: '/portfolio' },
};

const platforms = [
  { name: 'UnionEyes', vertical: 'Uniontech', orgs: '4,773', complexity: 'EXTREME', readiness: 9.5, status: 'Flagship', tam: '$50B', description: 'Union management, pension forecasting, grievance tracking' },
  { name: 'FAIRCASE', vertical: 'Justice/Legaltech', orgs: '132', complexity: 'EXTREME', readiness: 9.2, status: 'Flagship', tam: '$1.5B+', description: 'Institutional anti-racism governance, tribunal intelligence, and evidence-ready remediation workflows' },
  { name: '3CUO / DiasporaCore', vertical: 'Fintech', orgs: '485', complexity: 'EXTREME', readiness: 6.5, status: 'Flagship', tam: '$100B', description: 'Diaspora banking, KYC/AML, international transfers' },
  { name: 'Zonga', vertical: 'Entertainment', orgs: '83+', complexity: 'HIGH-EXTREME', readiness: 10.0, status: 'Production Ready', tam: '$50B', description: 'Music streaming, royalty management, event ticketing' },
  { name: 'SentryIQ360', vertical: 'Insurtech', orgs: '79+', complexity: 'HIGH-EXTREME', readiness: 7.0, status: 'In Development', tam: '$30B', description: 'Insurance arbitrage, underwriting AI, policy lifecycle' },
  { name: 'Court Lens', vertical: 'Legaltech', orgs: '682', complexity: 'HIGH', readiness: 6.0, status: 'In Development', tam: '$12B', description: 'Legal AI, case management, eDiscovery' },
  { name: 'CORA', vertical: 'Agrotech', orgs: '80+', complexity: 'HIGH', readiness: 7.0, status: 'Flagship (Beta)', tam: '$8.6B', description: 'Farm management, supply chain, market intelligence' },
  { name: 'CyberLearn', vertical: 'EdTech', orgs: '30+', complexity: 'HIGH', readiness: 7.5, status: 'In Development', tam: '$8B', description: 'Cybersecurity training, Docker labs, CTF challenges' },
  { name: 'Flow', vertical: 'Commerce', orgs: '500+', complexity: 'HIGH-EXTREME', readiness: 9.0, status: 'Production Ready', tam: '$100B+', description: 'Order-to-cash, procure-to-pay, and AI-assisted quoting with enterprise intégrations' },
  { name: 'Trade OS', vertical: 'Trade', orgs: '337', complexity: 'MEDIUM-HIGH', readiness: 6.5, status: 'In Development', tam: '$15B', description: 'Trade operations, multi-carrier logistics, customs' },
  { name: 'eExports', vertical: 'Trade', orgs: '78', complexity: 'MEDIUM-HIGH', readiness: 8.0, status: 'Django PoC', tam: '$3B', description: 'Export documentation, compliance, shipment tracking' },
  { name: 'AgrimoOps', vertical: 'Agrotech', orgs: '220', complexity: 'HIGH', readiness: 7.0, status: 'In Development', tam: '$8B', description: 'Supply chain ERP, crop planning, IoT intégration' },
  { name: 'Insight CFO', vertical: 'Fintech', orgs: '37', complexity: 'HIGH', readiness: 6.0, status: 'In Development', tam: '$2B', description: 'Virtual CFO, accounting, QuickBooks/Xero intégration' },
  { name: 'STSA / Lexora', vertical: 'Fintech', orgs: '95', complexity: 'HIGH', readiness: 6.0, status: 'In Development', tam: '$5B', description: 'Banking stress testing, Basel III/IV compliance' },
  { name: 'Memora', vertical: 'Healthtech', orgs: '150', complexity: 'MEDIUM', readiness: 5.0, status: 'Legacy', tam: '$20B', description: 'Cognitive wellness, dementia care, caregiver support' },
];

function getComplexityStyle(complexity: string) {
  if (complexity === 'EXTREME') return 'bg-coral/10 text-coral';
  if (complexity === 'HIGH-EXTREME') return 'bg-orange-100 text-orange-600';
  if (complexity === 'HIGH') return 'bg-gold/10 text-gold';
  if (complexity === 'MEDIUM-HIGH') return 'bg-emerald/10 text-emerald';
  return 'bg-gray-100 text-gray-600';
}

function getStatusStyle(status: string) {
  if (status.includes('Production Ready')) return 'bg-emerald/10 text-emerald';
  if (status.includes('Flagship')) return 'bg-electric/10 text-electric';
  if (status.includes('Beta')) return 'bg-violet/10 text-violet';
  if (status.includes('Django')) return 'bg-violet/10 text-violet';
  return 'bg-gray-100 text-gray-500';
}

function getReadinessColor(readiness: number) {
  if (readiness >= 9) return 'bg-emerald';
  if (readiness >= 7) return 'bg-electric';
  if (readiness >= 5) return 'bg-gold';
  return 'bg-coral';
}

const statusFr: Record<string, string> = {
  Flagship: 'Phare',
  'Production Ready': 'Pret pour production',
  'In Development': 'En developpement',
  'Flagship (Beta)': 'Phare (Beta)',
  Legacy: 'Legacy',
  'Django PoC': 'Django PoC',
};

const complexityFr: Record<string, string> = {
  EXTREME: 'EXTREME',
  'HIGH-EXTREME': 'ELEVE-EXTREME',
  HIGH: 'ELEVE',
  'MEDIUM-HIGH': 'MOYEN-ELEVE',
};

export default async function Portfolio() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920"
          alt="Data analytics dashboard displaying colorful charts, graphs, and key performance metrics"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-50" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              {isFr ? 'Portefeuille complet' : 'Full Portfolio'}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">{isFr ? 'Portefeuille plateformes' : 'Platform Portfolio'}</h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              {isFr
                ? `${MARKETING_FACTS.productPlatforms} plateformes produit sur ${MARKETING_FACTS.verticalsLabel} verticales, livrees via ${MARKETING_FACTS.governedApplications} applications gouvernées sur une Backbone intelligente.`
                : `${MARKETING_FACTS.productPlatforms} product platforms across ${MARKETING_FACTS.verticalsLabel} verticals, delivered through ${MARKETING_FACTS.governedApplications} governed applications on one intelligent Backbone.`}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { value: '$4M+', label: isFr ? 'Investissement ingénierie' : 'Engineering Investment' },
                { value: '56%', label: isFr ? 'Gain de temps' : 'Time Savings' },
                { value: '$100B+', label: isFr ? 'TAM total' : 'Total TAM' },
              ].map((stat) => (
                <div key={stat.label} className="glass-card rounded-xl px-5 py-3">
                  <span className="font-bold text-white">{stat.value}</span>
                  <span className="text-gray-300 text-sm ml-2">{stat.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ COMPLEXITY LEGEND ═══════════════════════ */}
      <section className="py-6 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            {[
              { color: 'bg-coral', label: isFr ? complexityFr.EXTREME : 'EXTREME' },
              { color: 'bg-orange-500', label: isFr ? complexityFr['HIGH-EXTREME'] : 'HIGH-EXTREME' },
              { color: 'bg-gold', label: isFr ? complexityFr.HIGH : 'HIGH' },
              { color: 'bg-emerald', label: isFr ? complexityFr['MEDIUM-HIGH'] : 'MEDIUM-HIGH' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`w-3 h-3 ${item.color} rounded-full`} />
                <span className="text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PLATFORM GRID ═══════════════════════ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {platforms.map((platform, i) => (
              <ScrollReveal key={platform.name} delay={i * 0.04}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 hover-lift h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-navy">{platform.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getComplexityStyle(platform.complexity)}`}>
                      {isFr ? (complexityFr[platform.complexity] ?? platform.complexity) : platform.complexity}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium px-2 py-1 bg-gray-50 text-gray-600 rounded">
                      {platform.vertical}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusStyle(platform.status)}`}>
                      {isFr ? (statusFr[platform.status] ?? platform.status) : platform.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 flex-1">{platform.description}</p>

                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-electric">{platform.orgs}</div>
                      <div className="text-xs text-gray-500">{isFr ? 'Entités' : 'Entities'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-navy">{platform.readiness}/10</div>
                      <div className="text-xs text-gray-500">{isFr ? 'Maturite' : 'Readiness'}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-sm font-bold text-gold">{platform.tam}</div>
                      <div className="text-xs text-gray-500">TAM</div>
                    </div>
                  </div>

                  {/* Readiness bar */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`${getReadinessColor(platform.readiness)} h-full rounded-full transition-all duration-1000`}
                      style={{ width: `${platform.readiness * 10}%` }}
                    />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ MIGRATION ROADMAP ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Feuille de route' : 'Roadmap'}
            title={isFr ? 'Parcours de migration' : 'Migration Journey'}
            subtitle={isFr ? 'Approche par phases pour unifier les 15 plateformes produit et 17 applications gouvernées sur la Backbone partagée' : 'Phased approach to unifying all 15 product platforms and 17 governed applications onto the shared Backbone'}
            light
          />

          <div className="grid md:grid-cols-4 gap-4 mb-8">
            {[
              { phase: 'Phase 1', title: isFr ? 'Fondation' : 'Foundation', weeks: isFr ? '16 semaines' : '16 weeks', detail: isFr ? 'Coeur Backbone' : 'Backbone core', color: 'from-electric to-blue-700' },
              { phase: 'Phase 2-3', title: 'Django PoC', weeks: isFr ? '20 semaines' : '20 weeks', detail: 'eExports, UnionEyes', color: 'from-violet to-purple-700' },
              { phase: 'Phase 4-7', title: isFr ? 'Passage a l echelle' : 'Scale', weeks: isFr ? '100 semaines' : '100 weeks', detail: 'Fintech, EdTech, Commerce', color: 'from-gold to-amber-700' },
              { phase: 'Phase 8', title: isFr ? 'Complet' : 'Complété', weeks: isFr ? '16 semaines' : '16 weeks', detail: isFr ? 'Agrotech, consolidation' : 'Agrotech, Consolidate', color: 'from-emerald to-green-700' },
            ].map((phase, i) => (
              <ScrollReveal key={phase.phase} delay={i * 0.1}>
                <div className={`rounded-2xl p-6 bg-linear-to-br ${phase.color} text-white`}>
                  <div className="text-sm font-semibold opacity-80 mb-1">{phase.phase}</div>
                  <div className="text-xl font-bold mb-1">{phase.title}</div>
                  <div className="text-sm opacity-90 mb-2">{phase.weeks}</div>
                  <div className="text-xs opacity-70">{phase.detail}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-300 p-5 bg-white/5 rounded-2xl border border-white/10">
              <div className="mt-2 sm:mt-0">
                <span><strong className="text-white">{isFr ? 'Chronologie totale:' : 'Total Timeline:'}</strong> {isFr ? '175 semaines (~40 mois) en sequence' : '175 weeks (~40 months) sequential'}</span>
              </div>
              <div className="mt-2 sm:mt-0">
                <strong className="text-white">{isFr ? 'En parallele (3 équipes):' : 'Parallel (3 teams):'}</strong> ~15 {isFr ? 'mois' : 'months'}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <section className="py-16 bg-white text-center">
        <ScrollReveal>
          <TrackedLink
            href="/verticals"
            eventName="cta_verticals"
            eventProps={{ source: 'portfolio_bottom' }}
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg"
          >
            {isFr ? 'Explorer les verticales ->' : 'Explore Verticals ->'}
          </TrackedLink>
        </ScrollReveal>
      </section>
    </main>
  );
}







