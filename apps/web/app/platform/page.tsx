import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import TechStackBar from '@/components/public/TechStackBar';
import InvestorCTA from '@/components/public/InvestorCTA';

export const metadata: Metadata = {
  title: 'Platform',
  description: 'The Nzila Backbone — unified infrastructure powering all 15 AI platforms across 10+ verticals with shared auth, CI/CD, and observability.',
  openGraph: {
    title: 'Nzila Ventures Platform',
    description: 'The Nzila Backbone — unified infrastructure powering all verticals.',
    images: [{ url: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Server room with blue lighting representing Nzila Backbone infrastructure' }],
  },
  alternates: { canonical: '/platform' },
};

const capabilities = [
  {
    photo: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
    name: 'Backbone Infrastructure',
    alt: 'Network cables and fiber optic connections in a modern data center',
    description: 'Shared authentication, databases, CI/CD, and observability across all 15 platforms.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600',
    name: 'Multi-Org Architecture',
    alt: 'Abstract server architecture with layered network topology',
    description: 'Isolated yet unified — each vertical runs on shared primitives with Org-level separation.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600',
    name: 'Security & Compliance',
    alt: 'Digital security shield with encrypted data lock visualization',
    description: 'SOC 2 aligned patterns, Clerk-based identity, and role-based access control across apps.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600',
    name: 'Analytics Pipeline',
    alt: 'Business analytics dashboard with real-time data visualizations and charts',
    description: 'Automated portfolio analytics, migration tracking, and executive reporting dashboards.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
    name: 'Azure Native',
    alt: 'Global cloud infrastructure map showing Azure region connectivity',
    description: 'Container Apps, Static Web Apps, PostgreSQL, and Azure AI for production workloads.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=600',
    name: 'Automation Engine',
    alt: 'Command-line interface running automated deployment scripts',
    description: 'Python-powered validation, migration orchestration, and business intelligence automation.',
  },
];

const layers = [
  { name: 'Frontend', tech: 'Next.js · React 19 · Tailwind 4', color: 'bg-electric' },
  { name: 'API Layer', tech: 'Django 5 · REST · GraphQL', color: 'bg-violet' },
  { name: 'AI / ML', tech: 'TensorFlow · OpenAI · Companion Engine', color: 'bg-gold' },
  { name: 'Data', tech: 'PostgreSQL · Azure CosmosDB · Redis', color: 'bg-emerald' },
  { name: 'Infrastructure', tech: 'Azure · Docker · Terraform · GitHub Actions', color: 'bg-coral' },
];

export default function PlatformPage() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=1920"
          alt="Server room corridor with rows of blue-lit server racks — Nzila Backbone infrastructure"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-navy/85 via-navy/75 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-blue-300 mb-6">
              Infrastructure
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              The Nzila <span className="gradient-text">Backbone</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              A unified infrastructure layer that powers social impact technology across
              healthcare, finance, agriculture, labor rights, and justice.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <Link
              href="/portfolio"
              className="inline-flex items-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition text-lg"
            >
              View Full Portfolio →
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ CAPABILITIES ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Capabilities"
            title="Platform Capabilities"
            subtitle="Enterprise-grade building blocks powering every vertical"
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap, i) => (
              <ScrollReveal key={cap.name} delay={i * 0.08}>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover-lift h-full flex flex-col">
                  <div className="relative h-40 overflow-hidden">
                    <Image
                      src={cap.photo}
                      alt={cap.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-navy/60 to-transparent" />
                    <h3 className="absolute bottom-3 left-4 text-lg font-bold text-white">{cap.name}</h3>
                  </div>
                  <div className="p-5 flex-1">
                    <p className="text-sm text-gray-600">{cap.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ ARCHITECTURE STACK ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Architecture"
            title="Full-Stack Layers"
            subtitle="Every layer purpose-built for multi-vertical AI workloads"
            light
          />

          <div className="space-y-3">
            {layers.map((layer, i) => (
              <ScrollReveal key={layer.name} delay={i * 0.1}>
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur">
                  <div className={`w-2 h-12 ${layer.color} rounded-full shrink-0`} />
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{layer.name}</h3>
                    <p className="text-gray-400 text-sm">{layer.tech}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TECH STACK ═══════════════════════ */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Stack"
            title="Technology Partners"
            subtitle="Battle-tested tools powering production workloads"
          />
          <TechStackBar />
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}
