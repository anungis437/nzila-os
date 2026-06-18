/**
 * Nzila OS — Pilot Summary Export Page
 *
 * One-click exportable pilot summary — combines release attestation,
 * SLO summary, lifecycle, integrity, ops digest, and isolation proof
 * into a procurement-ready JSON bundle.
 *
 * @see @nzila/platform-ops/pilot-export
 */
import { requireRole } from '@/lib/rbac'
import {
  createDefaultPilotPorts,
  generatePilotPack,
  type PilotSummaryPack,
} from '@nzila/platform-ops'
import {
  DocumentArrowDownIcon,
  ShieldCheckIcon,
  ServerIcon,
  ClockIcon,
  FingerPrintIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { platformDb } from '@nzila/db/platform'
import { orgs } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { getExecutiveOrgId } from '@/lib/executive-os'

export const dynamic = 'force-dynamic'

// ── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {ok ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
      {label}
    </span>
  )
}

interface SectionCardProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}

function SectionCard({ title, icon: Icon, children }: SectionCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="inline-flex p-2 bg-gray-50 rounded-lg">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-900">{value ?? '—'}</span>
    </div>
  )
}

// ── Page Component ─────────────────────────────────────────────────────────

export default async function PilotExportPage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const orgId = await getExecutiveOrgId()
  const org = orgId
    ? await platformDb.query.orgs.findFirst({ where: eq(orgs.id, orgId) }).catch(() => null)
    : null
  const orgName =
    (org && 'displayName' in org && org.displayName && String(org.displayName)) ||
    org?.legalName ||
    null
  const exportScope = orgName && orgId ? `${orgName} (${orgId})` : orgId || 'Unscoped preview (no active org resolved)'

  const ports = createDefaultPilotPorts()
  const pack: PilotSummaryPack = await generatePilotPack(ports)
  const bundle = pack.bundle

  const bundleJson = JSON.stringify(pack, null, 2)
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(bundleJson)}`

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pilot Summary Pack</h1>
          <p className="text-gray-500 mt-1">
            Procurement-ready platform attestation bundle with verifiable manifest
          </p>
        </div>
        <a
          href={downloadHref}
          download={`nzila-pilot-pack-${bundle.release.version}.json`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          <DocumentArrowDownIcon className="h-5 w-5" />
          Download JSON
        </a>
      </div>

      {/* Metadata bar */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-gray-500">Export Scope:</span>{' '}
          <span className="font-semibold">{exportScope}</span>
        </div>
        <div>
          <span className="text-gray-500">Platform:</span>{' '}
          <span className="font-semibold">{bundle.platformName}</span>
        </div>
        <div>
          <span className="text-gray-500">Pack Version:</span>{' '}
          <span className="font-mono">{pack.metadata.formatVersion}</span>
        </div>
        <div>
          <span className="text-gray-500">Sections:</span>{' '}
          <span className="font-mono">{pack.metadata.sectionCount}</span>
        </div>
        <div>
          <span className="text-gray-500">Exported At:</span>{' '}
          <span className="font-mono">{new Date(bundle.exportedAt).toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">Signature:</span>{' '}
          <span className="font-mono text-xs">{bundle.signatureHash.slice(0, 24)}…</span>
        </div>
      </div>

      {/* Section grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Release Attestation */}
        <SectionCard title="Release Attestation" icon={ServerIcon}>
          <InfoRow label="Version" value={bundle.release.version} />
          <InfoRow label="Commit" value={bundle.release.commitSha.slice(0, 12)} />
          <InfoRow label="Build" value={new Date(bundle.release.buildTimestamp).toLocaleString()} />
          <InfoRow label="Contract Hash" value={bundle.release.contractTestHash.slice(0, 20)} />
          <div className="mt-2">
            <StatusBadge ok={bundle.release.ciPipelineStatus === 'pass'} label={`CI: ${bundle.release.ciPipelineStatus}`} />
          </div>
        </SectionCard>

        {/* SLO Summary */}
        <SectionCard title="SLO Summary" icon={ChartBarIcon}>
          <InfoRow label="Total Metrics" value={bundle.slo.totalMetrics} />
          <InfoRow label="Compliant" value={bundle.slo.compliantCount} />
          <InfoRow label="Violations" value={bundle.slo.violationCount} />
          <InfoRow label="Compliance %" value={`${bundle.slo.compliancePct}%`} />
          {bundle.slo.highlights.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {bundle.slo.highlights.map((h, i) => (
                <p key={i}>• {h}</p>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Data Lifecycle */}
        <SectionCard title="Data Lifecycle" icon={ClockIcon}>
          <div className="flex gap-2 mb-2">
            <StatusBadge ok={bundle.lifecycle.retentionPolicyActive} label="Retention Active" />
            <StatusBadge ok={bundle.lifecycle.gdprCompliant} label="GDPR" />
          </div>
          <InfoRow label="Classification" value={bundle.lifecycle.dataClassification} />
          <InfoRow label="Last Purge" value={bundle.lifecycle.lastPurgeDate} />
        </SectionCard>

        {/* Integrity */}
        <SectionCard title="Integrity Status" icon={FingerPrintIcon}>
          <InfoRow label="Audit Hash" value={bundle.integrity.auditIntegrityHash.slice(0, 20)} />
          <div className="flex gap-2 mt-2">
            <StatusBadge ok={bundle.integrity.secretScanStatus === 'pass'} label={`Secrets: ${bundle.integrity.secretScanStatus}`} />
            <StatusBadge ok={bundle.integrity.tamperProofStatus === 'verified'} label={`Tamper: ${bundle.integrity.tamperProofStatus}`} />
          </div>
          <InfoRow label="Red Team" value={bundle.integrity.redTeamSummary} />
        </SectionCard>

        {/* Ops Digest */}
        <SectionCard title="Ops Digest Snapshot" icon={ShieldCheckIcon}>
          <InfoRow label="SLO Violations" value={bundle.opsDigest.sloViolations} />
          <InfoRow label="Warnings" value={bundle.opsDigest.warnings} />
          <InfoRow label="Criticals" value={bundle.opsDigest.criticals} />
          <InfoRow label="Confidence Score" value={bundle.opsDigest.opsConfidenceScore ?? '—'} />
          <InfoRow label="Grade" value={bundle.opsDigest.opsConfidenceGrade ?? '—'} />
        </SectionCard>

        {/* Isolation Proof */}
        <SectionCard title="Org Isolation Proof" icon={BuildingOffice2Icon}>
          <div className="mb-2">
            <StatusBadge ok={bundle.isolation.isolationVerified} label={bundle.isolation.isolationVerified ? 'Verified' : 'Unverified'} />
          </div>
          <InfoRow label="Orgs Checked" value={bundle.isolation.tenantsChecked} />
          <InfoRow label="Cross-Org Leaks" value={bundle.isolation.crossTenantLeaks} />
        </SectionCard>
      </div>

      {/* MANIFEST — verifiable per-section hashes */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex p-2 bg-gray-50 rounded-lg">
            <FingerPrintIcon className="h-5 w-5 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">MANIFEST.json</h3>
          <span className="ml-auto text-xs text-gray-400 font-mono">
            {pack.manifest.totalSizeBytes} bytes total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Section</th>
                <th className="text-left py-2 text-gray-500 font-medium">SHA-256 Hash</th>
                <th className="text-right py-2 text-gray-500 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {pack.manifest.sections.map((s) => (
                <tr key={s.section} className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-900">{s.section}</td>
                  <td className="py-2 font-mono text-xs text-gray-600">{s.hash.slice(0, 28)}…</td>
                  <td className="py-2 text-right font-mono text-gray-500">{s.sizeBytes}B</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
