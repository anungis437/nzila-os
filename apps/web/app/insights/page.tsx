import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Insights',
  description:
    'Public-service continuity, institutional memory, governance evidence, responsible modernization, and trust — written for leaders navigating change without losing accountability.',
  alternates: { canonical: '/insights' },
};

const frameworks = [
  {
    title: 'CIVIC by Nzila',
    body: 'The public-service continuity front door — Continuity, Implementation, Visibility, Integrity, and Capacity.',
    href: '/public-service',
    cta: 'Explore CIVIC',
  },
  {
    title: 'CLEAR Method',
    body: 'The evidence discipline behind CIVIC — organizing fragmented signals into decision-grade material for human review.',
    href: '/public-service',
    cta: 'See the method',
  },
  {
    title: 'Organizational Continuity',
    body: 'The supporting doctrine: preserving operational memory, governance evidence, and trust through transitions.',
    href: '/organizational-continuity',
    cta: 'Understand continuity',
  },
  {
    title: 'Trust Stewardship',
    body: 'The assurance and governance layer — how institutions keep decisions explainable, accountable, and reviewable.',
    href: '/trust',
    cta: 'Visit the Trust Center',
  },
] as const;

const topics = [
  'Public-service continuity',
  'Workforce transition',
  'Institutional memory',
  'Responsible modernization',
  'Evidence confidence',
  'Equity implementation traceability',
  'Governance readiness',
  'Trust and legitimacy',
] as const;

const resources = [
  {
    title: 'CIVIC one-page brief',
    body: 'A short, forwardable overview of the public-service continuity framing.',
  },
  {
    title: 'Public-service continuity brief',
    body: 'The longer context: the pressures, the core risk, and where continuity becomes fragile.',
  },
  {
    title: 'Human-review and evidence principles',
    body: 'The boundaries: human review stays authoritative, uncertainty is reported, confidence is explicit.',
  },
  {
    title: 'CLEAR Method note',
    body: 'How fragmented evidence is organized for review — an evidence discipline, not a product.',
  },
] as const;

export default function InsightsPage() {
  return (
    <main className="bg-white min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 bg-linear-to-b from-navy via-navy/95 to-navy/85" />
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-36">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-5">
            Insights
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Insights for institutions that need to remember, decide, and adapt.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mb-10">
            Public-service continuity, institutional memory, governance evidence, responsible
            modernization, and trust — written for leaders navigating change without losing
            accountability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/public-service"
              className="inline-flex items-center justify-center px-6 py-3 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition"
            >
              Explore public-service continuity
            </Link>
            <Link
              href="/organizational-continuity"
              className="inline-flex items-center justify-center px-6 py-3 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition"
            >
              Understand organizational continuity
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURED THESIS ═══════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
          Featured thesis
        </p>
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-navy mb-5 max-w-3xl">
            The Public Service Continuity Problem
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mb-8">
            Public institutions are being asked to modernize responsibly, preserve trust, manage
            workforce transition, and maintain accountability at the same time. The hidden risk is
            that institutional memory, ownership, evidence quality, and implementation traceability
            weaken while services are being redesigned.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/insights/public-service-continuity-problem"
              className="inline-flex items-center justify-center px-6 py-3 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition"
            >
              Read the article
            </Link>
            <Link
              href="/public-service"
              className="inline-flex items-center justify-center px-6 py-3 border border-navy text-navy font-semibold rounded-xl hover:bg-navy hover:text-white transition"
            >
              Request a briefing
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FRAMEWORKS ═══════════════════════ */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
            How the thinking fits together
          </p>
          <h2 className="text-3xl font-bold text-navy mb-10 max-w-3xl">
            A front door, an evidence discipline, a doctrine, and an assurance layer.
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {frameworks.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-gray-200 bg-white p-7 hover:border-electric transition flex flex-col"
              >
                <h3 className="text-xl font-bold text-navy mb-3">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6 grow">{f.body}</p>
                <Link href={f.href} className="text-electric font-semibold hover:text-blue-700">
                  {f.cta} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TOPIC CLUSTERS ═══════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
          What we write about
        </p>
        <h2 className="text-3xl font-bold text-navy mb-8 max-w-3xl">
          The themes that decide whether institutions keep their footing through change.
        </h2>
        <div className="flex flex-wrap gap-3">
          {topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-navy"
            >
              {topic}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ RESOURCES ═══════════════════════ */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
            Briefs and references
          </p>
          <h2 className="text-3xl font-bold text-navy mb-4 max-w-3xl">
            Material that supports a public-service continuity conversation.
          </h2>
          <p className="text-gray-600 max-w-3xl mb-10">
            These are shared through briefings rather than published downloads. Request a briefing to
            receive the material relevant to your context.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {resources.map((r) => (
              <article key={r.title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="font-bold text-navy mb-2">{r.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/public-service" className="text-electric font-semibold hover:text-blue-700">
              Request briefing access →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CLOSING CTA ═══════════════════════ */}
      <section className="bg-navy text-white py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-5">Need a briefing, not a demo?</h2>
          <p className="text-lg text-gray-300 leading-relaxed mb-10 max-w-2xl mx-auto">
            CIVIC is introduced as a public-service continuity conversation before any product,
            assessment, or tooling discussion.
          </p>
          <Link
            href="/public-service"
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition text-lg"
          >
            Request a briefing
          </Link>
        </div>
      </section>
    </main>
  );
}
