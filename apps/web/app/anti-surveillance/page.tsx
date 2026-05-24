import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Anti-Surveillance Commitment',
  description:
    'Nzila systems preserve organizational continuity. They are not worker surveillance systems.',
  alternates: { canonical: '/anti-surveillance' },
};

const does = [
  'Capture governance decisions and their rationale',
  'Preserve operational memory across transitions',
  'Measure organizational continuity exposure',
  'Document approval lineage and decision history',
  'Support federated coordination without centralizing local sovereignty',
];

const doesNot = [
  'Track individual time, attention, location, or productivity',
  'Score workers, members, coordinators, or stewards',
  'Build hidden behavioral profiles',
  'Automate punitive actions against people',
  'Operate governance systems invisibly to those they govern',
];

export default function AntiSurveillancePage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            Anti-Surveillance and Human Dignity
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Nzila is continuity infrastructure. It is not worker surveillance.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            The distinction is structural. Nzila measures organizational posture: governance coherence,
            continuity exposure, operational traceability, and organizational resilience. It does not
            measure individual productivity, behavior, location, communication patterns, or performance.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-emerald/20 bg-emerald/5 p-8">
            <h2 className="text-2xl font-bold text-navy mb-6">Nzila systems do</h2>
            <ul className="space-y-3">
              {does.map((item) => (
                <li key={item} className="rounded-xl bg-white border border-emerald/10 p-4 text-gray-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-coral/20 bg-coral/5 p-8">
            <h2 className="text-2xl font-bold text-navy mb-6">Nzila systems do not</h2>
            <ul className="space-y-3">
              {doesNot.map((item) => (
                <li key={item} className="rounded-xl bg-white border border-coral/10 p-4 text-gray-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-6">Human dignity is a system constraint.</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              'People are not modeled as productivity inputs.',
              'AI-assisted features remain explainable, traceable, and subject to human override.',
              'Institutions retain ownership, exportability, and control of their operational memory.',
            ].map((statement) => (
              <div key={statement} className="rounded-xl bg-white border border-gray-200 p-5 text-gray-700">
                {statement}
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link href="/trust" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">
              Visit Trust Center
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
