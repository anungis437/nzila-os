/**
 * TrustCore — Trust Center
 *
 * /trust-center/[orgId]
 *
 * Public, shareable compliance summary page.
 * - No authentication required to view
 * - No PII exposed (no names, emails, or raw incident data)
 * - Shows compliance posture, key controls, and privacy contact
 *
 * Share this link with procurement teams, partners, or customers
 * as a lightweight proof of compliance posture.
 */

import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  UserIcon,
  BuildingOffice2Icon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { evaluateCompliance } from '@/lib/compliance/engine'
import { listTrustcorePrivacyPrograms } from '@nzila/db/queries/trustcore'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import { gateTrustCenter } from '@/lib/billing/featureAccess'
import type { ComplianceEvaluation } from '@/types/core'

export const dynamic = 'force-dynamic'

// ── Safe status derivation ─────────────────────────────────────────────────

const STATUS_STYLES: Record<ComplianceEvaluation['status'], string> = {
  compliant: 'bg-green-100 text-green-700 border-green-200',
  'at-risk': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'non-compliant': 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_ICON: Record<ComplianceEvaluation['status'], React.ComponentType<{ className?: string }>> = {
  compliant: CheckCircleIcon,
  'at-risk': ExclamationTriangleIcon,
  'non-compliant': XCircleIcon,
}

// ── Control summary (public-safe, derived from evaluation) ─────────────────

function derivePublicControls(evaluation: ComplianceEvaluation): { label: string; passing: boolean }[] {
  const hasBlockingGovernance = evaluation.risks.some((r) => r.category === 'governance' && r.severity === 'critical')
  const hasBlockingIncident = evaluation.risks.some((r) => r.category === 'incident' && r.blocking)
  const hasDsrOverdue = evaluation.risks.some((r) => r.id === 'dsr-overdue')
  const hasVendorGap = evaluation.risks.some((r) => r.category === 'vendor')

  return [
    { label: 'Privacy Program Established', passing: !hasBlockingGovernance },
    { label: 'Incident Response Capability', passing: !hasBlockingIncident },
    { label: 'Data Subject Rights Handling', passing: !hasDsrOverdue },
    { label: 'Vendor Risk Management', passing: !hasVendorGap },
    { label: 'Privacy Impact Assessment Process', passing: evaluation.risks.every((r) => r.category !== 'pia' || r.severity !== 'high') },
    { label: 'Data Inventory Maintained', passing: evaluation.risks.every((r) => r.id !== 'data-no-assets') },
  ]
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function TrustCenterPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  // ── Billing gate (server-side) ────────────────────────────────────────────
  const subscription = await getResolvedSubscription(orgId)
  const gate = gateTrustCenter(subscription)
  if (!gate.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <LockClosedIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Trust Center Unavailable</h1>
          <p className="text-sm text-gray-500">
            This organization&apos;s Trust Center is not publicly available on their current plan.
          </p>
        </div>
      </div>
    )
  }

  // Fetch evaluation and privacy program in parallel
  const [evaluation, programs] = await Promise.all([
    evaluateCompliance(orgId),
    listTrustcorePrivacyPrograms(orgId),
  ])

  const activeProgram = programs.find((p) => p.status === 'active') ?? null
  const controls = derivePublicControls(evaluation)
  const StatusIcon = STATUS_ICON[evaluation.status]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <ShieldCheckIcon className="h-7 w-7 text-teal-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">TrustCore — Trust Center</h1>
            <p className="text-xs text-gray-500">Law 25 (Quebec) Compliance Transparency</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Org identity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Organisation</h2>
          </div>
          <p className="text-sm text-gray-700">
            Organisation ID: <span className="font-mono text-gray-900">{orgId}</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Last evaluated: {new Date(evaluation.evaluatedAt).toLocaleString()}
          </p>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <StatusIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Compliance Status</h2>
          </div>

          <div className="flex items-center gap-5">
            {/* Score */}
            <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-gray-100 bg-gray-50 shrink-0">
              <span className="text-3xl font-black text-gray-900">{evaluation.score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>

            <div className="flex-1">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${STATUS_STYLES[evaluation.status]}`}>
                {evaluation.status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <p className="text-xs text-gray-500 mt-2">
                Score confidence: {evaluation.confidence}%
                {evaluation.confidence < 60 && (
                  <span className="ml-2 text-yellow-600 font-medium">(Low — not all modules populated)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Key Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <InformationCircleIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Security &amp; Privacy Controls</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {controls.map((ctrl) => (
              <div key={ctrl.label} className="flex items-center gap-3">
                {ctrl.passing ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-400 shrink-0" />
                )}
                <span className="text-sm text-gray-700">{ctrl.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Practices */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privacy Practices</h2>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <span className="font-medium">Framework:</span> Quebec Law 25 (An Act to modernize legislative provisions as regards the protection of personal information)
            </p>
            <p>
              <span className="font-medium">Incident Response:</span> This organisation maintains an incident response procedure and logs all privacy incidents.
            </p>
            <p>
              <span className="font-medium">Data Subject Rights:</span> Requests for access, correction, deletion, and portability are processed within the 30-day statutory window.
            </p>
            <p>
              <span className="font-medium">Vendor Management:</span> Third-party processors are assessed for risk and contractually bound to data protection obligations.
            </p>
            <p>
              <span className="font-medium">Audit Logging:</span> All compliance actions are recorded with immutable timestamps and actor attribution.
            </p>
          </div>
        </div>

        {/* Privacy Officer contact */}
        {activeProgram?.privacyOfficerEmail && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privacy Officer Contact</h2>
            </div>
            <p className="text-sm text-gray-700">
              For privacy inquiries, please contact our designated Privacy Officer:
            </p>
            <p className="mt-2">
              <a
                href={`mailto:${activeProgram.privacyOfficerEmail}`}
                className="text-teal-600 hover:text-teal-700 font-medium text-sm underline"
              >
                {activeProgram.privacyOfficerEmail}
              </a>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            This Trust Center page is auto-generated by TrustCore. Data reflects the compliance posture as of the last evaluation.
            It is provided for transparency purposes and does not constitute a legal compliance certification.
          </p>
        </div>
      </main>
    </div>
  )
}
