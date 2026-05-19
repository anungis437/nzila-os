import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Doctrine',
  description:
    'The public doctrine behind Nzila OS: continuity, governance, explainability, trust, sovereignty, evidence, and federation.',
  alternates: { canonical: '/doctrine' },
};

const pillars = [
  'Continuity',
  'Governance',
  'Explainability',
  'Trust',
  'Sovereignty',
  'Evidence',
  'Federation',
];

export default function DoctrinePage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-electric text-sm font-semibold tracking-widest uppercase mb-4">
            Nzila Doctrine
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Continuity over heroics. Governance before scale.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Nzila OS is institutional continuity infrastructure designed to help trust-sensitive
            organizations preserve governance, operational memory, and organizational resilience over time.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-navy mb-6">Doctrine pillars</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map((pillar) => (
            <div key={pillar} className="rounded-xl border border-gray-200 bg-gray-50 p-5 font-bold text-navy">
              {pillar}
            </div>
          ))}
        </div>

        <div className="mt-16 grid lg:grid-cols-3 gap-6">
          {[
            {
              title: 'First contact starts with symptoms',
              body: 'Knowledge walks out the door. Decisions lose rationale. Onboarding depends on the wrong people. Category language comes after recognition.',
              href: '/institutional-continuity',
            },
            {
              title: 'Trust requires visible boundaries',
              body: 'Continuity intelligence measures the institution. Surveillance measures the individual. Nzila is structurally aligned to the first.',
              href: '/anti-surveillance',
            },
            {
              title: 'Evidence must be operational',
              body: 'The assessment, pilot model, and case-study engine turn doctrine into measurable institutional outcomes.',
              href: '/continuity-assessment',
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-navy mb-3">{item.title}</h3>
              <p className="text-gray-600 mb-5">{item.body}</p>
              <Link href={item.href} className="text-electric font-semibold hover:text-blue-700">
                Read more
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
