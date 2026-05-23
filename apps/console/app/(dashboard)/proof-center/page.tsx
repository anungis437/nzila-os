/**
 * Nzila OS — Procurement Proof Center
 *
 * Server-rendered page backed by procurement-proof collectors. Scores,
 * status pills and evidence references are derived from the collector
 * chain. The current port adapter is in-memory and is intended for
 * development / staging dry-runs only — in production the page throws
 * unless real DB-backed RealPortsDeps are wired (see proof-center-ports.ts).
 *
 * Sovereignty: Canada Central / PIPEDA + Québec Law 25.
 *
 * @see @nzila/platform-procurement-proof
 */
import { requireRole } from '@/lib/rbac'
import {
  collectProcurementPack,
  signProcurementPack,
  createRealPorts,
} from '@nzila/platform-procurement-proof'
import { createPortDeps } from '@/lib/proof-center-ports'
import {
  ShieldCheckIcon,
  ServerIcon,
  DocumentArrowDownIcon,
  FingerPrintIcon,
  GlobeAltIcon,
  CircleStackIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Helpers ─────────────────────────────────────────────────────────────────

type TruthStatus = 'ok' | 'not_available'
type SectionItem = { label: string; status: 'pass' | 'warn' | 'fail'; detail: string }

function gradeOf(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const SECTION_META = {
  security: { title: 'Security Posture', icon: ShieldCheckIcon },
  dataLifecycle: { title: 'Data Lifecycle', icon: CircleStackIcon },
  operational: { title: 'Operational Evidence', icon: ServerIcon },
  governance: { title: 'Governance Evidence', icon: EyeIcon },
  sovereignty: { title: 'Sovereignty Profile', icon: GlobeAltIcon },
} as const

// ── UI Components ───────────────────────────────────────────────────────────

function TruthPill({ status }: { status: TruthStatus }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircleIcon className="h-3.5 w-3.5" /> OK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      <XCircleIcon className="h-3.5 w-3.5" /> Not Available
    </span>
  )
}

function StatusBadge({ status }: { status: SectionItem['status'] }) {
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircleIcon className="h-3.5 w-3.5" /> Pass
      </span>
    )
  }
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
        <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Warning
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <ExclamationTriangleIcon className="h-3.5 w-3.5" /> Fail
    </span>
  )
}

function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  const color =
    score >= 90 ? 'text-green-700 bg-green-50' :
    score >= 70 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${color}`}>
      {grade} ({score}/100)
    </span>
  )
}

interface ProofSectionData {
  title: string
  icon: typeof ShieldCheckIcon
  score: number
  grade: string
  truthStatus: TruthStatus
  collectedAt: string
  items: SectionItem[]
}

function ProofSectionCard({ section }: { section: ProofSectionData }) {
  const Icon = section.icon
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <TruthPill status={section.truthStatus} />
          <ScoreBadge score={section.score} grade={section.grade} />
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">Collected: {section.collectedAt}</p>
      <div className="space-y-3">
        {section.items.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-500">{item.detail}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProofCenterPage({
  searchParams,
}: { searchParams: Promise<{ mode?: string }> }) {
  await requireRole('platform_admin', 'studio_admin')
  const params = await searchParams
  const isExecutive = params.mode === 'executive'

  // ── Collect real data via port chain ───────────────────────────────────────
  const portDeps = createPortDeps('org')
  const ports = createRealPorts(portDeps)
  const pack = await collectProcurementPack('org', 'proof-center-page', ports)
  const signed = await signProcurementPack(pack, ports)

  const sect = pack.sections
  const now = pack.generatedAt

  // ── Derive section scores ─────────────────────────────────────────────────
  const secScore = sect.security.vulnerabilitySummary.score
  const dlScore = sect.dataLifecycle.retentionControls.policiesEnforced === sect.dataLifecycle.retentionControls.policiesTotal ? 100 : 80
  const opsScore = sect.operational.sloCompliance.overall >= 99 ? 95 : 80
  const govScore = sect.governance.snapshotChainValid ? 95 : 60
  const sovScore = sect.sovereignty.validated ? 100 : 50

  const overallScore = Math.round((secScore + dlScore + opsScore + govScore + sovScore) / 5)
  const overallGrade = gradeOf(overallScore)

  // ── Build section cards from real data ─────────────────────────────────────
  const sectionCards: ProofSectionData[] = [
    {
      ...SECTION_META.security,
      score: secScore,
      grade: gradeOf(secScore),
      truthStatus: secScore > 0 ? 'ok' : 'not_available',
      collectedAt: now,
      items: [
        { label: 'Dependency audit', status: secScore > 0 ? 'pass' : 'fail', detail: `${sect.security.dependencyAudit.criticalVulnerabilities} critical, ${sect.security.dependencyAudit.highVulnerabilities} high vulnerabilities` },
        { label: 'Signed attestation', status: sect.security.signedAttestation.attestationId !== 'not_available' ? 'pass' : 'fail', detail: `${sect.security.signedAttestation.algorithm}, ${sect.security.signedAttestation.scope}` },
        { label: 'Lockfile integrity', status: sect.security.dependencyAudit.lockfileIntegrity ? 'pass' : 'warn', detail: sect.security.dependencyAudit.lockfileIntegrity ? 'Verified' : 'Not verified' },
        { label: 'License compliance', status: sect.security.dependencyAudit.blockedLicenses.length === 0 ? 'pass' : 'fail', detail: sect.security.dependencyAudit.blockedLicenses.length === 0 ? 'No blocked licenses' : `Blocked: ${sect.security.dependencyAudit.blockedLicenses.join(', ')}` },
      ],
    },
    {
      ...SECTION_META.dataLifecycle,
      score: dlScore,
      grade: gradeOf(dlScore),
      truthStatus: 'ok',
      collectedAt: now,
      items: [
        { label: 'Data manifests', status: 'pass', detail: `${sect.dataLifecycle.manifests.length} manifests (${sect.dataLifecycle.manifests.map((m) => m.dataCategory).join(', ')})` },
        { label: 'Retention controls', status: sect.dataLifecycle.retentionControls.policiesEnforced === sect.dataLifecycle.retentionControls.policiesTotal ? 'pass' : 'warn', detail: `${sect.dataLifecycle.retentionControls.policiesEnforced}/${sect.dataLifecycle.retentionControls.policiesTotal} policies enforced` },
        { label: 'Encryption at rest', status: sect.dataLifecycle.manifests.every((m) => m.encryptionAtRest) ? 'pass' : 'fail', detail: sect.dataLifecycle.manifests.every((m) => m.encryptionAtRest) ? 'All stores encrypted' : 'Some stores unencrypted' },
        { label: 'Auto-delete enabled', status: sect.dataLifecycle.retentionControls.autoDeleteEnabled ? 'pass' : 'warn', detail: sect.dataLifecycle.retentionControls.autoDeleteEnabled ? 'Active' : 'Disabled' },
      ],
    },
    {
      ...SECTION_META.operational,
      score: opsScore,
      grade: gradeOf(opsScore),
      truthStatus: 'ok',
      collectedAt: now,
      items: [
        { label: 'SLO compliance', status: sect.operational.sloCompliance.overall >= 99 ? 'pass' : 'warn', detail: `${sect.operational.sloCompliance.overall}% overall` },
        { label: 'p95 latency', status: sect.operational.performanceMetrics.p95Ms < 500 ? 'pass' : 'warn', detail: `${sect.operational.performanceMetrics.p95Ms}ms (target: 500ms)` },
        { label: 'Error rate', status: sect.operational.performanceMetrics.errorRate < 1.0 ? 'pass' : 'fail', detail: `${sect.operational.performanceMetrics.errorRate}% (target: 1%)` },
        { label: 'Incident MTTR', status: sect.operational.incidentSummary.meanTimeToResolutionMinutes <= 30 ? 'pass' : 'warn', detail: `${sect.operational.incidentSummary.meanTimeToResolutionMinutes} minutes` },
      ],
    },
    {
      ...SECTION_META.governance,
      score: govScore,
      grade: gradeOf(govScore),
      truthStatus: sect.governance.snapshotChainLength > 0 ? 'ok' : 'not_available',
      collectedAt: now,
      items: [
        { label: 'Evidence packs', status: sect.governance.evidencePackCount > 0 ? 'pass' : 'warn', detail: `${sect.governance.evidencePackCount} sealed packs` },
        { label: 'Snapshot chain', status: sect.governance.snapshotChainValid ? 'pass' : 'warn', detail: `${sect.governance.snapshotChainLength} entries, ${sect.governance.snapshotChainValid ? 'verified' : 'unverified'}` },
        { label: 'Policy compliance', status: sect.governance.policyComplianceRate >= 1 ? 'pass' : 'warn', detail: `${(sect.governance.policyComplianceRate * 100).toFixed(0)}%` },
        { label: 'Control coverage', status: 'pass', detail: sect.governance.controlFamiliesCovered.join(', ') },
      ],
    },
    {
      ...SECTION_META.sovereignty,
      score: sovScore,
      grade: gradeOf(sovScore),
      truthStatus: 'ok',
      collectedAt: now,
      items: [
        { label: 'Deployment region', status: 'pass', detail: sect.sovereignty.deploymentRegion },
        { label: 'Data residency', status: 'pass', detail: sect.sovereignty.dataResidency },
        { label: 'Regulatory frameworks', status: 'pass', detail: sect.sovereignty.regulatoryFrameworks.join(', ') },
        { label: 'Cross-border transfer', status: sect.sovereignty.crossBorderTransfer ? 'warn' : 'pass', detail: sect.sovereignty.crossBorderTransfer ? 'Enabled' : 'Disabled' },
      ],
    },
  ]

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Procurement Proof Center</h1>
          <p className="text-gray-500 mt-1">
            One-click evidence aggregation — security, data, ops, governance, sovereignty
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Generate Procurement Pack (POST to API) */}
          <form action="/api/proof-center/export" method="POST">
            <input type="hidden" name="format" value="zip" />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Export Procurement Pack
            </button>
          </form>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">Overall Procurement Readiness</p>
            <p className="text-4xl font-bold mt-1">{overallScore}/100</p>
            <p className="text-sm text-blue-200 mt-1">
              Grade {overallGrade} — {sectionCards.filter((s) => s.truthStatus === 'ok').length}/{sectionCards.length} sections verified
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FingerPrintIcon className="h-8 w-8 text-blue-200" />
            <ArrowTrendingUpIcon className="h-8 w-8 text-green-300" />
          </div>
        </div>
      </div>

      {/* Proof Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sectionCards.map((section) => (
          <ProofSectionCard key={section.title} section={section} />
        ))}
      </div>

      {/* Signature & Manifest */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FingerPrintIcon className="h-5 w-5 text-gray-400" />
          Pack Signature & Manifest
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Algorithm</p>
            <p className="text-sm font-mono text-gray-800">{signed.signature?.algorithm ?? 'unsigned'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Key ID</p>
            <p className="text-sm font-mono text-gray-800 truncate">{signed.signature?.keyId ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Sections</p>
            <p className="text-sm font-mono text-gray-800">{signed.manifest.sectionCount} sections, {signed.manifest.artifactCount} artifacts</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Generated</p>
            <p className="text-sm font-mono text-gray-800">{signed.generatedAt}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
