import type { Metadata } from 'next';
import Image from 'next/image';
import ScrollReveal from '@/components/public/ScrollReveal';
import AnimatedCounter from '@/components/public/AnimatedCounter';
import SectionHeading from '@/components/public/SectionHeading';
import InvestorCTA from '@/components/public/InvestorCTA';

export const metadata: Metadata = {
  title: 'Verticals',
  description: '10+ strategic verticals — Fintech, Healthtech, Agrotech, Legaltech, EdTech, Uniontech, and more. Each powered by purpose-built AI.',
  openGraph: {
    title: 'Nzila Ventures Verticals',
    description: 'AI-powered platforms across 10+ strategic verticals.',
    images: [{ url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Technology conference audience in a large auditorium with stage lighting' }],
  },
  alternates: { canonical: '/verticals' },
};

const verticals = [
  {
    name: 'Fintech',
    photo: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    alt: 'Financial trading terminal with stock charts and candlestick patterns',
    platforms: ['DiasporaCore V2', 'STSA / Lexora', 'Insight CFO'],
    description: 'Banking, payments, stress testing, and virtual CFO services for individuals and enterprises.',
    tam: '$100B+', entities: '617', status: '3 platforms',
  },
  {
    name: 'Agrotech',
    photo: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800',
    alt: 'Aerial view of green agricultural farmland with organized crop rows',
    platforms: ['CORA', 'PonduOps'],
    description: 'Farm management, supply chain, IoT integration, and agricultural market intelligence.',
    tam: '$8.6B', entities: '300', status: '2 platforms',
  },
  {
    name: 'Uniontech',
    photo: 'https://images.unsplash.com/photo-1529070538774-1795d8de2dff?w=800',
    alt: 'Labor union workers raising hands together in solidarity',
    platforms: ['Union Eyes'],
    description: 'Union management, pension forecasting, grievance tracking, and labor organizing.',
    tam: '$50B', entities: '4,773', status: 'Flagship',
  },
  {
    name: 'Legaltech',
    photo: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800',
    alt: 'Scales of justice on a desk alongside legal reference books',
    platforms: ['Court Lens', 'ABR Insights'],
    description: 'Case management, legal AI, tribunal databases, and eDiscovery services.',
    tam: '$13B+', entities: '814', status: '2 platforms',
  },
  {
    name: 'EdTech',
    photo: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800',
    alt: 'Students engaged in collaborative learning with digital devices',
    platforms: ['ABR Insights', 'CyberLearn'],
    description: 'Learning management, certification, cybersecurity training, and gamified education.',
    tam: '$13B+', entities: '162', status: '2 platforms',
  },
  {
    name: 'Commerce',
    photo: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    alt: 'Customer completing a digital payment at a modern retail checkout',
    platforms: ['Shop Quoter', 'Trade OS', 'eExports'],
    description: 'E-commerce, logistics, trade operations, and export documentation.',
    tam: '$25B', entities: '508', status: '3 platforms',
  },
  {
    name: 'Entertainment',
    photo: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
    alt: 'DJ performing live with colorful stage lights and sound equipment',
    platforms: ['CongoWave'],
    description: 'Music streaming, royalty management, event ticketing, and content distribution.',
    tam: '$50B', entities: '83', status: 'Production Ready',
  },
  {
    name: 'Healthtech',
    photo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
    alt: 'Healthcare professional using a digital tablet for patient diagnostics',
    platforms: ['Memora'],
    description: 'Cognitive wellness, dementia care, caregiver support, and health monitoring.',
    tam: '$20B', entities: '150', status: 'Legacy',
  },
  {
    name: 'Insurtech',
    photo: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800',
    alt: 'Business professional signing insurance policy documents at a desk',
    platforms: ['SentryIQ360'],
    description: 'Insurance arbitrage, underwriting AI, policy lifecycle, and claims intelligence.',
    tam: '$30B', entities: '79', status: 'In Development',
  },
  {
    name: 'Justice',
    photo: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=800',
    alt: 'Symbolic raised fist representing social justice and equity advocacy',
    platforms: ['ABR Insights'],
    description: 'Anti-racism training, DEI analytics, and equity impact measurement.',
    tam: '$1.5B', entities: '132', status: 'Production Ready',
  },
];

export default function Verticals() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920"
          alt="Technology conference audience in a large auditorium with dramatic stage lighting"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/20 text-gold mb-6">
              Market Coverage
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              10+ Strategic Verticals
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Diverse sectors united by a common mission: building ethical AI technology that
              serves real human needs across healthcare, finance, justice, and beyond.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ STATS BAR ═══════════════════════ */}
      <section className="bg-navy py-8 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-10 text-center">
          {[
            { value: 15, suffix: '', label: 'Platforms' },
            { value: 10, suffix: '+', label: 'Verticals' },
            { value: 100, prefix: '$', suffix: 'B+', label: 'TAM' },
            { value: 12000, suffix: '+', label: 'Entities' },
          ].map((s) => (
            <div key={s.label}>
              <span className="text-3xl font-bold gradient-text">
                <AnimatedCounter target={s.value} prefix={s.prefix} suffix={s.suffix} />
              </span>
              <span className="text-gray-400 ml-2 text-sm">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ VERTICALS GRID ═══════════════════════ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {verticals.map((v, i) => (
              <ScrollReveal key={v.name} delay={i * 0.05}>
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover-lift h-full flex flex-col">
                  {/* Photo header */}
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={v.photo}
                      alt={v.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">{v.name}</h2>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white">
                          {v.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-gray-600 mb-4">{v.description}</p>

                    <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-lg font-bold text-electric">{v.platforms.length}</div>
                        <div className="text-xs text-gray-500">Platforms</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-lg font-bold text-navy">{v.entities}</div>
                        <div className="text-xs text-gray-500">Entities</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2">
                        <div className="text-sm font-bold text-gold">{v.tam}</div>
                        <div className="text-xs text-gray-500">TAM</div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4 mt-auto">
                      <h3 className="font-semibold text-navy text-sm mb-2">Platforms</h3>
                      <div className="flex flex-wrap gap-2">
                        {v.platforms.map((p) => (
                          <span key={p} className="text-xs px-3 py-1 bg-electric/5 text-electric rounded-full font-medium">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CROSS-VERTICAL IMPACT ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Synergies"
            title="Cross-Vertical Impact"
            subtitle="Our unified Backbone infrastructure enables powerful synergies across every vertical"
          />

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { value: 80, suffix: '%+', label: 'Code Reuse', sub: 'Shared services across verticals' },
              { value: 56, suffix: '%', label: 'Time Savings', sub: 'Through Backbone migration' },
              { value: 5.7, prefix: '$', suffix: 'M', label: 'IP Value', sub: 'Trade secrets & patents' },
              { value: 200, suffix: '+', label: 'AI Prompts', sub: 'Companion Engine library' },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 0.1}>
                <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                  <div className="text-4xl font-bold gradient-text mb-2">
                    <AnimatedCounter target={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </div>
                  <div className="font-semibold text-navy">{stat.label}</div>
                  <p className="text-sm text-gray-500 mt-1">{stat.sub}</p>
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
