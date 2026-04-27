import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Investors' }

const platformStrengths = [
  {
    title: 'Network effect at the clinical layer',
    description:
      'Each connected facility increases the value of the unified timeline for every other participant. The platform becomes more valuable as the network grows.',
  },
  {
    title: 'Non-disruptive adoption model',
    description:
      'Veridian does not displace existing EMR investments — dramatically reducing sales cycle friction and implementation risk compared to EMR replacement plays.',
  },
  {
    title: 'Consent and governance as moat',
    description:
      'The consent registry, audit trail, and RBAC framework create institutional lock-in through compliance dependency — not just workflow habit.',
  },
  {
    title: 'Recurring infrastructure revenue',
    description:
      'Platform revenue is recurring and grows with data volume, connected sites, and seat count — not per-transaction or episodic.',
  },
]

const commercialModel = [
  { tier: 'Pilot', description: 'Time-boxed 90-day pilot with defined success criteria. Covers integration support, synthetic environment, and governance scoping.', pricing: 'Fixed pilot fee' },
  { tier: 'Network', description: 'Per-site subscription covering the full Veridian platform — Connect, Timeline, Access, Flow, and Insight modules.', pricing: 'Per-site annual subscription' },
  { tier: 'Enterprise', description: 'Multi-site network agreements with volume pricing, dedicated support, and custom integration SLAs.', pricing: 'Negotiated enterprise agreement' },
]

const marketContext = [
  'Healthcare interoperability is a regulatory requirement in Canada and the US, creating sustained demand for compliant middleware solutions.',
  'EMR fragmentation is structural — no single vendor will achieve market consolidation in the near term, creating durable demand for orchestration layers.',
  'Clinical AI and population health tools require clean, governed, unified data — Veridian is the data access layer those tools depend on.',
  'Privacy regulation in healthcare is tightening globally — consent management and audit tooling are becoming mandatory infrastructure.',
]

export default function InvestorsPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Investor overview</h1>
          <p className="text-xl text-slate-600">
            Veridian Care is building governed clinical data infrastructure for fragmented healthcare
            systems — starting with interoperability and expanding to the governed data layer that
            clinical AI and population health require.
          </p>
        </div>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Market opportunity</h2>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
            <p className="text-slate-700 leading-relaxed">
              Healthcare systems globally operate with structurally fragmented EMR landscapes.
              Patients move between facilities — their records do not. The clinical, operational, and
              safety cost of this fragmentation is measurable: duplicate tests, broken referrals,
              missed medications, and inadequate consent governance. Veridian addresses this at the
              infrastructure layer.
            </p>
          </div>
          <ul className="space-y-3">
            {marketContext.map((point) => (
              <li key={point} className="flex items-start gap-3 text-slate-700">
                <span className="text-teal-500 mt-0.5 shrink-0">●</span>
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Platform strategy</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {platformStrengths.map(({ title, description }) => (
              <div key={title} className="p-6 rounded-xl border border-slate-200 bg-white">
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Commercial model</h2>
          <div className="space-y-4">
            {commercialModel.map(({ tier, description, pricing }) => (
              <div key={tier} className="flex gap-6 p-6 bg-white rounded-xl border border-slate-200">
                <div
                  className="font-extrabold text-lg shrink-0 w-28"
                  style={{ color: '#0d9488' }}
                >
                  {tier}
                </div>
                <div className="flex-1">
                  <p className="text-slate-700 text-sm mb-1">{description}</p>
                  <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                    {pricing}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="p-8 bg-teal-900 rounded-2xl text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Investor inquiries</h2>
          <p className="text-teal-200 mb-6">
            For investor relations, partnership discussions, or additional information, please
            contact:
          </p>
          <a
            href="mailto:investors@veridiancare.health"
            className="text-teal-300 font-bold text-lg hover:underline"
          >
            investors@veridiancare.health
          </a>
        </div>
      </div>
    </div>
  )
}
