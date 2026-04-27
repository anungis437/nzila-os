import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Security Posture' }

const securityControls = [
  {
    category: 'Encryption',
    items: [
      'All data encrypted at rest using AES-256.',
      'All data in transit protected via TLS 1.2+ (TLS 1.3 preferred).',
      'Encryption keys managed per tenant — no shared key material.',
      'Database-level encryption applied at the storage layer.',
    ],
  },
  {
    category: 'Secrets Management',
    items: [
      'No secrets in source code or environment variables in plaintext.',
      'Secrets stored in a managed vault with rotation policies.',
      'Access to secrets is audited and role-gated.',
      'Connector credentials are tenant-scoped and encrypted at rest.',
    ],
  },
  {
    category: 'Audit Logging',
    items: [
      'All API requests logged with actor identity and outcome.',
      'Audit log writes are append-only — no modification or deletion.',
      'Failed authentication attempts logged and alertable.',
      'Break-glass access events generate immediate notification.',
    ],
  },
  {
    category: 'Least Privilege',
    items: [
      'Service accounts carry minimum required permissions.',
      'No wildcard IAM policies in production environments.',
      'Database users have read/write separation — no admin access from application layer.',
      'Network access follows zero-trust principles — no implicit trust by network position.',
    ],
  },
  {
    category: 'Tenant Scoping',
    items: [
      'Row-level tenant scoping enforced at query layer.',
      'Cross-tenant queries are architecturally prevented.',
      'Each tenant\'s data can be isolated, exported, or deleted independently.',
      'Tenant onboarding follows a provisioning checklist with access review sign-off.',
    ],
  },
  {
    category: 'Infrastructure',
    items: [
      'Deployments use immutable infrastructure patterns.',
      'No long-lived SSH keys or interactive production access.',
      'Security patches applied on a defined SLA — critical within 24 hours.',
      'Canadian hosting option available for provincial data residency requirements.',
    ],
  },
]

export default function SecurityPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Security posture</h1>
          <p className="text-xl text-slate-600">
            Veridian Care is designed for healthcare environments where security is a baseline
            expectation, not a differentiator.
          </p>
        </div>

        <div className="space-y-10">
          {securityControls.map(({ category, items }) => (
            <div key={category} className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-5">{category}</h2>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <span className="text-teal-500 mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 bg-amber-50 rounded-2xl border border-amber-200">
          <h2 className="text-xl font-bold text-amber-900 mb-3">Responsible disclosure</h2>
          <p className="text-amber-800 leading-relaxed">
            Veridian Care operates a responsible disclosure program. Security researchers who
            identify genuine vulnerabilities are invited to contact{' '}
            <a
              href="mailto:security@veridiancare.health"
              className="font-semibold underline"
            >
              security@veridiancare.health
            </a>
            . We commit to acknowledging reports within 48 hours and providing a remediation
            timeline within 10 business days.
          </p>
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
