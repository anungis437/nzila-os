import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Contact Veridian Care</h1>
          <p className="text-xl text-slate-600">
            We&apos;re available for pilot inquiries, integration questions, and partnership
            conversations.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">General inquiries</h2>
            <p className="text-slate-600 mb-4">For general questions about the Veridian Care platform.</p>
            <a
              href="mailto:contact@veridiancare.health"
              className="font-semibold text-teal-600 hover:underline text-lg"
            >
              contact@veridiancare.health
            </a>
          </div>

          <div className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Clinical pilot inquiries</h2>
            <p className="text-slate-600 mb-4">
              To start a conversation about a 90-day pilot for your organization.
            </p>
            <a
              href="mailto:pilot@veridiancare.health"
              className="font-semibold text-teal-600 hover:underline text-lg"
            >
              pilot@veridiancare.health
            </a>
          </div>

          <div className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Security & privacy</h2>
            <p className="text-slate-600 mb-4">
              For responsible disclosure, privacy inquiries, or data governance questions.
            </p>
            <a
              href="mailto:security@veridiancare.health"
              className="font-semibold text-teal-600 hover:underline text-lg"
            >
              security@veridiancare.health
            </a>
          </div>

          <div className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Investor relations</h2>
            <p className="text-slate-600 mb-4">
              For investor relations, partnership discussions, or financial inquiries.
            </p>
            <a
              href="mailto:investors@veridiancare.health"
              className="font-semibold text-teal-600 hover:underline text-lg"
            >
              investors@veridiancare.health
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
