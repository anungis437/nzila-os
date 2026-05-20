import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Continuity Assessment',
  description:
    'A structured diagnostic for organizations that take governance, continuity, operational memory, and trust seriously.',
  alternates: { canonical: '/continuity-assessment' },
};

const sections = [
  'Operational dependency',
  'Governance visibility',
  'Institutional memory',
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
  'Recommended institutional next steps',
];

export default function ContinuityAssessmentPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            Institutional Continuity Risk Assessment
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            A structured diagnostic for organizations that take continuity seriously.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            The assessment measures exposure to continuity failure, governance fragility,
            operational memory loss, trust debt, and sovereignty risk. It is a diagnostic
            instrument, not a lead capture quiz.
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
            Start with the risk your institution already feels.
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            If key-person dependency, missing decision rationale, audit preparation, or transition risk
            are already visible, the assessment gives those conditions a structured baseline.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">
              Request Assessment
            </Link>
            <Link href="/starter-kit" className="px-6 py-3 border border-gray-300 text-gray-900 font-bold rounded-xl hover:bg-white transition">
              Get Starter Kit
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
