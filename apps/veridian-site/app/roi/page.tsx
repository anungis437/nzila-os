import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'ROI Framework' }

const roiCategories = [
  {
    title: 'Duplicate test reduction',
    icon: '🧪',
    description:
      'When clinicians cannot see prior lab results from other facilities, they order tests again. Veridian Timeline surfaces prior results at the point of care.',
    metrics: [
      { label: 'Estimated duplicate lab rate (baseline)', value: '18–28%' },
      { label: 'Average lab order cost', value: '$85–$400' },
      { label: 'Target reduction with cross-site history', value: '40–60%' },
    ],
    note: 'Representative industry estimates. Your baseline will vary. Veridian Insight establishes your actual duplicate test rate during pilot.',
  },
  {
    title: 'Referral delay reduction',
    icon: '⏱️',
    description:
      'Referrals without sufficient clinical context experience significantly longer delays to specialist contact. Veridian Flow ensures the context package travels with the referral.',
    metrics: [
      { label: 'Average referral-to-contact delay (baseline)', value: '4–8 days' },
      { label: 'Delay attributable to incomplete context', value: '30–50%' },
      { label: 'Target delay reduction with context package', value: '2–3 days' },
    ],
    note: 'Referral delay baselines are established during the pilot scoping session using your actual referral data.',
  },
  {
    title: 'Audit and compliance time savings',
    icon: '📋',
    description:
      'Manual audit log compilation is time-intensive. Veridian Access provides a structured, exportable audit trail — reducing time spent on access reviews, compliance audits, and privacy investigations.',
    metrics: [
      { label: 'Typical manual audit preparation time', value: '8–16 hours per review' },
      { label: 'Access reviews completed per quarter (baseline)', value: '60–80%' },
      { label: 'Target access review completion with Veridian', value: '95%+' },
    ],
    note: 'Compliance time savings are realized once the audit trail is established. Pilot includes access review tooling.',
  },
  {
    title: 'Clinician time recovery',
    icon: '👩‍⚕️',
    description:
      'Clinicians spend significant time hunting records across systems before consultations. A unified timeline reduces pre-consultation preparation time.',
    metrics: [
      { label: 'Average time spent hunting records per consult', value: '8–15 minutes' },
      { label: 'Consults per clinician per day', value: '10–18' },
      { label: 'Target time recovered per clinician per day', value: '30–60 minutes' },
    ],
    note: 'Time recovery estimates are based on clinical workflow studies. Pilot includes clinician time measurement.',
  },
]

export default function RoiPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">ROI framework</h1>
          <p className="text-xl text-slate-600">
            Veridian Care creates measurable value across duplicate tests, referral delays, audit
            overhead, and clinician time. The pilot pathway establishes your actual baselines.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            All metrics below are representative estimates. Your actual numbers are established
            during the 90-day pilot.
          </p>
        </div>

        <div className="space-y-10">
          {roiCategories.map(({ title, icon, description, metrics, note }) => (
            <div key={title} className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl">{icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                  <p className="text-slate-600 mt-1 leading-relaxed">{description}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 my-6">
                {metrics.map(({ label, value }) => (
                  <div key={label} className="p-4 bg-teal-50 rounded-xl border border-teal-100 text-center">
                    <div className="text-2xl font-extrabold text-teal-700">{value}</div>
                    <div className="text-xs text-slate-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 italic">{note}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-slate-600 mb-6">
            Ready to establish your actual baselines with a 90-day pilot?
          </p>
          <Link
            href="/pilot"
            className="inline-flex px-8 py-4 rounded-xl font-bold text-lg text-white transition-colors"
            style={{ backgroundColor: '#0d9488' }}
          >
            Start pilot conversation →
          </Link>
        </div>
      </div>
    </div>
  )
}
