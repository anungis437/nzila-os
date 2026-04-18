import Link from 'next/link'

const plans = [
  {
    name: 'Team',
    price: '$0',
    note: 'Up to 5 users',
    features: ['1 workflow', 'Basic analytics', 'Email support'],
    cta: 'Start Free',
    href: '/trial',
  },
  {
    name: 'Growth',
    price: '$249',
    note: 'per org / month',
    features: ['Unlimited workflows', 'Approvals + SLA tracking', 'Revenue analytics', 'Priority support'],
    cta: 'Start 14-day trial',
    href: '/trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    note: 'multi-org + SSO',
    features: ['Advanced governance', 'Custom integrations', 'Dedicated success manager', 'SLA guarantees'],
    cta: 'Contact sales',
    href: '/contact',
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
    </main>
  )
}
