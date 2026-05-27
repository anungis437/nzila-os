/**
 * Nzila OS — Golden Demo Path
 *
 * End-to-end demonstration that always works. Deterministic,
 * no secrets, no external dependencies.
 *
 * Steps:
 *   1. Create org context
 *   2. Generate compliance snapshot + chain entry
 *   3. Generate evidence pack
 *   4. Export signed procurement pack ZIP
 *   5. Generate RFP response
 *   6. Print verification results
 *
 * Usage:
 *   pnpm exec tsx scripts/demo-golden-path.ts
 *   npx tsx scripts/demo-golden-path.ts
 *
 * @module scripts/demo-golden-path
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

import {
  collectProcurementPack,
  signProcurementPack,
  exportAsSignedZip,
  exportAsJson,
  createRealPorts,
  getSigningKeyPair,
  verifyZipSignature,
} from '@nzila/platform-procurement-proof'
import type { RealPortsDeps } from '@nzila/platform-procurement-proof/real-ports'
import type { EvidencePackIndex } from '@nzila/platform-evidence-pack'
import type { ComplianceSnapshot, SnapshotChainEntry } from '@nzila/platform-compliance-snapshots'
import type { HealthReport } from '@nzila/platform-observability'
import { computeAssuranceDashboard } from '@nzila/platform-assurance'
import type { AssurancePorts } from '@nzila/platform-assurance/types'
import { generateRfpResponse, renderRfpMarkdown } from '@nzila/platform-rfp-generator'
import { nowISO } from '@nzila/platform-utils/time'

// ── Config ──────────────────────────────────────────────────────────────────

const ORG_ID = 'demo-org'
const DEMO_USER = 'demo-golden-path'
const OUTPUT_DIR = join(process.cwd(), 'demo-output')

// ── Port Setup ──────────────────────────────────────────────────────────────

function createDemoPortDeps(): RealPortsDeps {
  const now = nowISO()
  const packId = randomUUID()

  // Pre-seed an evidence pack
  const evidencePack: EvidencePackIndex = {
    packId,
    orgId: ORG_ID,
    status: 'sealed',
    createdAt: now,
    sealedAt: now,
    artifacts: [
      {
        artifactId: randomUUID(),
        type: 'security-posture',
        data: { source: 'dependency-audit', status: 'clean' },
        createdAt: now,
        sha256: createHash('sha256').update('demo-security').digest('hex'),
      },
      {
        artifactId: randomUUID(),
        type: 'governance-snapshot',
        data: { source: 'compliance-collector', policyRate: 100 },
        createdAt: now,
        sha256: createHash('sha256').update('demo-governance').digest('hex'),
      },
    ],
    seal: {
      merkleRoot: createHash('sha256').update('demo-merkle').digest('hex'),
      algorithm: 'sha256',
      sealedAt: now,
      sealedBy: DEMO_USER,
    },
  }

  // Pre-seed a compliance snapshot + chain entry
  const snapshotId = randomUUID()
  const snapshotHash = createHash('sha256').update(JSON.stringify({
    snapshotId,
    orgId: ORG_ID,
    status: 'compliant',
  })).digest('hex')

  const snapshot: ComplianceSnapshot = {
    snapshotId,
    orgId: ORG_ID,
    generatedAt: now,
    generatedBy: DEMO_USER,
    status: 'compliant',
    controls: [
      { controlId: 'access-01', family: 'access', description: 'RBAC enforced', status: 'pass', evidenceRef: 'rbac-config' },
      { controlId: 'data-01', family: 'data', description: 'Encryption at rest', status: 'pass', evidenceRef: 'encryption-policy' },
      { controlId: 'financial-01', family: 'financial', description: 'Budget gates active', status: 'pass', evidenceRef: 'cost-policy' },
      { controlId: 'operational-01', family: 'operational', description: 'SLO monitoring', status: 'pass', evidenceRef: 'slo-policy' },
    ],
    summary: {
      totalControls: 4,
      passing: 4,
      failing: 0,
      warnings: 0,
      complianceRate: 100,
    },
  }

  const chainEntry: SnapshotChainEntry = {
    snapshotId,
    hash: snapshotHash,
    previousHash: null,
    chainIndex: 0,
    createdAt: now,
  }

  return {
    evidencePack: {
      async listPacks(_orgId: string) { return [evidencePack] },
      async loadPack(_packId: string) { return evidencePack },
    },
    complianceSnapshots: {
      async listSnapshots(_orgId: string) { return [snapshot] },
      async loadChain(_orgId: string) { return [chainEntry] },
    },
    integrations: {
      async listProviders() { return ['slack', 'hubspot'] },
      async getCircuitState() { return 'closed' as const },
      async getDeliveryStats() { return { total: 150, succeeded: 149, failed: 1, avgLatencyMs: 120 } },
      async getDlqDepth() { return 0 },
    },
    observability: {
      async runHealthChecks(): Promise<HealthReport> {
        return {
          service: 'nzila-os',
          status: 'healthy',
          checks: [
            { name: 'database', status: 'healthy', responseTimeMs: 12, checkedAt: now },
            { name: 'cache', status: 'healthy', responseTimeMs: 3, checkedAt: now },
          ],
          timestamp: now,
        }
      },
    },
    sovereignty: {
      deploymentRegion: 'Canada Central',
      dataResidency: 'Canada',
      regulatoryFrameworks: ['PIPEDA', 'Québec Law 25'],
      crossBorderTransfer: false,
    },
  }
}

function createDemoAssurancePorts(): AssurancePorts {
  return {
    async getComplianceScore() {
      return { score: 97, grade: 'A' as const, snapshotChainVerified: true, policyComplianceRate: 100, controlFamiliesCovered: 4, controlFamiliesTotal: 4, lastSnapshotAt: nowISO() }
    },
    async getSecurityScore() {
      return { score: 92, grade: 'A' as const, criticalVulnerabilities: 0, highVulnerabilities: 0, dependencyPosture: 92, attestationValid: true, lockfileIntegrity: true, lastScanAt: nowISO() }
    },
    async getOpsScore() {
      return { score: 91, grade: 'A' as const, confidenceScore: 91, sloComplianceRate: 99.2, p95Ms: 320, errorRate: 0.3, uptimePercent: 99.5, trendDirection: 'stable' as const, incidentCount: 0 }
    },
    async getCostScore() {
      return { score: 84, grade: 'B' as const, budgetUtilization: 0.84, dailySpendUsd: 140, monthlySpendUsd: 4200, monthlyBudgetUsd: 5000, overBudget: false, categoriesOverCap: [] }
    },
    async getIntegrationReliabilityScore() {
      return { score: 90, grade: 'A' as const, slaComplianceRate: 99.3, dlqBacklog: 0, circuitBreakersOpen: 0, providersHealthy: 2, providersTotal: 2, lastHealthCheckAt: nowISO() }
    },
    async listOrgIds() { return [ORG_ID] },
  }
}

// ── Output Helpers ──────────────────────────────────────────────────────────

const OK = '\u2714' // ✔
const FAIL = '\u2718' // ✘

function ok(msg: string) {
  // eslint-disable-next-line no-console -- CLI script
  console.log(`  ${OK} ${msg}`)
}

function info(label: string, value: string) {
  // eslint-disable-next-line no-console -- CLI script
  console.log(`    ${label.padEnd(18)} ${value}`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // eslint-disable-next-line no-console -- CLI script
  console.log('')
  // eslint-disable-next-line no-console -- CLI script
  console.log('  Nzila OS — Golden Demo Path')
  // eslint-disable-next-line no-console -- CLI script
  console.log('  Jurisdiction: Canada (PIPEDA + Québec Law 25)')
  // eslint-disable-next-line no-console -- CLI script
  console.log('')

  mkdirSync(OUTPUT_DIR, { recursive: true })

  // 1. Collect procurement pack
  const portDeps = createDemoPortDeps()
  const ports = createRealPorts(portDeps)
  let pack = await collectProcurementPack(ORG_ID, DEMO_USER, ports)
  ok('Compliance snapshot generated')

  // 2. Sign the pack
  pack = await signProcurementPack(pack, ports)
  ok('Evidence pack created')

  // 3. Export signed ZIP + JSON
  const zipResult = exportAsSignedZip(pack, ORG_ID)
  const zipPath = join(OUTPUT_DIR, zipResult.filename)
  writeFileSync(zipPath, Buffer.from(zipResult.zipBuffer))

  const jsonResult = exportAsJson(pack)
  const jsonPath = join(OUTPUT_DIR, jsonResult.filename)
  writeFileSync(jsonPath, jsonResult.data, 'utf-8')
  ok('Procurement pack exported')

  // 4. Generate RFP response
  const assurancePorts = createDemoAssurancePorts()
  const dashboard = await computeAssuranceDashboard(ORG_ID, assurancePorts)
  const rfpResponse = generateRfpResponse({
    orgId: ORG_ID,
    generatedBy: DEMO_USER,
    procurementPack: pack,
    assuranceDashboard: dashboard,
  })
  const markdown = renderRfpMarkdown(rfpResponse)
  const rfpPath = join(OUTPUT_DIR, 'rfp-answers.md')
  writeFileSync(rfpPath, markdown, 'utf-8')
  ok('RFP answers generated')

  // 5. Verify signature
  const { keyId, publicKey } = getSigningKeyPair()
  const manifestJson = JSON.stringify(zipResult.manifest, null, 2)
  const sigValid = verifyZipSignature(manifestJson, zipResult.signature, publicKey)

  // eslint-disable-next-line no-console -- CLI script
  console.log('')
  // eslint-disable-next-line no-console -- CLI script
  console.log('  Artifacts')
  // eslint-disable-next-line no-console -- CLI script
  console.log('  ' + '-'.repeat(40))
  // eslint-disable-next-line no-console -- CLI script
  console.log('')
  info('Procurement Pack', zipPath)
  info('RFP Answers', rfpPath)
  info('JSON Export', jsonPath)

  // eslint-disable-next-line no-console -- CLI script
  console.log('')
  // eslint-disable-next-line no-console -- CLI script
  console.log('  Verification')
  // eslint-disable-next-line no-console -- CLI script
  console.log('  ' + '-'.repeat(40))
  // eslint-disable-next-line no-console -- CLI script
  console.log('')
  info('manifest', sigValid ? 'VALID' : 'INVALID')
  info('signature', sigValid ? 'VALID' : 'INVALID')
  info('algorithm', 'Ed25519')
  info('keyId', keyId)
  info('sections', String(pack.manifest.sectionCount))
  info('artifacts', String(pack.manifest.artifactCount))
  info('questions', `${rfpResponse.totalAnswered}/${rfpResponse.totalQuestions}`)

  // eslint-disable-next-line no-console -- CLI script
  console.log('')
  if (sigValid) {
    // eslint-disable-next-line no-console -- CLI script
    console.log(`  ${OK} Golden Demo Complete`)
  } else {
    // eslint-disable-next-line no-console -- CLI script
    console.log(`  ${FAIL} Verification failed`)
    process.exit(1)
  }
  // eslint-disable-next-line no-console -- CLI script
  console.log('')
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- CLI script
  console.error('Golden demo failed:', err)
  process.exit(1)
})
