import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/ScrollReveal';

export const metadata: Metadata = {
  title: 'CIVIC by Nzila',
  description:
    'Public-service continuity and modernization intelligence for institutions managing workforce transition, responsible modernization, accountability, and institutional memory risk.',
  alternates: { canonical: '/public-service' },
};

const issueAreas = [
  {
    title: 'Workforce transition and institutional memory',
    body: 'Support continuity planning as experienced staff retire or transition, while preserving tacit operational knowledge and ownership clarity.',
  },
  {
    title: 'Responsible modernization and AI readiness',
    body: 'Assess whether modernization plans are implementation-safe, evidence-backed, and reviewable before decisions become operational defaults.',
  },
  {
    title: 'Equity implementation traceability',
    body: 'Keep commitments traceable from strategy through workflow ownership, controls, evidence, and recourse pathways.',
  },
  {
    title: 'Anti-racism visibility and accountability',
    body: 'Use anti-racism / ABR as a visibility and traceability lens, not an automated racism detector.',
  },
  {
    title: 'Access-to-justice review readiness',
    body: 'Treat CourtLens as an adjacent access-to-justice proof point, not the primary public-service front door.',
  },
  {
    title: 'Service continuity and internal controls',
    body: 'Identify where fragmented evidence or unclear control ownership could weaken service reliability and trust under change pressure.',
  },
];

const clearBriefs = [
  'Executive public-service continuity brief',
  'Service continuity risk map',
  'Workforce knowledge-loss exposure map',
  'Accountability traceability map',
  'Equity implementation traceability note',
  'Modernization / AI readiness pre-check',
  'Evidence confidence profile',
  '30/60/90-day control plan',
];

const principles = [
  'No autonomous legal, HR, equity, or employment decisions',
  'No automated findings of discrimination, racism, or wrongdoing',
  'No automated legal advice or autonomous filing',
  'Human review remains authoritative',
  'Uncertainty is reported, not hidden',
  'Evidence confidence is explicit',
  'Privacy and minimization are built into scope',
  'Outputs support governance and accountability; they do not replace decision-makers',
];

export default function PublicServicePage() {
  return (
    <main className="bg-white min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920"
          alt="Public-service team collaborating around a table — CIVIC by Nzila"
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
              CIVIC by Nzila
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              <span className="gradient-text">CIVIC</span> by Nzila
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-6">
              Public-service continuity and modernization intelligence
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className="max-w-3xl mx-auto space-y-4 text-gray-300 leading-relaxed mb-8">
              <p>
                Public institutions are being asked to modernize services, adopt AI responsibly, preserve trust, and
                manage workforce transition while institutional memory, accountability structures, and operating capacity
                are changing.
              </p>
              <p>
                CIVIC by Nzila helps public-service leaders see where service continuity, implementation commitments,
                evidence, institutional knowledge, and modernization readiness may become fragile before change becomes
                irreversible.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.4}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition text-lg"
              >
                Request a briefing
              </Link>
              <a
                href="#public-service-brief"
                className="inline-flex items-center justify-center px-8 py-4 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition text-lg"
              >
                Read the public-service brief
              </a>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.5}>
            <p className="mt-8 text-sm text-gray-300 max-w-3xl mx-auto">
              CIVIC is currently being introduced as a public-service continuity initiative and briefing series. Nzila is
              seeking conversations with public-sector leaders to validate where this framing is useful before packaging
              formal offerings.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section id="public-service-brief" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Why now</p>
          <h2 className="text-3xl font-bold text-navy mb-6">Public-service continuity pressure is structural, not temporary.</h2>
          <div className="grid md:grid-cols-2 gap-5 mb-6">
            <div className="rounded-xl bg-white border border-gray-200 p-5 text-gray-700">
              Workforce transition, early retirements, and attrition are colliding with service modernization,
              automation pressure, and accountability expectations.
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-5 text-gray-700">
              Equity implementation, service operations, audit readiness, complaints, and modernization evidence often
              remain fragmented across systems, teams, and reporting cycles.
            </div>
          </div>
          <div className="rounded-xl border border-navy/20 bg-white p-6">
            <p className="text-navy font-semibold mb-2">Core risk statement</p>
            <p className="text-gray-700 leading-relaxed">
              The risk is not simply that experienced people leave. The risk is that undocumented knowledge, unclear
              ownership, weak evidence, and fragmented accountability become embedded into redesigned services or
              automated workflows.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">What CIVIC means</p>
          <h2 className="text-3xl font-bold text-navy mb-4">CIVIC = Continuity, Implementation, Visibility, Integrity, and Capacity</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
            <article className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-navy mb-2">Continuity</h3>
              <p className="text-sm text-gray-600">Services and institutional knowledge remain durable through change.</p>
            </article>
            <article className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-navy mb-2">Implementation</h3>
              <p className="text-sm text-gray-600">Commitments are visible in workflows, ownership, and controls.</p>
            </article>
            <article className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-navy mb-2">Visibility</h3>
              <p className="text-sm text-gray-600">Weak signals and fragmented evidence can be surfaced for human review.</p>
            </article>
            <article className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-navy mb-2">Integrity</h3>
              <p className="text-sm text-gray-600">Decisions remain explainable, accountable, and reviewable.</p>
            </article>
            <article className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-bold text-navy mb-2">Capacity</h3>
              <p className="text-sm text-gray-600">Institutions can absorb modernization without weakening trust.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="the-civic-thesis" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">The CIVIC thesis</p>
          <h2 className="text-3xl font-bold text-navy mb-6">From policy commitment to institutional action.</h2>
          <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4 text-gray-700 leading-relaxed">
            <p>
              Public institutions often have commitments, policies, service standards, values statements, anti-racism
              strategies, modernization plans, and accountability expectations. The challenge is whether those
              commitments remain traceable through workflows, evidence, ownership, institutional memory, recourse, and
              modernization decisions.
            </p>
            <p className="font-semibold text-navy">CIVIC focuses on the operating layer between policy commitment and institutional action.</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">The CLEAR Method</p>
          <h2 className="text-3xl font-bold text-navy mb-4">CLEAR = Continuity, Legitimacy, Evidence, Accountability, and Readiness</h2>
          <div className="rounded-xl border border-gray-200 p-6 bg-white text-gray-700 leading-relaxed space-y-4">
            <p>
              CLEAR is the evidence discipline behind CIVIC. It is not being introduced as a product or paid assessment
              in this first public-service front door.
            </p>
            <p>
              CLEAR helps organize fragmented evidence across HR, equity, audit, complaints, service operations,
              modernization plans, workforce transition, and institutional knowledge.
            </p>
            <p className="font-semibold text-navy">CLEAR may support, in later stages:</p>
            <ul className="list-disc pl-6 space-y-1">
              {clearBriefs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Potential future verdict language includes: <strong>Ready</strong>, <strong>Ready with controls</strong>,
              <strong> Not ready</strong>, and <strong>Insufficient evidence</strong>.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">SAGE Workspace</p>
          <h2 className="text-3xl font-bold text-navy mb-4">SAGE = Service Assurance, Governance, and Evidence</h2>
          <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4 text-gray-700 leading-relaxed">
            <p>
              SAGE is the future workspace direction for organizations that later need a repeatable operating layer for
              service assurance, governance evidence, continuity risks, and modernization readiness over time.
            </p>
            <p className="font-semibold text-navy">SAGE is not being launched as the government-facing offer in this pass.</p>
            <p>
              SAGE is not designed to replace public-service judgment, legal review, HR decision-making, equity offices,
              internal audit, or program accountability. It is designed to organize evidence, trace obligations,
              surface uncertainty, and support human-reviewed decisions.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">Public-service issue areas</p>
          <h2 className="text-3xl font-bold text-navy mb-6">Where CIVIC can apply</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {issueAreas.map((area) => (
              <article key={area.title} className="rounded-xl border border-gray-200 p-5 bg-white">
                <h3 className="font-bold text-navy mb-2">{area.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{area.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-600">
            This public-service front door is intentionally framed for government continuity conversations before any
            product, pilot, or tooling packaging.
          </p>
        </div>
      </section>

      <section className="py-20 bg-navy text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
            Human Review and Evidence Principles
          </p>
          <h2 className="text-3xl font-bold mb-6">Human review is the boundary, evidence is the discipline.</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {principles.map((principle) => (
              <div key={principle} className="rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-gray-100">
                {principle}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-navy mb-4">Request a briefing</h2>
          <p className="text-gray-700 leading-relaxed mb-8">
            CIVIC is being introduced through conversations with public-service leaders, advisors, and institutions
            managing workforce transition, responsible modernization, equity implementation, service continuity, or
            institutional memory risk.
          </p>
          <p className="text-gray-700 leading-relaxed mb-10">
            Request a briefing to discuss whether this framing is useful in your context.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-3 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Request a briefing
          </Link>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <a href="#public-service-brief" className="text-navy underline underline-offset-4 hover:text-electric">
              Read the public-service brief
            </a>
            <span className="text-gray-400">|</span>
            <a href="#the-civic-thesis" className="text-navy underline underline-offset-4 hover:text-electric">
              Explore the CIVIC thesis
            </a>
            <span className="text-gray-400">|</span>
            <a
              href="mailto:?subject=CIVIC%20by%20Nzila%20-%20Public-service%20continuity%20brief&body=Sharing%20this%20public-service%20briefing%20page:%20https%3A%2F%2Fnzilaventures.com%2Fpublic-service"
              className="text-navy underline underline-offset-4 hover:text-electric"
            >
              Share this with a public-service leader
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
