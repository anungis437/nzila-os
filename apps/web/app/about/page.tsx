import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/ScrollReveal';
import AnimatedCounter from '@/components/public/AnimatedCounter';
import SectionHeading from '@/components/public/SectionHeading';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Nzila Ventures is a venture studio building ethical, human-centered AI across 10+ verticals — powering social impact at scale.',
  openGraph: {
    title: 'About Nzila Ventures',
    description: 'Venture studio building ethical AI across healthcare, finance, agriculture, and justice.',
    images: [{ url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Diverse team collaborating around laptops in a modern workspace — Nzila Ventures' }],
  },
  alternates: { canonical: '/about' },
};

const values = [
  {
    title: 'Human-Centered',
    color: 'from-electric to-violet',
    description:
      'Every solution we build prioritizes the people it serves — accessibility, dignity, and real-world impact above all.',
  },
  {
    title: 'Ethical Integrity',
    color: 'from-gold to-gold-light',
    description:
      'Unwavering ethical standards in IP management, data handling, AI governance, and platform stewardship.',
  },
  {
    title: 'Innovation-Driven',
    color: 'from-violet to-coral',
    description:
      'Continuous innovation through our unified Backbone — powering transformation across all 10+ verticals.',
  },
  {
    title: 'Impact-Focused',
    color: 'from-emerald to-cyan-400',
    description:
      'Measurable outcomes: 56% time savings, 80%+ code reuse, and $4M+ in engineering investment across the portfolio.',
  },
];

const timeline = [
  { year: '2019–2022', title: 'Foundation', description: 'Built core IP, engineered 12,000+ data entities, created 200+ AI prompts, and pioneered union and diaspora banking technology.' },
  { year: '2023', title: 'Portfolio Consolidation', description: 'Analyzed $2M+ in legacy investments. Designed unified Backbone architecture. Expanded to 15 platforms across 10 verticals.' },
  { year: '2024', title: 'Migration & Scale', description: 'Legacy-to-cloud migration underway. Union Eyes 83% migrated. Production deployments on Azure. Django + Next.js stack.' },
  { year: '2025', title: 'Revenue Activation', description: 'Series A readiness. Revenue activation across flagships. $6M ARR target. Strategic partnerships pipeline.' },
];

export default function About() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920"
          alt="Diverse team of professionals collaborating around laptops in a bright modern workspace"
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
              About Nzila Ventures
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Building Ethical AI<br />
              <span className="gradient-text">For Social Impact</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl">
              A venture studio and IP-holding company transforming legacy platforms into
              modern, scalable AI solutions that serve communities worldwide.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ MISSION & VISION ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <ScrollReveal direction="left">
              <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-linear-to-b from-electric to-violet" />
                <div className="pl-8">
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                    Mission
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                    Advancing Human-Centered Solutions
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    To advance human-centered solutions in care, cognition, learning, and equity by
                    building and maintaining ethical technology platforms that serve real-world needs. We
                    transform fragmented legacy systems into unified, scalable infrastructure that
                    amplifies impact while respecting user dignity and data sovereignty.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-linear-to-b from-gold to-gold-light" />
                <div className="pl-8">
                  <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/10 text-gold mb-4">
                    Vision
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                    Technology for Human Flourishing
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    A world where technology seamlessly supports human flourishing across healthcare,
                    justice, commerce, and culture. Through our Backbone infrastructure, we envision
                    interconnected platforms that reduce operational burden, increase accessibility, and
                    create measurable improvements in people&apos;s lives.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CORE VALUES ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Principles"
            title="Our Core Values"
            subtitle="The principles that guide every decision, every line of code, and every partnership"
          />

          <div className="grid md:grid-cols-2 gap-6">
            {values.map((value, i) => (
              <ScrollReveal key={value.title} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-8 border border-gray-100 hover-lift">
                  <div className={`w-12 h-1.5 rounded-full bg-linear-to-r ${value.color} mb-6`} />
                  <h3 className="text-xl font-bold text-navy mb-3">{value.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{value.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TIMELINE ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Journey"
            title="From Vision to Execution"
            subtitle="Five years of building, data curation, and AI innovation"
            light
          />

          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-linear-to-b from-electric via-violet to-gold hidden md:block" />

            <div className="space-y-10">
              {timeline.map((milestone, i) => (
                <ScrollReveal key={milestone.year} delay={i * 0.15}>
                  <div className="flex gap-6 md:gap-10 items-start">
                    <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/20 shrink-0 z-10">
                      <span className="text-xs font-bold text-gold">{milestone.year.slice(0, 4)}</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex-1 hover-lift">
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

      {/* ═══════════════════════ STATS BANNER ═══════════════════════ */}
      <section className="py-16 bg-navy-light relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { target: 15, label: 'AI Platforms' },
              { target: 10, suffix: '+', label: 'Verticals' },
              { target: 4, prefix: '$', suffix: 'M+', label: 'Engineering Investment' },
              { target: 12000, suffix: '+', label: 'Data Entities' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  <AnimatedCounter target={stat.target} prefix={stat.prefix} suffix={stat.suffix} />
                </div>
                <div className="text-gray-400 font-medium text-sm tracking-wider uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CLOSING + CTA ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
              Built with Intentionality, Ethics, and Impact
            </h2>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              Every platform we build, every line of code we write, and every partnership we form is
              guided by our commitment to ethical technology that truly serves humanity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/investors"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg"
              >
                For Investors
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-navy text-white font-bold rounded-xl hover:bg-navy-light transition-all text-lg"
              >
                Get In Touch
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
