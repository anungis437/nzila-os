import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Trust & Consent Architecture' }

const consentScopes = [
  { scope: 'READ_TIMELINE', description: 'Access to encounter history, visit summaries, and clinical events.' },
  { scope: 'READ_LABS', description: 'Access to laboratory results, values, and trends.' },
  { scope: 'READ_MEDICATIONS', description: 'Access to medication lists, prescriptions, and reconciliation data.' },
  { scope: 'READ_REFERRALS', description: 'Access to referral records and specialist communications.' },
  { scope: 'READ_FULL', description: 'Full record access — requires elevated role and consent.' },
  { scope: 'BREAK_GLASS', description: 'Emergency access override — requires reason, triggers immediate audit.' },
]

const auditEvents = [
  'Record access (by actor, role, patient, scope, timestamp)',
  'Consent grant and revocation events',
  'Break-glass access invocations with reason captured',
  'Failed access attempts (unauthorized or out-of-scope)',
  'Data ingestion events (source, schema version, record count)',
  'Administrative actions (user provisioning, site configuration)',
  'Access review completions and overrides',
]

export default function TrustPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">
            Trust & Consent Architecture
          </h1>
          <p className="text-xl text-slate-600">
            Veridian Care is designed with consent as a first-class architectural constraint —
            not an afterthought.
          </p>
        </div>

        {/* Consent Architecture */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Consent architecture</h2>
          <div className="p-6 bg-teal-50 rounded-2xl border border-teal-200 mb-8">
            <p className="text-teal-900 leading-relaxed">
              Every record access request in Veridian Care is evaluated against three axes:{' '}
              <strong>patient consent</strong>, <strong>clinician role</strong>, and{' '}
              <strong>site scope</strong>. No record is surfaced without a positive decision on all
              three. This decision is logged immutably as an audit event regardless of outcome.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {consentScopes.map(({ scope, description }) => (
              <div key={scope} className="p-4 bg-white rounded-xl border border-slate-200">
                <code className="text-sm font-mono text-teal-700 font-bold">{scope}</code>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RBAC */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Role-based access control</h2>
          <div className="space-y-4">
            {[
              { role: 'CLINICIAN', description: 'Read access to scoped patient records at enrolled sites. No administrative access.' },
              { role: 'SPECIALIST', description: 'Read access to referred patient context package only. No lateral browsing.' },
              { role: 'CARE_COORDINATOR', description: 'Read access to referral and timeline data for assigned patients.' },
              { role: 'SITE_ADMIN', description: 'Read/write access to site configuration. No direct patient data access.' },
              { role: 'NETWORK_ADMIN', description: 'Full platform administration. Access subject to MFA and audit.' },
              { role: 'AUDIT_REVIEWER', description: 'Read-only access to audit log. No clinical data access.' },
            ].map(({ role, description }) => (
              <div key={role} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <code className="text-sm font-mono font-bold text-violet-700 shrink-0 w-40">
                  {role}
                </code>
                <p className="text-sm text-slate-700">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Audit Trail */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Immutable audit trail</h2>
          <p className="text-slate-600 mb-6">
            Every action on Veridian Care — access, consent change, break-glass invocation, or
            administrative operation — is written to an append-only audit log. Entries cannot be
            modified or deleted. Logs are tenant-scoped and exportable for compliance review.
          </p>
          <ul className="space-y-3">
            {auditEvents.map((event) => (
              <li key={event} className="flex items-start gap-3 text-slate-700">
                <span className="text-teal-500 mt-0.5">●</span>
                {event}
              </li>
            ))}
          </ul>
        </section>

        {/* Data scoping */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Tenant-scoped data model</h2>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-slate-700 leading-relaxed">
              All data in Veridian Care is scoped to a tenant organization and site. Cross-tenant
              data access is architecturally prevented at the data layer — there is no multi-tenant
              query path that could expose one organization&apos;s records to another. Each
              tenant&apos;s data is logically isolated and can be exported or deleted independently.
            </p>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/security"
            className="px-6 py-3 rounded-xl font-semibold text-white transition-colors text-center"
            style={{ backgroundColor: '#0d9488' }}
          >
            Security posture →
          </Link>
          <Link
            href="/privacy"
            className="px-6 py-3 rounded-xl font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-center"
          >
            Privacy architecture →
          </Link>
        </div>
      </div>
    </div>
  )
}
