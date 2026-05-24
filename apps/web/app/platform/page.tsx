import type { Metadata } from 'next';
import Image from 'next/image';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionHeading from '@/components/public/SectionHeading';
import TechStackBar from '@/components/public/TechStackBar';
import InvestorCTA from '@/components/public/InvestorCTA';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Nzila OS',
  description: 'Nzila OS is governed operational infrastructure for trust-sensitive institutions: continuity, governance, evidence, sovereignty, and explainability.',
  openGraph: {
    title: 'Nzila OS',
    description: 'Governed operational infrastructure for continuity-critical institutions.',
    images: [{ url: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Server room with blue lighting representing Nzila OS infrastructure' }],
  },
  alternates: { canonical: '/platform' },
};

const capabilities = [
  {
    photo: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
    name: 'Governed Operational Infrastructure',
    alt: 'Network cables and fiber optic connections in a modern data center',
    description: 'Shared identity, data, policy, release evidence, and observability primitives across governed operational applications.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600',
    name: 'Multi-Organization Architecture',
    alt: 'Abstract server architecture with layered network topology',
    description: 'Organizations remain isolated by default while sharing governed primitives for continuity, policy, and evidence.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600',
    name: 'Security & Compliance',
    alt: 'Digital security shield with encrypted data lock visualization',
    description: 'SOC 2 aligned patterns, Entra ID-based identity, and role-based access control across apps.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600',
    name: 'Evidence Pipeline',
    alt: 'Business analytics dashboard with real-time data visualizations and charts',
    description: 'Operational traceability, governance evidence, continuity indicators, and reviewable executive reports.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
    name: 'Azure Native',
    alt: 'Global cloud infrastructure map showing Azure region connectivity',
    description: 'Container Apps, PostgreSQL, and Azure services for secure production workloads.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=600',
    name: 'Explainable Assistance',
    alt: 'Command-line interface running automated deployment scripts',
    description: 'Human-overridable assistance for validation, summaries, migration sequencing, and governance workflows.',
  },
];

const layers = [
  { name: 'Frontend', tech: 'Next.js · React 19 · Tailwind 4', color: 'bg-electric' },
  { name: 'API Layer', tech: 'Django 5 · REST · GraphQL', color: 'bg-violet' },
  { name: 'Continuity Layer', tech: 'Operational memory · Evidence lineage · Explainable assistance', color: 'bg-gold' },
  { name: 'Data', tech: 'PostgreSQL · Azure CosmosDB · Redis', color: 'bg-emerald' },
  { name: 'Infrastructure', tech: 'Azure · Docker · Terraform · GitHub Actions', color: 'bg-coral' },
];

const capabilityFr: Record<string, { name: string; description: string }> = {
  'Governed Operational Infrastructure': {
    name: 'Infrastructure opérationnelle gouvernée',
    description: 'Identité, données, politiques, preuves de release et observabilité partagées entre applications opérationnelles gouvernées.',
  },
  'Multi-Organization Architecture': {
    name: 'Architecture multi-organisation',
    description: 'Chaque organisation reste isolée par défaut tout en utilisant des primitives partagées de continuité, politique et preuve.',
  },
  'Security & Compliance': {
    name: 'Securite et conformite',
    description: 'Patterns alignes SOC 2, identite basee Entra ID et contrôle d accès par roles sur toutes les applications.',
  },
  'Evidence Pipeline': {
    name: 'Pipeline de preuves',
    description: 'Traçabilité opérationnelle, preuves de gouvernance, indicateurs de continuité et rapports exécutifs vérifiables.',
  },
  'Azure Native': {
    name: 'Natif Azure',
    description: 'Container Apps, PostgreSQL et services Azure pour des charges de production securisees.',
  },
  'Explainable Assistance': {
    name: 'Assistance explicable',
    description: 'Assistance révisable par des humains pour validation, résumés, séquençage de migration et workflows de gouvernance.',
  },
};

const layerFr: Record<string, string> = {
  Frontend: 'Interface',
  'API Layer': 'Couche API',
  'Continuity Layer': 'Couche continuité',
  Data: 'Données',
  Infrastructure: 'Infrastructure',
};

export default async function PlatformPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=1920"
          alt="Server room corridor with rows of blue-lit server racks - Nzila OS infrastructure"
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
              {isFr ? 'Infrastructure' : 'Infrastructure'}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              {isFr ? 'Nzila ' : 'Nzila '}<span className="gradient-text">OS</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              {isFr
                ? 'Une infrastructure opérationnelle gouvernée pour les institutions sensibles à la confiance: continuité, gouvernance, preuves, souveraineté et explicabilité.'
                : 'Governed operational infrastructure for trust-sensitive institutions: continuity, governance, evidence, sovereignty, and explainability.'}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <TrackedLink
              href="/organizational-continuity"
              eventName="cta_institutional_continuity"
              eventProps={{ source: 'platform_hero' }}
              className="inline-flex items-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition text-lg"
            >
              {isFr ? 'Comprendre la continuité ->' : 'Understand Continuity ->'}
            </TrackedLink>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════ CAPABILITIES ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge={isFr ? 'Capacites' : 'Capabilities'}
            title={isFr ? 'Capacites de la plateforme' : 'Platform Capabilities'}
            subtitle={isFr ? 'Blocs de niveau entreprise qui alimentent chaque industrie' : 'Enterprise-grade building blocks powering every industry'}
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
                    <h3 className="absolute bottom-3 left-4 text-lg font-bold text-white">{isFr ? (capabilityFr[cap.name]?.name ?? cap.name) : cap.name}</h3>
                  </div>
                  <div className="p-5 flex-1">
                    <p className="text-sm text-gray-600">{isFr ? (capabilityFr[cap.name]?.description ?? cap.description) : cap.description}</p>
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
            badge={isFr ? 'Architecture' : 'Architecture'}
            title={isFr ? 'Couches full-stack' : 'Full-Stack Layers'}
            subtitle={isFr ? 'Chaque couche est concue pour des charges multi-verticales' : 'Every layer purpose-built for multi-vertical workloads'}
            light
          />

          <div className="space-y-3">
            {layers.map((layer, i) => (
              <ScrollReveal key={layer.name} delay={i * 0.1}>
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur">
                  <div className={`w-2 h-12 ${layer.color} rounded-full shrink-0`} />
                  <div className="flex-1">
                    <h3 className="text-white font-bold">{isFr ? (layerFr[layer.name] ?? layer.name) : layer.name}</h3>
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
            badge={isFr ? 'Stack' : 'Stack'}
            title={isFr ? 'Partenaires technologiques' : 'Technology Partners'}
            subtitle={isFr ? 'Outils eprouves qui alimentent des charges de production' : 'Battle-tested tools powering production workloads'}
          />
          <TechStackBar />
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}


