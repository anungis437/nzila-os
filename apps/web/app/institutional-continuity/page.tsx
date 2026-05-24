import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Organizational Continuity',
  description:
    'Nzila builds organizational continuity infrastructure for organizations that need governance, operational memory, and trust to survive transitions.',
  alternates: { canonical: '/organizational-continuity' },
};

const symptoms = [
  'Key decisions can only be explained by one or two long-tenured people.',
  'Onboarding depends on mentorship rather than durable organizational records.',
  'Audit readiness requires preparation because evidence is reconstructed after the fact.',
  'Leadership transitions expose fragmented workflows, missing rationale, and informal approvals.',
];

const capabilities = [
  {
    title: 'Operational memory',
    body: 'Procedures, precedents, workflows, decisions, historical rationale, and organizational context become preserved assets of the organization.',
  },
  {
    title: 'Governance evidence',
    body: 'Decisions are captured with rationale, approval lineage, traceable records, and reviewable history.',
  },
  {
    title: 'Continuity posture',
    body: 'Organizations can identify dependency concentration, transition risk, onboarding fragility, and trust debt before a crisis exposes them.',
  },
  {
    title: 'Sovereign operations',
    body: 'Institutions retain ownership, exportability, visibility, and operational independence from any single vendor relationship.',
  },
];

export default function InstitutionalContinuityPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            Organizational Continuity
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Governance becomes fragile when operational memory disappears.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Nzila builds continuity infrastructure for trust-sensitive institutions: the governed records,
            decision rationale, operational memory, and evidence required to remain accountable across time.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href="/continuity-assessment" className="px-6 py-3 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition">
              Begin Continuity Assessment
            </Link>
            <Link href="/union-eyes" className="px-6 py-3 border border-white/25 text-white font-bold rounded-xl hover:bg-white/10 transition">
              See Union Eyes
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
              Symptoms
            </p>
            <h2 className="text-3xl font-bold text-navy mb-6">
              The problem is usually visible before it is named.
            </h2>
            <ul className="space-y-4">
              {symptoms.map((symptom) => (
                <li key={symptom} className="rounded-xl border border-gray-200 p-5 text-gray-700">
                  {symptom}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-3">
              Nzila OS
            </p>
            <h2 className="text-3xl font-bold text-navy mb-6">
              Governed operational infrastructure for trust-sensitive institutions.
            </h2>
            <div className="space-y-4">
              {capabilities.map((capability) => (
                <article key={capability.title} className="rounded-xl bg-gray-50 border border-gray-100 p-5">
                  <h3 className="font-bold text-navy mb-2">{capability.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{capability.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-6">Who this is for</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {['Labor organizations and unions', 'Healthcare institutions', 'Public-sector bodies', 'Federated associations', 'Governance-heavy enterprises', 'Regulated operators'].map((label) => (
              <div key={label} className="rounded-xl bg-white border border-gray-200 p-5 text-gray-700 font-medium">
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
