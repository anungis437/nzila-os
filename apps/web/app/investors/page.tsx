import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import TechStackBar from '@/components/public/TechStackBar';

export const metadata: Metadata = {
  title: 'Investors',
  description: 'Series A investment opportunity — $100B+ TAM, 15 AI platforms, 4 flagships, one unified Backbone. Join the future of AI infrastructure.',
  openGraph: {
    title: 'Invest in Nzila Ventures',
    description: '$100B+ TAM. 15 AI platforms. Series A ready.',
    images: [{ url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Modern glass skyscraper reaching skyward — representing growth and investment ambition' }],
  },
  alternates: { canonical: '/investors' },
};

const keyMetrics = [
  { label: 'Total Addressable Market', value: '$100B+', color: 'text-gold' },
  { label: 'AI Platforms', value: '15', color: 'text-electric' },
  { label: 'Verticals', value: '10+', color: 'text-violet' },
  { label: 'IP Portfolio Value', value: '$5.7M–$7.5M', color: 'text-emerald' },
  { label: 'Database Entities', value: '12,000+', color: 'text-electric' },
  { label: 'AI Prompts (Trade Secret)', value: '200+', color: 'text-gold' },
];

const flagships = [
  { name: 'Union Eyes', vertical: 'Uniontech', tam: '$50B', entities: '4,773', stage: 'Revenue-Ready', description: 'The most comprehensive union management platform — pension forecasting, grievance tracking, analytics for 4,773 entities.' },
  { name: '3CUO / DiasporaCore', vertical: 'Fintech', tam: '$100B', entities: '485', stage: 'Revenue-Ready', description: 'Diaspora banking infrastructure — KYC/AML, international transfers, community lending across 485 financial entities.' },
  { name: 'ABR Insights', vertical: 'EdTech', tam: '$1.5B', entities: '132', stage: 'Production', description: 'Anti-racism LMS, tribunal case database, and AI coaching — transforming DEI education with proprietary content.' },
  { name: 'CORA', vertical: 'Agrotech', tam: '$8.6B', entities: '80+', stage: 'Beta', description: 'Farm management, supply-chain tracking, and AI-driven market intelligence for African agriculture.' },
];

const useOfFunds = [
  { category: 'Engineering & AI R&D', percent: 40, color: 'bg-electric' },
  { category: 'Go-to-Market & Sales', percent: 25, color: 'bg-violet' },
  { category: 'AI Infrastructure & Cloud', percent: 15, color: 'bg-emerald' },
  { category: 'Compliance & Legal', percent: 10, color: 'bg-gold' },
  { category: 'Working Capital', percent: 10, color: 'bg-coral' },
];

const timeline = [
  { year: '2019–2022', title: 'Foundation', description: 'Built core IP, 12,000+ data entities, 200+ AI prompts, pioneered union and diaspora banking tech.' },
  { year: '2023', title: 'Platform Expansion', description: 'Expanded to 15 platforms across 10 verticals. Unified Backbone architecture. Django + Next.js stack.' },
  { year: '2024', title: 'Migration & Scale', description: 'Legacy-to-cloud migration underway. Union Eyes 83% migrated. Production deployments on Azure.' },
  { year: '2025', title: 'Series A Ready', description: 'Revenue activation across flagships. $6M ARR target. Strategic partnerships pipeline.' },
];

const moats = [
  { title: 'Proprietary Data', description: '12,000+ meticulously curated entities across labor, finance, agriculture, and legal domains — impossible to replicate.' },
  { title: 'AI Trade Secrets', description: '200+ engineered prompts and 512 predictive models purpose-built for social-impact verticals.' },
  { title: 'Multi-Vertical Network', description: 'Cross-pollination between 10+ verticals creates compounding defensibility and data flywheel effects.' },
  { title: 'First-Mover Advantage', description: 'Only AI platform company operating simultaneously across uniontech, diaspora banking, and agrotech.' },
];

export default function InvestorsPage() {
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
              Investment Opportunity
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              The AI Platform Powering<br />
              <span className="gradient-text">$100B+ in Markets</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mb-10">
              15 AI platforms. 10+ verticals. One unified Backbone. Nzila Ventures is the infrastructure 
              layer for social-impact technology — healthcare, finance, labor, agriculture, and justice.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-all text-lg shadow-lg shadow-gold/30"
              >
                Request Investment Deck
              </Link>
              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg"
              >
                View Full Portfolio
              </Link>
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
                  {metric.label}
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
                badge="Investment Thesis"
                title="Why Nzila Ventures?"
                subtitle="A unique, defensible position in the most underserved and highest-growth markets of the next decade."
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
                      <div className="text-xs text-gray-300">Total TAM</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">15</div>
                      <div className="text-xs text-gray-300">AI Platforms</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">4</div>
                      <div className="text-xs text-gray-300">Flagships</div>
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
            badge="Flagship Portfolio"
            title="Four Revenue-Ready Platforms"
            subtitle="Each flagship addresses a massive, underserved market with proprietary AI and data"
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
                        <div className="text-xs text-gray-500 uppercase tracking-wider">TAM</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-electric">{platform.entities}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Entities</div>
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
            badge="Journey"
            title="From Vision to Execution"
            subtitle="Five years of relentless building, data curation, and AI innovation"
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
            badge="Capital Allocation"
            title="Proposed Use of Funds"
            subtitle="Strategic deployment focused on engineering leverage and go-to-market execution"
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
              Series A Ready
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Join the Next Wave of<br />Social-Impact AI
            </h2>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
              We are actively seeking strategic investors and partners who share our vision 
              of building ethical, impactful AI that serves billions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition-all text-lg shadow-lg shadow-gold/30"
              >
                Request Investment Deck
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg"
              >
                Learn About Our Team
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
