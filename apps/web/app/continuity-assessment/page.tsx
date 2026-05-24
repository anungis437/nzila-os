import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Continuity Assessment',
  description:
    'OCRA-first entry: a structured diagnostic for organizations that need continuity intelligence and governance-safe modernization.',
  alternates: { canonical: '/continuity-assessment' },
};

const sections = [
  'Operational dependency',
  'Governance visibility',
  'Organizational memory',
  'Onboarding continuity',
  'Transition readiness',
  'Operational traceability',
  'Federated coordination',
  'Explainable governance',
  'Operational sovereignty',
];

const outputs = [
  'Composite continuity posture',
  'Governance fragility indicator',
  'Operational memory exposure',
  'Trust debt indicator',
  'Section-level findings',
  'Recommended organizational next steps',
];

export default function ContinuityAssessmentPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            OCI Continuity Risk Assessment
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            OCRA-first entry for organizations that need continuity intelligence first.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            This path starts with diagnosis: continuity fragility, governance risk, operational memory
            exposure, trust debt, and sovereignty posture. It is strategic-entry GTM, not a lead capture quiz.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-white/15 p-4">
              <strong className="text-white block">15-25 minutes</strong>
              <span className="text-gray-400">designed for executive review</span>
            </div>
            <div className="rounded-xl border border-white/15 p-4">
              <strong className="text-white block">Organization-level</strong>
              <span className="text-gray-400">never individual behavior</span>
            </div>
            <div className="rounded-xl border border-white/15 p-4">
              <strong className="text-white block">Procurement-safe</strong>
              <span className="text-gray-400">methodology and outputs documented</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-6">
          <article className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-xs uppercase tracking-wide text-electric font-semibold mb-2">Path A</p>
            <h2 className="text-2xl font-bold text-navy mb-3">OCRA-first</h2>
            <p className="text-gray-700 mb-4">Diagnose then operationalize. Best for executive teams, modernization sponsors, and governance-heavy organizations.</p>
            <p className="text-sm text-gray-600">Flow: continuity pain recognition → OCI assessment → executive continuity brief → operational activation.</p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-xs uppercase tracking-wide text-electric font-semibold mb-2">Path B</p>
            <h2 className="text-2xl font-bold text-navy mb-3">Operations-first</h2>
            <p className="text-gray-700 mb-4">Operationalize then diagnose. Teams can start with workflow stabilization and still converge to the same continuity architecture.</p>
            <Link href="/union-eyes" className="inline-flex px-5 py-2.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy-light transition">
              Explore operations-first
            </Link>
          </article>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold text-navy mb-6">What it measures</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {sections.map((section) => (
                <div key={section} className="rounded-xl border border-gray-200 p-4 text-gray-700">
                  {section}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-navy mb-6">What the report produces</h2>
            <div className="space-y-3">
              {outputs.map((output) => (
                <div key={output} className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-gray-700">
                  {output}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-navy mb-4">
            Start with the risk your organization already feels.
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            If key-person dependency, missing decision rationale, audit preparation, or transition risk
            are already visible, this OCRA-first motion gives those conditions a structured baseline and
            reconnects them to operational continuity activation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">
              Request OCRA Assessment
            </Link>
            <Link href="/union-eyes" className="px-6 py-3 border border-gray-300 text-gray-900 font-bold rounded-xl hover:bg-white transition">
              Explore operations-first
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
