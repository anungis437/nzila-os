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

import type { Metadata } from 'next'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  UserIcon,
  BuildingOffice2Icon,
  LockClosedIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import { evaluateCompliance } from '@/lib/compliance/engine'
import { listTrustcorePrivacyPrograms, getLatestComplianceSnapshot } from '@nzila/db/queries/trustcore'
import { requireFeature, FeatureGateError } from '@/lib/billing/requireFeature'
import { TrustCenterShareButton } from '@/components/trust-center/TrustCenterShareButton'
import type { ComplianceEvaluation } from '@/types/core'

export const dynamic = 'force-dynamic'

// ── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgId: string }>
}): Promise<Metadata> {
  const { orgId } = await params
  // Resolve org display name from the active privacy program (denormalised
  // `org_name` column added in migration 0025). Falls back to `orgId` when
  // unset so the page remains renderable for newly-onboarded orgs.
  let orgName = orgId
  try {
    const programs = await listTrustcorePrivacyPrograms(orgId)
    const active = programs.find((p) => p.status === 'active') ?? programs[0]
    if (active?.orgName) {
      orgName = active.orgName
    }
  } catch {
    // Metadata generation is best-effort; never fail the page render here.
  }

  return {
    title: `Trust Center — ${orgName}`,
    description: 'Law 25 compliance status and privacy practices — powered by TrustCore.',
    openGraph: {
      title: `Trust Center — ${orgName}`,
      description: 'Law 25 (Quebec) compliance status and privacy practices.',
    },
  }
}

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
  let gateBlocked = false
  try {
    await requireFeature(orgId, 'trust_center')
  } catch (err) {
    if (err instanceof FeatureGateError) {
      gateBlocked = true
    } else {
      throw err
    }
  }
  if (gateBlocked) {
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

  // Fetch evaluation, privacy program, and latest snapshot in parallel
  const [evaluation, programs, latestSnapshot] = await Promise.all([
    evaluateCompliance(orgId),
    listTrustcorePrivacyPrograms(orgId),
    getLatestComplianceSnapshot(orgId),
  ])

  const activeProgram = programs.find((p) => p.status === 'active') ?? null
  const controls = derivePublicControls(evaluation)
  const StatusIcon = STATUS_ICON[evaluation.status]
  const lastEvaluated = latestSnapshot?.createdAt ?? new Date(evaluation.evaluatedAt)
  const trustCenterUrl = `/trust-center/${orgId}`

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-5 print:border-gray-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ShieldCheckIcon className="h-8 w-8 text-teal-600 shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">Trust Center</h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-700">
                  <GlobeAltIcon className="h-3.5 w-3.5" />
                  Public Trust Page
                </span>
              </div>
              <p className="text-sm text-gray-500">Law 25 (Quebec) Compliance Status — powered by TrustCore</p>
            </div>
          </div>

          {/* Share actions */}
          <div className="flex items-center gap-2 print:hidden">
            <TrustCenterShareButton url={trustCenterUrl} />
            <a
              href={trustCenterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
            >
              Open in new tab ↗
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8 print:py-6">

        {/* Org identity + scope */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-4">
            <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Organisation</h2>
          </div>
          <p className="text-sm text-gray-700">
            Organisation ID: <span className="font-mono text-gray-900">{orgId}</span>
          </p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            This organisation&apos;s privacy compliance is assessed against the requirements of
            Quebec&apos;s <strong>Law 25</strong> (<em>An Act to modernize legislative provisions as
            regards the protection of personal information</em>). This page is published
            voluntarily for transparency with customers, partners, and procurement teams.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Last evaluated: <span className="font-medium text-gray-500">
              {lastEvaluated.toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' })}
            </span>
          </p>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-5">
            <StatusIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Law 25 Compliance Status</h2>
          </div>

          <div className="flex items-center gap-5">
            {/* Score ring */}
            <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 border-gray-100 bg-gray-50 shrink-0">
              <span className="text-3xl font-black text-gray-900">{evaluation.score}</span>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>

            <div className="flex-1">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${STATUS_STYLES[evaluation.status]}`}>
                {evaluation.status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <p className="text-xs text-gray-500 mt-2">
                Assessment confidence: {evaluation.confidence}%
                {evaluation.confidence < 60 && (
                  <span className="ml-2 text-yellow-600 font-medium">(Partial — not all modules populated)</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Score reflects active risk deductions across governance, data, PIAs, incidents, DSR, and vendors.
              </p>
            </div>
          </div>
        </div>

        {/* Key Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
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

        {/* Privacy Practices */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
          <div className="flex items-center gap-3 mb-5">
            <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privacy Practices</h2>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <span className="font-medium">Regulatory Framework:</span>{' '}
              Quebec Law 25 (An Act to modernize legislative provisions as regards the protection of personal information)
            </p>
            <p>
              <span className="font-medium">Incident Response:</span>{' '}
              This organisation maintains a formal incident response procedure. All privacy incidents are logged, triaged, and reported to the Commission d&apos;accès à l&apos;information (CAI) where required by law.
            </p>
            <p>
              <span className="font-medium">Data Subject Rights:</span>{' '}
              Requests for access, rectification, deletion, and portability are accepted and processed within the 30-day statutory window under Law 25.
            </p>
            <p>
              <span className="font-medium">Vendor Management:</span>{' '}
              All third-party processors are assessed for risk and contractually bound to data protection obligations before access to personal information is granted.
            </p>
            <p>
              <span className="font-medium">Data Retention:</span>{' '}
              Personal information is retained only as long as necessary for the stated purpose and then securely destroyed or anonymized.
            </p>
          </div>
        </div>

        {/* Audit Statement */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 print:border-teal-300">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800 mb-1">Immutable Audit Log</p>
              <p className="text-sm text-teal-700 leading-relaxed">
                This organisation maintains an immutable audit log of all compliance-related actions.
                Every change is recorded with a timestamp, actor attribution, and action summary.
                Evidence is available upon request to verified auditors or regulatory bodies.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Officer contact */}
        {activeProgram?.privacyOfficerEmail && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 print:border-gray-300">
            <div className="flex items-center gap-3 mb-4">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Privacy Officer Contact</h2>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              For privacy inquiries, data subject rights requests, or questions about this organisation&apos;s
              compliance program, please contact the designated Privacy Officer:
            </p>
            {activeProgram.privacyOfficerName && (
              <p className="text-sm font-medium text-gray-900">{activeProgram.privacyOfficerName}</p>
            )}
            {activeProgram.privacyOfficerRole && (
              <p className="text-xs text-gray-500 mb-1">{activeProgram.privacyOfficerRole}</p>
            )}
            <a
              href={`mailto:${activeProgram.privacyOfficerEmail}`}
              className="text-teal-600 hover:text-teal-700 font-medium text-sm underline"
            >
              {activeProgram.privacyOfficerEmail}
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 print:pt-4">
          <p className="text-xs text-gray-400">
            This Trust Center page is auto-generated by TrustCore and reflects the compliance posture as of the
            last evaluation. It is provided for transparency purposes and does not constitute a legal compliance
            certification. Last assessed: {lastEvaluated.toLocaleDateString('en-CA')}.
          </p>
        </div>
      </main>
    </div>
  )
}
