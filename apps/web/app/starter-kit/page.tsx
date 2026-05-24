import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Governance and Continuity Starter Kit',
  description:
    'A practical starter kit for organizations preparing to evaluate continuity risk, governance fragility, and operational memory exposure.',
  alternates: { canonical: '/starter-kit' },
};

const kit = [
  {
    title: 'Continuity symptoms checklist',
    body: 'Identify where decisions, workflows, relationships, approvals, and organizational context depend on specific people.',
  },
  {
    title: 'Governance evidence inventory',
    body: 'Map where decision rationale, approvals, audit trails, and operational records are generated today.',
  },
  {
    title: 'Transition readiness worksheet',
    body: 'Assess what would happen if senior operators, stewards, coordinators, or leaders changed within the next 90 days.',
  },
  {
    title: 'Anti-surveillance review',
    body: 'Confirm that continuity work measures organizational posture, not individual productivity or behavior.',
  },
];

export default function StarterKitPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            Governance and Continuity Starter Kit
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Start with operational clarity, not doctrine density.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            The starter kit helps an organization prepare for a continuity review by naming
            symptoms, locating evidence, and distinguishing continuity intelligence from surveillance.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          {kit.map((item) => (
            <article key={item.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-xl font-bold text-navy mb-3">{item.title}</h2>
              <p className="text-gray-600">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-electric/20 bg-electric/5 p-8">
          <h2 className="text-2xl font-bold text-navy mb-3">Recommended next step</h2>
          <p className="text-gray-700 mb-6">
            Use the starter kit before the OCI Continuity Risk Assessment or a governance review workshop.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/continuity-assessment" className="px-6 py-3 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition">
              Begin Assessment
            </Link>
            <Link href="/contact" className="px-6 py-3 border border-gray-300 text-gray-900 font-bold rounded-xl hover:bg-white transition">
              Book Governance Review
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
