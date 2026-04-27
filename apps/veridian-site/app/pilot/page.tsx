import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pilot Program' }

const pilotIncludes = [
  {
    title: 'Synthetic demo environment',
    description:
      'A fully configured, integration-ready demo instance with synthetic patient data — available from day one.',
  },
  {
    title: 'Integration scoping session',
    description:
      'A structured discovery session to map your existing EMR, lab, and imaging systems to Veridian connector types.',
  },
  {
    title: 'Connector configuration support',
    description:
      'Hands-on support configuring FHIR, HL7 v2, or CSV connectors for your source systems.',
  },
  {
    title: 'Consent model workshop',
    description:
      'A working session to define consent scopes, role definitions, and site access rules for your organization.',
  },
  {
    title: 'Access governance review',
    description:
      'A structured review of your access governance requirements mapped to Veridian RBAC and audit capabilities.',
  },
  {
    title: 'KPI baseline and measurement',
    description:
      'Establishment of baseline metrics for duplicate test rate, referral delay, and history completeness.',
  },
  {
    title: 'Pilot readiness checklist',
    description:
      'A shared readiness checklist tracked weekly — covering integration, access, governance, and training.',
  },
  {
    title: '90-day production pathway',
    description:
      'A defined transition path from pilot to production — with success criteria agreed before kickoff.',
  },
]

const pilotSteps = [
  { step: '01', title: 'Discovery call', description: 'A 60-minute session to understand your environment, integration landscape, and clinical goals.' },
  { step: '02', title: 'Pilot agreement', description: 'A lightweight pilot agreement covering scope, data handling, and success metrics.' },
  { step: '03', title: 'Environment provisioning', description: 'Your synthetic demo environment is provisioned — typically within 5 business days.' },
  { step: '04', title: 'Integration configuration', description: 'Connector configuration begins. First synthetic data visible in the timeline within 2 weeks.' },
  { step: '05', title: 'Clinical workflow validation', description: 'Clinician team reviews the unified timeline, referral flow, and access controls.' },
  { step: '06', title: 'Governance review', description: 'Consent model, RBAC, and audit trail reviewed with your privacy and compliance team.' },
  { step: '07', title: 'KPI baseline', description: 'Duplicate test risk, referral delay, and history completeness metrics established.' },
  { step: '08', title: 'Pilot readout and decision', description: 'A structured readout at day 90 — with a clear recommendation on production pathway.' },
]

export default function PilotPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
            <span>🚀</span>
            <span>Pilot-ready</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">90-day pilot pathway</h1>
          <p className="text-xl text-slate-600">
            Veridian Care is designed for confident clinical pilots. We provide everything needed to
            demonstrate value — integration support, synthetic data, governance tooling — before you
            commit to production.
          </p>
        </div>

        {/* Pilot steps */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">The pilot pathway</h2>
          <div className="space-y-4">
            {pilotSteps.map(({ step, title, description }) => (
              <div key={step} className="flex gap-6 p-6 bg-white rounded-xl border border-slate-200">
                <div
                  className="text-2xl font-extrabold shrink-0 w-10 text-center"
                  style={{ color: '#0d9488' }}
                >
                  {step}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
                  <p className="text-slate-600 text-sm">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What's included */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">What&apos;s included</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {pilotIncludes.map(({ title, description }) => (
              <div key={title} className="p-6 rounded-xl border border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="p-10 bg-teal-900 rounded-2xl text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Start the pilot conversation</h2>
          <p className="text-teal-200 mb-8">
            Contact us to schedule a discovery call. No commitment required — just a 60-minute
            conversation about your environment.
          </p>
          <a
            href="mailto:pilot@veridiancare.health"
            className="inline-flex px-8 py-4 rounded-xl font-bold text-lg bg-teal-400 text-teal-900 hover:bg-teal-300 transition-colors"
          >
            pilot@veridiancare.health
          </a>
        </div>
      </div>
    </div>
  )
}
