/**
 * Nzila OS — Governance Proof Pack
 *
 * Generates and displays immutable governance proof packs.
 * Includes download as signed JSON.
 *
 * @see @nzila/platform-proof
 */
import { requireRole } from '@/lib/rbac'
import { generateGovernanceProofPack } from '@nzila/platform-proof'
import {
  FingerPrintIcon,
  ShieldCheckIcon,
  ServerIcon,
  ArrowPathIcon,
  LockClosedIcon,
  DocumentArrowDownIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

function ProofField({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="h-5 w-5 text-gray-400" />
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="text-sm font-mono text-gray-800 break-all">{value}</p>
    </div>
  )
}

export default async function ProofPackPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')

  const params = await searchParams
  const isExecutive = params.mode === 'executive'
  const proof = await generateGovernanceProofPack()

  // Encode proof as base64 JSON for download link
  const proofJson = JSON.stringify(proof, null, 2)
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(proofJson)}`

  return (
    <div className={isExecutive ? 'p-12 bg-gray-50 min-h-screen' : 'p-8'}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Governance Proof Pack</h1>
          <p className="text-gray-500 mt-1">
            Immutable, hash-signed governance attestation
          </p>
        </div>
        <a
          href={downloadHref}
          download={`nzila-proof-pack-${proof.id}.json`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          Download Signed JSON
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <ProofField
          label="Contract Test Hash"
          value={proof.contractTestHash}
          icon={FingerPrintIcon}
        />
        <ProofField
          label="CI Pipeline Status"
          value={proof.ciPipelineStatus}
          icon={ServerIcon}
        />
        <ProofField
          label="Last Migration ID"
          value={proof.lastMigrationId}
          icon={ArrowPathIcon}
        />
        <ProofField
          label="Audit Integrity Hash"
          value={proof.auditIntegrityHash}
          icon={ShieldCheckIcon}
        />
        <ProofField
          label="Secret Scan Status"
          value={proof.secretScanStatus}
          icon={LockClosedIcon}
        />
        <ProofField
          label="Red-Team Summary"
          value={proof.redTeamSummary}
          icon={BeakerIcon}
        />
      </div>

      {/* Signature block */}
      <div className="bg-gray-900 text-gray-100 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <LockClosedIcon className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">
            Pack Signature
          </h2>
        </div>
        <p className="font-mono text-xs break-all text-green-300">{proof.signatureHash}</p>
        <p className="text-xs text-gray-500 mt-2">
          Generated: {proof.generatedAt} — Immutable once created
        </p>
      </div>
    </div>
  )
}
