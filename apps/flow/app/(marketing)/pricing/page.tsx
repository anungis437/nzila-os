import Link from 'next/link'
import { RoiCalculator } from './roi-calculator'

const plans = [
  {
    name: 'Starter',
    price: '$39',
    note: 'per workspace / month',
    features: ['Up to 5 users', 'Quote + invoice essentials', 'Email support'],
    cta: 'Start Starter',
    href: '/trial',
  },
  {
    name: 'Growth',
    price: '$149',
    note: 'per workspace / month',
    features: ['Unlimited workflows', 'Approvals + SLA tracking', 'Owner intelligence metrics', 'Priority support'],
    cta: 'Choose Growth',
    href: '/trial',
  },
  {
    name: 'Pro',
    price: '$329',
    note: 'per workspace / month',
    features: ['Advanced governance', 'API + webhooks', 'Audit trail + exports', 'Dedicated success manager'],
    cta: 'Choose Pro',
    href: '/trial',
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white pt-24">
      <section className="mx-auto max-w-7xl px-6 py-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-navy">Pricing That Scales With Ops</h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">From first workflow to cross-team operations control, Flow keeps complexity low and outcomes measurable.</p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-2xl border border-gray-200 p-8 bg-white shadow-sm">
            <h2 className="text-xl font-bold text-navy">{plan.name}</h2>
            <p className="mt-3 text-4xl font-black text-navy">{plan.price}</p>
            <p className="text-sm text-gray-500">{plan.note}</p>
            <ul className="mt-6 space-y-2 text-sm text-gray-700">
              {plan.features.map((f) => <li key={f}>• {f}</li>)}
            </ul>
            <Link href={plan.href} className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-electric px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors">{plan.cta}</Link>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <RoiCalculator />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="text-xl font-bold text-navy">Customer Proof</h2>
          <p className="mt-2 text-sm text-gray-600">
            Testimonial CMS block placeholder. Connect your content source to rotate vertical-specific proof here.
          </p>
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
            Example: &quot;Flow reduced quote response time by 42% in our first 30 days.&quot;
          </div>
        </div>
      </section>
    </main>
  )
}
