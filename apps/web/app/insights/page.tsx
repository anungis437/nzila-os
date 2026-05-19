import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Insights',
  description:
    'Operational insights on continuity, governance fragility, trust debt, operational memory, and anti-surveillance infrastructure.',
  alternates: { canonical: '/insights' },
};

const insights = [
  {
    title: 'Why organizations lose knowledge when people leave',
    description: 'A first-contact explanation of operational memory loss and why continuity needs infrastructure.',
    href: '/institutional-continuity',
  },
  {
    title: 'The difference between continuity intelligence and surveillance',
    description: 'Continuity measures institutional posture. Surveillance measures individuals. The distinction is architectural.',
    href: '/anti-surveillance',
  },
  {
    title: 'Governance fragility is measurable',
    description: 'Key-person dependency, missing rationale, onboarding delay, and audit preparation are measurable continuity signals.',
    href: '/continuity-assessment',
  },
  {
    title: 'Union Eyes as the flagship proof point',
    description: 'Why labor organizations are the clearest validation path for continuity, governance resilience, and operational memory.',
    href: '/union-eyes',
  },
];

export default function InsightsPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            Insights
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Operational writing for continuity-critical institutions.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Calm, procurement-safe explainers on institutional continuity, governance evidence,
            operational memory, sovereignty, and anti-surveillance infrastructure.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-6">
          {insights.map((insight) => (
            <article key={insight.title} className="rounded-2xl border border-gray-200 p-6 hover:border-electric transition">
              <h2 className="text-xl font-bold text-navy mb-3">{insight.title}</h2>
              <p className="text-gray-600 mb-5">{insight.description}</p>
              <Link href={insight.href} className="text-electric font-semibold hover:text-blue-700">
                Read insight
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
