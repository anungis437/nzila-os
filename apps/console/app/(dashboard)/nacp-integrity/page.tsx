/**
 * Nzila OS — NACP Integrity Verification Dashboard
 *
 * Platform admin page showing:
 *   - Seal verification status per terminal event type
 *   - Last sealed events
 *   - Detected anomalies (missing seals, out-of-order, chain breaks)
 *   - Export proof hash
 *   - Hash chain status
 *
 * Allows platform admins to audit NACP integrity without database access.
 *
 * @see @nzila/platform-proof/nacp
 */
import { requireRole } from '@/lib/rbac'
import {
  generateNacpIntegrityProofSection,
  type NacpIntegrityProofPorts,
  type NacpSealStatus,
  type NacpAnomaly,
} from '@nzila/platform-proof'
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FingerPrintIcon,
  LinkIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Stub ports — replace with real DB queries when tables are available ────

const stubPorts: NacpIntegrityProofPorts = {
  fetchSealStatuses: async (_orgId: string): Promise<readonly NacpSealStatus[]> => [
    { eventType: 'SUBMISSION_SEALED', totalEvents: 0, sealedCount: 0, unsealedCount: 0, lastSealedAt: null, lastSubjectId: null },
    { eventType: 'GRADING_FINALIZED', totalEvents: 0, sealedCount: 0, unsealedCount: 0, lastSealedAt: null, lastSubjectId: null },
    { eventType: 'EXPORT_GENERATED', totalEvents: 0, sealedCount: 0, unsealedCount: 0, lastSealedAt: null, lastSubjectId: null },
  ],
  fetchAnomalies: async (): Promise<readonly NacpAnomaly[]> => [],
  fetchExportProofHash: async () => null,
  fetchHashChainInfo: async () => ({ length: 0, head: null }),
}

// ── Verdict UI ──────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: 'pass' | 'warn' | 'fail' }) {
  const styles = {
    pass: 'bg-green-100 text-green-800',
    warn: 'bg-amber-100 text-amber-800',
    fail: 'bg-red-100 text-red-800',
  }
  const icons = {
    pass: CheckCircleIcon,
    warn: ExclamationTriangleIcon,
    fail: XCircleIcon,
  }
  const Icon = icons[verdict]

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${styles[verdict]}`}>
      <Icon className="h-4 w-4" />
      {verdict.toUpperCase()}
    </span>
  )
}

// ── Seal Status Card ────────────────────────────────────────────────────────

function SealStatusCard({ status }: { status: NacpSealStatus }) {
  const sealRate = status.totalEvents > 0
    ? Math.round((status.sealedCount / status.totalEvents) * 100)
    : 100

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">{status.eventType}</h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            sealRate === 100
              ? 'bg-green-100 text-green-800'
              : sealRate >= 95
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {sealRate}% sealed
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Total Events</p>
          <p className="font-medium text-gray-900">{status.totalEvents}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Sealed</p>
          <p className="font-medium text-green-700">{status.sealedCount}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Unsealed</p>
          <p className={`font-medium ${status.unsealedCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {status.unsealedCount}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Last Sealed</p>
          <p className="font-medium text-gray-900 text-xs">
            {status.lastSealedAt
              ? new Date(status.lastSealedAt).toLocaleString()
              : 'Never'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Anomaly Row ─────────────────────────────────────────────────────────────

function AnomalyRow({ anomaly }: { anomaly: NacpAnomaly }) {
  const severityStyles = {
    chain_break: 'border-red-200 bg-red-50',
    missing_seal: 'border-red-200 bg-red-50',
    out_of_order: 'border-amber-200 bg-amber-50',
    duplicate_seal: 'border-amber-200 bg-amber-50',
  }

  return (
    <div className={`border rounded-lg p-4 ${severityStyles[anomaly.type]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-gray-600">{anomaly.type}</span>
        <span className="text-xs text-gray-400">
          {new Date(anomaly.detectedAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-gray-800">{anomaly.description}</p>
      <p className="text-xs text-gray-500 mt-1">
        Subject: {anomaly.subjectId} · Event: {anomaly.eventType}
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function NacpIntegrityPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')

  const params = await searchParams
  const orgId = params.orgId ?? 'default'
  const isExecutive = params.mode === 'executive'

  const section = await generateNacpIntegrityProofSection(orgId, stubPorts)

  const proofJson = JSON.stringify(section, null, 2)
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(proofJson)}`

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">NACP Integrity Verification</h1>
          <p className="text-gray-500 mt-1">
            Audit exam evidence integrity without database access
          </p>
        </div>
        <div className="flex items-center gap-4">
          <VerdictBadge verdict={section.integrityVerdict} />
          <a
            href={downloadHref}
            download={`nacp-integrity-${section.sectionId}.json`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Download Proof
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <p className="text-sm text-gray-500">Sealed Packs</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{section.totalSealedPacks}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <XCircleIcon className={`h-5 w-5 ${section.totalMissingSeals > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            <p className="text-sm text-gray-500">Missing Seals</p>
          </div>
          <p className={`text-2xl font-bold ${section.totalMissingSeals > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {section.totalMissingSeals}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon className="h-5 w-5 text-blue-500" />
            <p className="text-sm text-gray-500">Hash Chain Length</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{section.hashChainLength}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className={`h-5 w-5 ${section.anomalies.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            <p className="text-sm text-gray-500">Anomalies</p>
          </div>
          <p className={`text-2xl font-bold ${section.anomalies.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
            {section.anomalies.length}
          </p>
        </div>
      </div>

      {/* Seal Status per Terminal Event Type */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Seal Verification Status</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.sealStatuses.map((status) => (
            <SealStatusCard key={status.eventType} status={status} />
          ))}
        </div>
      </div>

      {/* Anomalies */}
      {section.anomalies.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Detected Anomalies
          </h2>
          <div className="space-y-3">
            {section.anomalies.map((anomaly, i) => (
              <AnomalyRow key={i} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {/* Hash Chain & Export Proof */}
      <div className="grid gap-6 sm:grid-cols-2 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Hash Chain Head</h3>
          </div>
          <p className="font-mono text-xs text-gray-800 break-all">
            {section.hashChainHead ?? 'No chain entries'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FingerPrintIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Export Proof Hash</h3>
          </div>
          <p className="font-mono text-xs text-gray-800 break-all">
            {section.exportProofHash ?? 'No export proof available'}
          </p>
        </div>
      </div>

      {/* Signature Block */}
      <div className="bg-gray-900 text-gray-100 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <ClockIcon className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">
            Section Signature
          </h2>
        </div>
        <p className="font-mono text-xs break-all text-green-300">{section.signatureHash}</p>
        <p className="text-xs text-gray-500 mt-2">
          Generated: {section.generatedAt} — Section ID: {section.sectionId}
        </p>
      </div>
    </div>
  )
}
