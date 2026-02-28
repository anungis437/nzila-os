import type { Metadata } from 'next';
import Image from 'next/image';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import InvestorCTA from '@/components/public/InvestorCTA';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Our portfolio of 15 AI-powered platforms across 10+ verticals — from Union Eyes in labor rights to DiasporaCore in fintech.',
  openGraph: {
    title: 'Nzila Ventures Products',
    description: '15 AI-powered platforms. 4 flagships. One unified Backbone.',
    images: [{ url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'AI neural network visualization representing Nzila Ventures product suite' }],
  },
  alternates: { canonical: '/products' },
};

const flagships = [
  {
    name: 'Union Eyes',
    vertical: 'Uniontech',
    status: 'Flagship',
    tam: '$50B',
    entities: '4,773',
    image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800',
    alt: 'Union Eyes — comprehensive union management platform for pension forecasting and labor analytics',
    description: 'The most comprehensive union management platform — pension forecasting, grievance tracking, member analytics, and labor organizing tools for 4,773 entities.',
    features: ['Pension Forecasting', 'Grievance Tracking', 'Collective Bargaining AI', 'Member Analytics'],
  },
  {
    name: '3CUO / DiasporaCore',
    vertical: 'Fintech',
    status: 'Flagship',
    tam: '$100B',
    entities: '485',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    alt: 'DiasporaCore — diaspora banking platform for multi-currency remittances and community lending',
    description: 'Full-stack diaspora banking platform — KYC/AML compliance, multi-currency remittances, savings groups, and community lending across 485 financial entities.',
    features: ['KYC/AML Engine', 'Multi-Currency Transfers', 'Savings Groups', 'Community Lending'],
  },
  {
    name: 'ABR Insights',
    vertical: 'EdTech / Legaltech',
    status: 'Production Ready',
    tam: '$1.5B',
    entities: '132',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800',
    alt: 'ABR Insights — anti-bias research platform with AI coaching and tribunal case database',
    description: 'Anti-bias research and educational insights — LMS, tribunal case database, AI coaching, and DEI analytics powering 132 curated entities.',
    features: ['AI Coach', 'Tribunal Database', 'DEI Analytics', 'Custom LMS'],
  },
  {
    name: 'CORA',
    vertical: 'Agrotech',
    status: 'Beta',
    tam: '$8.6B',
    entities: '80+',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
    alt: 'CORA — AI-powered agricultural management platform with farm planning and IoT integration',
    description: 'Agricultural management and supply-chain intelligence built on verified Canadian agricultural data — farm planning, crop management, IoT integration, and market intelligence.',
    features: ['Farm Planning (CA Data)', 'Supply Chain', 'IoT Integration', 'Market Intelligence'],
  },
];

const pipeline = [
  { name: 'CongoWave', vertical: 'Entertainment', tam: '$50B', entities: '83+', status: 'Production Ready' },
  { name: 'SentryIQ360', vertical: 'Insurtech', tam: '$30B', entities: '79+', status: 'In Development' },
  { name: 'Court Lens', vertical: 'Legaltech', tam: '$12B', entities: '682', status: 'In Development' },
  { name: 'CyberLearn', vertical: 'EdTech', tam: '$8B', entities: '30+', status: 'In Development' },
  { name: 'Shop Quoter', vertical: 'Commerce', tam: '$5B', entities: '93', status: 'In Development' },
  { name: 'Trade OS', vertical: 'Trade', tam: '$15B', entities: '337', status: 'In Development' },
  { name: 'eExports', vertical: 'Trade', tam: '$3B', entities: '78', status: 'Django PoC' },
  { name: 'PonduOps', vertical: 'Agrotech (DRC/CA)', tam: '$8B', entities: '220', status: 'In Development' },
  { name: 'Insight CFO', vertical: 'Fintech', tam: '$2B', entities: '37', status: 'In Development' },
  { name: 'STSA / Lexora', vertical: 'Fintech', tam: '$5B', entities: '95', status: 'In Development' },
  { name: 'Memora', vertical: 'Healthtech', tam: '$20B', entities: '150', status: 'Legacy' },
];

function getStatusStyle(status: string) {
  if (status === 'Production Ready') return 'bg-emerald/10 text-emerald';
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
          alt="AI neural network with glowing nodes and connections representing advanced machine learning"
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
              15 AI-powered platforms across 10+ verticals — each built on the Nzila Backbone.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ FLAGSHIP PRODUCTS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Flagships"
            title="Revenue-Ready Platforms"
            subtitle="Our four flagship products are production-grade AI platforms addressing massive market opportunities"
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
                      <span className="font-bold text-gold">{product.tam} TAM</span>
                      <span className="font-semibold text-electric">{product.entities} entities</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PIPELINE ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Pipeline"
            title="Growing Portfolio"
            subtitle="11 additional platforms at various stages of development"
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
                    <span className="text-gray-400">{product.entities} entities</span>
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
