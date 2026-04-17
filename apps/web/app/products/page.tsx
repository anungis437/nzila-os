import type { Metadata } from 'next';
import Image from 'next/image';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import InvestorCTA from '@/components/public/InvestorCTA';
import { MARKETING_FACTS, governedCoverageLabel, platformCoverageLabel } from '@/lib/marketing-facts';

export const metadata: Metadata = {
  title: 'Products',
  description: `Our portfolio of ${MARKETING_FACTS.productPlatforms} products and ${MARKETING_FACTS.governedApplications} live tools across UnionEyes, Zonga, Flow, and Agrimo.`,
  openGraph: {
    title: 'Nzila Ventures Products',
    description: `${MARKETING_FACTS.productPlatforms} products. ${MARKETING_FACTS.flagshipPlatforms} flagships. ${MARKETING_FACTS.governedApplications} live tools. One shared platform.`,
    images: [{ url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Digital network visualization representing Nzila Ventures product suite' }],
  },
  alternates: { canonical: '/products' },
};

const flagships = [
  {
    name: 'UnionEyes',
    vertical: 'Uniontech',
    status: 'Production Ready',
    tam: '$50B',
    orgs: '4,773',
    image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
    alt: 'UnionEyes — comprehensive union management platform for pension forecasting and labor analytics',
    description: 'Full-stack union case management platform — pension forecasting, grievance lifecycle, collective bargaining analysis, CBA intelligence, and evidence-sealed audit trails for 4,773+ organizations.',
    features: ['Pension Forecasting', 'Grievance Lifecycle', 'CBA Intelligence', 'Evidence-Sealed Audit Trails'],
  },
  {
    name: 'Zonga',
    vertical: 'Music & Creator Economy',
    status: 'Production Ready',
    tam: '$20B+',
    orgs: '1000+',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    alt: 'Zonga — African music platform for artists, streaming, and creator royalties',
    description: 'Africa-first music distribution and streaming platform — artist onboarding, catalog management, playlist curation, royalty calculation, and transparent payouts for thousands of creators.',
    features: ['Artist Onboarding', 'Release Management', 'Royalty Engine', 'Streaming Analytics'],
  },
  {
    name: 'Flow',
    vertical: 'Commerce & Operations',
    status: 'Production Ready',
    tam: '$100B+',
    orgs: '500+',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    alt: 'Flow — enterprise order-to-cash and supply chain management platform',
    description: 'Complete commerce operations platform — order-to-cash, procure-to-pay, inventory management, production tracking, and integrations with Shopify, Zoho, WhatsApp, and ERP systems.',
    features: ['Order Management', 'Inventory & Warehouse', 'Production Tracking', 'Multi-Channel Integrations'],
  },
  {
    name: 'Agrimo',
    vertical: 'Agriculture & Supply Chain',
    status: 'Production Ready',
    tam: '$8B',
    orgs: '220+',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
    alt: 'Agrimo — agricultural field operations and supply chain management',
    description: 'Agricultural supply chain and operations platform — harvest tracking, lot management, quality grading, warehousing, cold-chain logistics, traceability, and farmer payouts for DRC and Central African producers.',
    features: ['Harvest Tracking', 'Lot Management', 'Warehouse Operations', 'Supply Chain Traceability'],
  },
];

const pipeline = [
  { name: 'CORA', vertical: 'Agricultural Intelligence', tam: '$8.6B', orgs: '80+', status: 'Production Ready' },
  { name: '3CUO / DiasporaCore', vertical: 'Fintech', tam: '$100B', orgs: '485', status: 'Production Ready' },
  { name: 'ABR Insights', vertical: 'Compliance & Audit', tam: '$1.5B', orgs: '132', status: 'Production Ready' },
  { name: 'Zonga', vertical: 'Entertainment', tam: '$50B', orgs: '83+', status: 'Production Ready' },
  { name: 'SentryIQ360', vertical: 'Insurtech', tam: '$30B', orgs: '79+', status: 'In Development' },
  { name: 'Court Lens', vertical: 'Legaltech', tam: '$12B', orgs: '682', status: 'In Development' },
  { name: 'Trade OS', vertical: 'Commerce', tam: '$15B', orgs: '337', status: 'Beta' },
  { name: 'Insight CFO', vertical: 'Fintech', tam: '$2B', orgs: '37', status: 'In Development' },
  { name: 'Flow', vertical: 'Commerce', tam: '$100B+', orgs: '500+', status: 'Production Ready' },
  { name: 'CyberLearn', vertical: 'EdTech', tam: '$8B', orgs: '30+', status: 'In Development' },
  { name: 'Memora', vertical: 'Healthtech', tam: '$20B', orgs: '150', status: 'Legacy' },
];

function getStatusStyle(status: string) {
  if (status === 'Production Ready') return 'bg-emerald/10 text-emerald';
  if (status === 'Beta') return 'bg-violet/10 text-violet';
  if (status === 'In Development') return 'bg-electric/10 text-electric';
  if (status === 'Django PoC') return 'bg-violet/10 text-violet';
  if (status === 'Migrating') return 'bg-gold/10 text-gold';
  return 'bg-gray-100 text-gray-600';
}

export default function ProductsPage() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1920"
          alt="Digital network with glowing nodes and connections representing modern software systems"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-50" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric mb-6">
              Product Portfolio
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">Our Products</h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              {MARKETING_FACTS.productPlatforms} products across {MARKETING_FACTS.verticalsLabel} industries - delivered through {MARKETING_FACTS.governedApplications} live tools on the Nzila shared platform.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ FLAGSHIP PRODUCTS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Four Core Platforms"
            title="Our Main Product Suite"
            subtitle="Production-grade platforms across uniontech, music, commerce, and agriculture — serving thousands of organizations globally"
          />

          <div className="space-y-8">
            {flagships.map((product, i) => (
              <ScrollReveal key={product.name} delay={i * 0.1}>
                <div className="grid lg:grid-cols-5 gap-6 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 hover-lift">
                  <div className="lg:col-span-2 relative min-h-62.5">
                    <Image
                      src={product.image}
                      alt={product.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                    />
                    <div className="absolute inset-0 bg-linear-to-r from-transparent to-black/20 lg:bg-linear-to-r lg:from-transparent lg:to-gray-50" />
                  </div>
                  <div className="lg:col-span-3 p-6 lg:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-electric/10 text-electric">
                        {product.status}
                      </span>
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        {product.vertical}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-navy mb-2">{product.name}</h3>
                    <p className="text-gray-600 mb-4">{product.description}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {product.features.map((f) => (
                        <span key={f} className="px-3 py-1 text-xs font-medium bg-white rounded-full border border-gray-200 text-gray-700">
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="font-bold text-gold">{product.tam} market size</span>
                      <span className="font-semibold text-electric">{product.orgs} orgs</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ EXTENDED PORTFOLIO ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Extended Portfolio"
            title="Growing Ecosystem"
            subtitle="11 complementary products — production-ready, in development, and specialized solutions that extend the Nzila shared platform"
            light
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipeline.map((product, i) => (
              <ScrollReveal key={product.name} delay={i * 0.05}>
                <div className="bg-white/5 rounded-xl p-5 border border-white/10 hover-lift">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-white">{product.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyle(product.status)}`}>
                      {product.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{product.vertical}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gold font-semibold">{product.tam}</span>
                    <span className="text-gray-400">{product.orgs} orgs</span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}
