import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Union Eyes',
  description:
    'Union Eyes is Nzila Ventures flagship validation product: institutional continuity infrastructure for labor organizations.',
  alternates: { canonical: '/union-eyes' },
};

const proofPoints = [
  {
    title: 'Grievance lineage',
    body: 'Case history, decisions, documents, deadlines, and outcomes remain institutionally accessible rather than steward-dependent.',
  },
  {
    title: 'Steward continuity',
    body: 'New stewards inherit operational context, precedent, and rationale without relying on informal handoffs or memory heroics.',
  },
  {
    title: 'Governance evidence',
    body: 'Hash-chained records, role-scoped access, and audit trails create reviewable evidence for members and authorized governance roles.',
  },
  {
    title: 'Federated coordination',
    body: 'Local autonomy is preserved while federated organizations coordinate around shared continuity standards.',
  },
];

const pilotSteps = [
  'Baseline continuity review and pilot scope',
  'Governance approval and member-facing visibility plan',
  'Role-scoped deployment for stewards and coordinators',
  'Measured pilot operation over a defined institutional function',
  'Closure report with continuity, governance, and anti-surveillance findings',
];

export default function UnionEyesPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="bg-navy text-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-4">
            Flagship Validation Wedge
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Union Eyes preserves organizational memory for labor organizations.
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl">
            Most unions operate on the memory of a few senior stewards. Union Eyes is built so
            grievance history, governance rationale, member accountability, and operational context
            survive leadership cycles without becoming worker surveillance.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href="/contact" className="px-6 py-3 bg-gold text-navy font-bold rounded-xl hover:bg-gold-light transition">
              Discuss Pilot
            </Link>
            <Link href="/anti-surveillance" className="px-6 py-3 border border-white/25 text-white font-bold rounded-xl hover:bg-white/10 transition">
              Read Anti-Surveillance Commitment
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold text-navy mb-6">What Union Eyes proves</h2>
            <div className="space-y-4">
              {proofPoints.map((point) => (
                <article key={point.title} className="rounded-xl border border-gray-200 p-5">
                  <h3 className="font-bold text-navy mb-2">{point.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{point.body}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-8">
            <h2 className="text-3xl font-bold text-navy mb-6">The boundary is structural</h2>
            <p className="text-gray-700 mb-6">
              Union Eyes measures institutional posture, not individual productivity. It does not
              score members, profile behavior, track attention, or automate punitive action.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <strong className="block text-navy mb-2">Continuity intelligence</strong>
                <span className="text-gray-600">governance posture, decision lineage, operational memory</span>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <strong className="block text-navy mb-2">Not surveillance</strong>
                <span className="text-gray-600">no productivity scoring, hidden monitoring, or behavior profiles</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-6">Pilot path</h2>
          <ol className="space-y-4">
            {pilotSteps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-xl bg-white border border-gray-200 p-5">
                <span className="w-8 h-8 shrink-0 rounded-full bg-electric text-white font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-gray-700 font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
