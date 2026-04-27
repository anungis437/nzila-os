import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'One patient story. Every location.',
}

const painPoints = [
  {
    icon: '🧩',
    title: 'Incomplete history',
    body: 'Clinicians see only part of the patient story — missed labs, duplicate tests, unknown medications.',
  },
  {
    icon: '🔗',
    title: 'Broken handoffs',
    body: 'Referrals go untracked. Specialists receive insufficient context. Care continuity breaks at transitions.',
  },
  {
    icon: '🔒',
    title: 'No governance layer',
    body: 'No unified consent trail. No audit log. No trust framework between institutions.',
  },
]

const modules = [
  {
    name: 'Veridian Connect',
    description:
      'Standards-aligned connector layer supporting FHIR, HL7 v2, CSV feeds, and API integrations.',
    color: 'bg-teal-50 border-teal-200',
    icon: '⚡',
  },
  {
    name: 'Veridian Timeline',
    description:
      'Unified patient chronology merging encounters, labs, medications, referrals, and imaging from every connected source.',
    color: 'bg-blue-50 border-blue-200',
    icon: '📋',
  },
  {
    name: 'Veridian Access',
    description:
      'Role-based consent enforcement with break-glass audit trails, RBAC, and site-scoped access controls.',
    color: 'bg-violet-50 border-violet-200',
    icon: '🛡️',
  },
  {
    name: 'Veridian Flow',
    description:
      'Referral tracking and handoff continuity across clinics, specialists, and facilities.',
    color: 'bg-amber-50 border-amber-200',
    icon: '🔄',
  },
  {
    name: 'Veridian Insight',
    description:
      'Network KPIs: duplicate test risk, referral delay, incomplete history rates, and access review completion.',
    color: 'bg-emerald-50 border-emerald-200',
    icon: '📊',
  },
]

const trustItems = [
  'Consent-aware access',
  'Immutable audit trails',
  'RBAC enforcement',
  'Encryption at rest and in transit',
  'Canadian hosting option',
  'Standards-aligned architecture',
  'Synthetic demo environment',
  'Tenant-scoped data model',
]

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-700/50 text-teal-200 text-sm font-medium mb-8">
            <span>🏥</span>
            <span>Healthcare interoperability, governed.</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            One patient story.
            <br />
            <span className="text-teal-300">Every location.</span>
          </h1>
          <p className="text-xl text-teal-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Veridian Care is a secure interoperability layer above fragmented EMRs — connecting
            clinical history, consent, and continuity without replacing existing systems.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pilot"
              className="px-8 py-4 rounded-xl font-bold text-lg bg-teal-400 text-teal-900 hover:bg-teal-300 transition-colors"
            >
              Request Clinical Demo
            </Link>
            <Link
              href="/product"
              className="px-8 py-4 rounded-xl font-bold text-lg border border-teal-400 text-teal-200 hover:bg-teal-800/50 transition-colors"
            >
              See how it works →
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              The problem with fragmented care
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Healthcare systems accumulate data silos. Patients move. Records don&apos;t.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map(({ icon, title, body }) => (
              <div
                key={title}
                className="p-8 rounded-2xl border border-slate-200 bg-slate-50 hover:shadow-md transition-shadow"
              >
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-24 px-6 bg-teal-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            A governed orchestration layer above existing infrastructure
          </h2>
          <p className="text-xl text-teal-100 leading-relaxed">
            Veridian Care does not replace your EMR. It surfaces a unified, consent-aware clinical
            view across all connected systems — preserving your existing investments while unlocking
            continuity of care across every site.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Five integrated modules
            </h2>
            <p className="text-lg text-slate-500">
              Each module addresses a distinct layer of the interoperability problem.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map(({ name, description, color, icon }) => (
              <div key={name} className={`p-6 rounded-2xl border ${color}`}>
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{name}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Designed for healthcare trust
            </h2>
            <p className="text-lg text-slate-500">
              Every design decision considers clinical context and regulatory expectation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                <span className="text-teal-500 text-xl font-bold">✓</span>
                <span className="text-slate-700 font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/trust" className="text-teal-600 font-semibold hover:underline">
              Read our Trust Architecture →
            </Link>
          </div>
        </div>
      </section>

      {/* Pilot CTA */}
      <section className="py-24 px-6 bg-teal-600 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">90-day pilot pathway</h2>
          <p className="text-xl text-teal-100 mb-10 leading-relaxed">
            Veridian Care is pilot-ready. We provide a synthetic demo environment, integration
            support, and a structured 90-day onboarding to prove value before production commitment.
          </p>
          <Link
            href="/pilot"
            className="inline-flex px-8 py-4 rounded-xl font-bold text-lg bg-white text-teal-700 hover:bg-teal-50 transition-colors"
          >
            Start pilot conversation →
          </Link>
        </div>
      </section>
    </div>
  )
}
