import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import ScrollReveal from '@/components/public/ScrollReveal';
import AnimatedCounter from '@/components/public/AnimatedCounter';
import SectionHeading from '@/components/public/SectionHeading';
import ImageCard from '@/components/public/ImageCard';
import TechStackBar from '@/components/public/TechStackBar';
import InvestorCTA from '@/components/public/InvestorCTA';
import SectionDivider from '@/components/public/SectionDivider';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Nzila Ventures — venture studio building 15 AI-powered platforms across 10+ verticals. $100B+ TAM, 4 flagships, one unified Backbone. The APEX of AI in social impact.',
  openGraph: {
    title: 'Nzila Ventures | The APEX of AI in Social Impact',
    description: '15 AI-powered platforms across 10+ verticals. $100B+ TAM. Series A ready.',
    images: [{ url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Earth at night showing global AI connectivity — Nzila Ventures' }],
  },
  alternates: { canonical: '/' },
};

const verticals = [
  { name: 'Fintech', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', alt: 'Financial trading charts with candlestick patterns on dark screens', description: 'Banking, payments, insurance', tam: '$100B+' },
  { name: 'Agrotech', image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', alt: 'Aerial view of lush green agricultural farmland rows', description: 'Farm management, supply chain', tam: '$8.6B' },
  { name: 'Uniontech', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800', alt: 'Workers gathered in a professional labor meeting', description: 'Labor rights, union management', tam: '$50B' },
  { name: 'Legaltech', image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800', alt: 'Scales of justice on a desk with legal documents', description: 'Case management, legal AI', tam: '$13B+' },
  { name: 'EdTech', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800', alt: 'Students collaborating around laptops in a modern classroom', description: 'Learning, training, certification', tam: '$13B+' },
  { name: 'Entertainment', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800', alt: 'Musician performing live on stage under spotlight', description: 'Streaming, content platforms', tam: '$50B' },
  { name: 'Commerce', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800', alt: 'Customer completing a digital payment at retail checkout', description: 'Trade, logistics, gifting', tam: '$25B' },
  { name: 'Healthtech', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800', alt: 'Doctor using digital tablet for patient health records', description: 'Care, wellness, cognitive', tam: '$20B' },
  { name: 'Insurtech', image: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=800', alt: 'Business analyst reviewing insurance risk data on screens', description: 'Arbitrage, underwriting AI', tam: '$30B' },
  { name: 'Justice', image: 'https://images.unsplash.com/photo-1591291621164-2c6367723315?w=800', alt: 'Raised fist silhouette against sunset representing social justice advocacy', description: 'Advocacy, DEI training', tam: '$1.5B' },
];

const flagships = [
  { name: 'Union Eyes', vertical: 'Uniontech', image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800', alt: 'Union Eyes — comprehensive union management platform for 4,773 entities', entities: '4,773', tam: '$50B', description: 'Union management, pension forecasting, grievance tracking' },
  { name: 'ABR Insights', vertical: 'EdTech', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800', alt: 'ABR Insights — anti-racism learning management and AI coaching platform', entities: '132', tam: '$1.5B', description: 'Anti-racism LMS, tribunal case database, AI coach' },
  { name: 'CORA', vertical: 'Agrotech', image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', alt: 'CORA — AI-powered farm management and supply chain intelligence', entities: '80+', tam: '$8.6B', description: 'Farm management, supply chain, market intelligence' },
  { name: '3CUO / DiasporaCore', vertical: 'Fintech', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800', alt: 'DiasporaCore — diaspora banking and international transfer infrastructure', entities: '485', tam: '$100B', description: 'Diaspora banking, KYC/AML, international transfers' },
];

const aiCapabilities = [
  { name: 'Natural Language Processing', metric: '200+ prompts', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', alt: 'AI neural network processing natural language with glowing data nodes', description: 'Context-aware AI across legal, healthcare, and education' },
  { name: 'Predictive Analytics', metric: '512 models', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', alt: 'Predictive analytics dashboard with colorful data visualizations', description: 'Pension forecasting, crop yields, insurance risk scoring' },
  { name: 'Anomaly Detection', metric: 'Real-time', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800', alt: 'Real-time network monitoring console detecting anomalies', description: 'Fraud prevention, compliance monitoring, threat intelligence' },
  { name: 'Computer Vision', metric: 'Multi-modal', image: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800', alt: 'Computer vision system analyzing visual data with recognition overlays', description: 'Document processing, agricultural imaging, identity verification' },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920"
          alt="Earth at night showing illuminated cities and global AI connectivity networks"
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
              The APEX of AI in Social Impact
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              Building the Future<br />
              <span className="gradient-text">One Vertical at a Time</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              15 AI-powered platforms across 10+ verticals — healthcare, finance, 
              agriculture, labor rights, and justice. One unified Backbone.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                Explore Our Portfolio
              </Link>
              <Link
                href="/investors"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                For Investors
              </Link>
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
              { target: 15, suffix: '', label: 'AI Platforms' },
              { target: 10, suffix: '+', label: 'Verticals' },
              { target: 100, prefix: '$', suffix: 'B+', label: 'Total TAM' },
              { target: 12000, suffix: '+', label: 'Data Entities' },
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
                Our Mission
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                Infrastructure for <span className="text-electric">Social Impact</span> at Scale
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                We transform legacy platforms into modern, scalable AI solutions that serve 
                communities across healthcare, legal systems, insurance, agriculture, and beyond. 
                Our unified Backbone infrastructure powers innovation while maintaining ethical integrity.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {['Data-Driven', 'Human-Centered', 'Ethical AI', 'Global Impact'].map((item) => (
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
                      <div className="text-xs text-gray-300">Engineering Investment</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">56%</div>
                      <div className="text-xs text-gray-300">Time Savings</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">80%+</div>
                      <div className="text-xs text-gray-300">Code Reuse</div>
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
            badge="Flagship Products"
            title="Production-Ready AI Platforms"
            subtitle="Four flagship products solving critical problems with artificial intelligence across diverse sectors"
          />

          <div className="grid md:grid-cols-2 gap-6">
            {flagships.map((platform, i) => (
              <ScrollReveal key={platform.name} delay={i * 0.1}>
                <ImageCard src={platform.image} alt={platform.alt} aspect="video">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-electric/80 text-white">
                      Flagship
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                      {platform.vertical}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{platform.name}</h3>
                  <p className="text-gray-300 text-sm mb-3">{platform.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white font-semibold">{platform.entities} entities</span>
                    <span className="text-gold font-semibold">{platform.tam} TAM</span>
                  </div>
                </ImageCard>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="text-center mt-12">
            <Link
              href="/portfolio"
              className="inline-flex items-center text-electric font-semibold hover:text-blue-700 text-lg"
            >
              View All 15 Platforms →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ AI DIFFERENTIATOR ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="AI Engine"
            title="The Intelligence Behind Every Vertical"
            subtitle="Purpose-built AI models powering actionable insights across all platforms"
            light
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiCapabilities.map((cap, i) => (
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
                      {cap.metric}
                    </span>
                    <h3 className="text-lg font-bold text-white mb-1">{cap.name}</h3>
                    <p className="text-sm text-gray-400">{cap.description}</p>
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
            badge="Market Reach"
            title="10+ Strategic Verticals"
            subtitle="Our portfolio spans diverse sectors, each powered by purpose-built AI"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {verticals.map((vertical, i) => (
              <ScrollReveal key={vertical.name} delay={i * 0.05}>
                <Link href="/verticals">
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
                      <p className="text-xs text-gray-300">{vertical.description}</p>
                      <span className="inline-block mt-2 text-xs font-semibold text-gold">
                        {vertical.tam} TAM
                      </span>
                    </div>
                  </div>
                </Link>
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
            badge="Intellectual Property"
            title="Defensible Moat"
            subtitle="Years of domain expertise encoded into proprietary AI, data models, and trade secrets"
            light
          />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { value: '$5.7M–$7.5M', label: 'IP Portfolio Value', color: 'from-electric to-violet' },
              { value: '200+', label: 'AI Prompts (Trade Secret)', color: 'from-gold to-gold-light' },
              { value: '12,000+', label: 'Database Entities', color: 'from-emerald to-cyan-400' },
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
