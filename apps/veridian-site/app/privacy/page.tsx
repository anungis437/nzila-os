import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy Architecture' }

export default function PrivacyPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Privacy architecture</h1>
          <p className="text-xl text-slate-600">
            Privacy is a design constraint in Veridian Care — not a compliance checkbox.
          </p>
        </div>

        <div className="space-y-10">
          <section className="p-8 rounded-2xl border border-slate-200 bg-white">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">No PHI in demo environments</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Veridian Care&apos;s demonstration environment contains exclusively synthetic,
              fabricated data. No real patient health information (PHI) is present in any demo
              instance, pilot environment, or development environment. All patient names, dates of
              birth, medical record numbers, lab values, and clinical events visible in the demo
              are computer-generated and bear no resemblance to any real individual.
            </p>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-amber-800 text-sm font-medium">
                ⚠ SYNTHETIC DEMO DATA — All patient information shown in demos is fabricated.
                No real patient records are present.
              </p>
            </div>
          </section>

          <section className="p-8 rounded-2xl border border-slate-200 bg-white">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Consent engine</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              The Veridian consent engine maintains a per-patient, per-scope consent registry.
              Before any clinical data is surfaced to a requesting clinician, the consent engine
              evaluates:
            </p>
            <ul className="space-y-2 mb-4">
              {[
                'Has the patient granted consent for this data scope?',
                'Does the requesting clinician hold an appropriate role?',
                'Is the request originating from an enrolled site?',
                'Has the consent grant expired or been revoked?',
              ].map((q) => (
                <li key={q} className="flex items-start gap-3 text-slate-700">
                  <span className="text-teal-500 shrink-0">→</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-slate-600">
              A positive decision on all criteria is required before data is returned. The decision
              outcome is recorded as an immutable audit event regardless of whether access was
              granted or denied.
            </p>
          </section>

          <section className="p-8 rounded-2xl border border-slate-200 bg-white">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Break-glass protocol</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In emergency clinical situations where a patient is unable to provide consent,
              Veridian Care supports a break-glass access protocol. Break-glass access:
            </p>
            <ul className="space-y-2">
              {[
                'Requires the accessing clinician to provide a documented clinical reason.',
                'Is logged immediately as a high-priority audit event.',
                'Triggers notification to the responsible privacy officer.',
                'Is subject to post-hoc review within 24 hours.',
                'Cannot be invoked by automated processes — requires human actor.',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-slate-700">
                  <span className="text-teal-500 shrink-0 font-bold">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </section>

          <section className="p-8 rounded-2xl border border-slate-200 bg-white">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Data residency</h2>
            <p className="text-slate-600 leading-relaxed">
              Veridian Care offers a Canadian hosting option for organizations subject to provincial
              health data residency requirements. Data is stored and processed within Canadian
              geographic boundaries. Cross-border data transfer does not occur without explicit
              configuration and consent.
            </p>
          </section>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/trust"
            className="px-6 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: '#0d9488' }}
          >
            Trust & consent architecture →
          </Link>
        </div>
      </div>
    </div>
  )
}
