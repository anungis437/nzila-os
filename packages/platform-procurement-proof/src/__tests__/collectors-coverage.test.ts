import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect } from 'vitest'
import {
  collectLatestEvidencePack,
  collectLatestComplianceSnapshots,
  collectDependencyPosture,
  collectIntegrationsHealth,
  collectObservabilitySummary,
} from '../collectors'
import {
  collectBuildAttestation,
  collectEvidenceReproducibility,
  collectSBOMReference,
  collectSupplyChainIntegrity,
} from '../sections'
import {
  KNOWN_SECTION_NAMES,
  validateSection,
  safeValidateSection,
} from '../schemas/section.schema'
import * as rootExports from '../index'

describe('collectors coverage targets', () => {
  it('evidence-pack collector handles no packs and latest sealed pack', async () => {
    const empty = await collectLatestEvidencePack('org-1', {
      listPacks: async () => [],
      loadPack: async () => null,
    })

    expect(empty.status).toBe('not_available')
    expect(empty.data).toBeNull()

    const populated = await collectLatestEvidencePack('org-1', {
      listPacks: async () => [
        {
          packId: 'old',
          orgId: 'org-1',
          controlFamily: 'security',
          artifacts: [],
          createdAt: '2026-03-01T00:00:00.000Z',
          seal: null,
        },
        {
          packId: 'latest',
          orgId: 'org-1',
          controlFamily: 'governance',
          artifacts: [{ id: 'a1' }],
          createdAt: '2026-03-10T00:00:00.000Z',
          seal: {
            packDigest: 'digest-1',
            artifactsMerkleRoot: 'merkle-1',
          },
        },
      ],
      loadPack: async () => null,
    })

    expect(populated.status).toBe('ok')
    expect(populated.data?.packId).toBe('latest')
    expect(populated.data?.sealed).toBe(true)
    expect(populated.integrityHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('compliance snapshot collector flags chain mismatch', async () => {
    const result = await collectLatestComplianceSnapshots('org-1', {
      listSnapshots: async () => [
        {
          snapshotId: 'snap-1',
          version: 1,
          summary: { complianceScore: 95, totalControls: 20, compliant: 19 },
          collectedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          snapshotId: 'snap-2',
          version: 2,
          summary: { complianceScore: 97, totalControls: 21, compliant: 20 },
          collectedAt: '2026-03-10T00:00:00.000Z',
        },
      ],
      loadChain: async () => [
        {
          snapshotId: 'snap-1',
          snapshotHash: 'a'.repeat(64),
          previousHash: null,
        },
        {
          snapshotId: 'snap-2',
          snapshotHash: 'b'.repeat(64),
          previousHash: 'c'.repeat(64),
        },
      ],
    })

    expect(result.status).toBe('ok')
    expect(result.data?.latestSnapshotId).toBe('snap-2')
    expect(result.data?.chainValid).toBe(false)
  })

  it('dependency posture collector handles no artifacts, invalid JSON, and valid fallback path', async () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'dep-posture-'))
    const outputsDir = join(baseDir, 'ops', 'outputs')
    mkdirSync(outputsDir, { recursive: true })

    const noFiles = await collectDependencyPosture('org-1', baseDir)
    expect(noFiles.status).toBe('not_available')

    writeFileSync(
      join(outputsDir, 'dependency-posture.json'),
      JSON.stringify({
        critical: 'invalid',
        high: 1,
        totalDependencies: 120,
        scanTimestamp: '2026-03-11T00:00:00.000Z',
      }),
    )
    writeFileSync(
      join(outputsDir, 'audit-result.json'),
      JSON.stringify({
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        totalDependencies: 120,
        scanTimestamp: '2026-03-11T00:00:00.000Z',
        toolVersion: '1.0.0',
        lockfileIntegrity: true,
      }),
    )

    const valid = await collectDependencyPosture('org-1', baseDir)
    expect(valid.status).toBe('ok')
    expect(valid.source).toBe('file:ops/outputs/audit-result.json')
    expect(valid.data?.highCount).toBe(1)
  })

  it('integrations health collector exercises healthy/degraded/down/unknown provider states', async () => {
    const result = await collectIntegrationsHealth('org-1', {
      listProviders: async () => ['downProvider', 'degradedProvider', 'healthyProvider', 'unknownProvider'],
      getDlqDepth: async () => 7,
      getDlqDepthByProvider: async (_orgId, provider) => (provider === 'downProvider' ? 3 : 0),
      getCircuitState: async (provider) => {
        if (provider === 'downProvider') return 'open'
        if (provider === 'degradedProvider') return 'half-open'
        if (provider === 'healthyProvider') return 'closed'
        throw new Error('collector failure')
      },
      getDeliveryStats: async (provider, windowMs) => {
        if (provider === 'degradedProvider' && windowMs > 24 * 60 * 60 * 1000) {
          return { total: 100, succeeded: 91, failed: 9 }
        }
        if (provider === 'degradedProvider') {
          return { total: 10, succeeded: 8, failed: 2 }
        }
        if (provider === 'healthyProvider') {
          return { total: 10, succeeded: 10, failed: 0 }
        }
        return { total: 5, succeeded: 2, failed: 3 }
      },
    })

    expect(result.status).toBe('ok')
    expect(result.data?.totalProviders).toBe(4)
    expect(result.data?.downProviders).toBe(1)
    expect(result.data?.degradedProviders).toBe(1)
    expect(result.data?.healthyProviders).toBe(1)
    expect(result.data?.providers.some((p) => p.status === 'unknown')).toBe(true)
  })

  it('observability summary collector tolerates optional metric failures', async () => {
    const result = await collectObservabilitySummary('org-1', {
      runHealthChecks: async () => ({
        service: 'proof',
        status: 'degraded',
        checks: [
          { name: 'db', status: 'healthy', latencyMs: 15 },
          { name: 'queue', status: 'degraded', latencyMs: 120 },
        ],
        timestamp: '2026-03-11T00:00:00.000Z',
      }),
      getErrorCount24h: async () => {
        throw new Error('metric unavailable')
      },
      getP95LatencyMs: async () => 420,
      getQueueDepth: async () => null,
    })

    expect(result.status).toBe('ok')
    expect(result.data?.healthStatus).toBe('degraded')
    expect(result.data?.errorCount24h).toBeNull()
    expect(result.data?.p95LatencyMs).toBe(420)
    expect(result.data?.healthChecks).toHaveLength(2)
  })
})

describe('sections and schema coverage targets', () => {
  it('returns deterministic envelopes for enterprise sections', () => {
    const supplyChain = collectSupplyChainIntegrity()
    const buildAttestation = collectBuildAttestation()
    const reproducibility = collectEvidenceReproducibility()
    const sbomReference = collectSBOMReference()

    for (const section of [supplyChain, buildAttestation, reproducibility, sbomReference]) {
      expect(section).toHaveProperty('section')
      expect(section).toHaveProperty('status')
      expect(section).toHaveProperty('collectedAt')
      expect(section).toHaveProperty('source')
      expect(section).toHaveProperty('data')
    }
  })

  it('validates sections and safely reports invalid timestamp shapes', () => {
    expect(KNOWN_SECTION_NAMES).toContain('sbom_reference')

    const valid = validateSection({
      section: 'custom',
      status: 'ok',
      collectedAt: '2026-03-11T10:00:00Z',
      source: 'test',
      data: { pass: true },
    })
    expect(valid.status).toBe('ok')

    const invalid = safeValidateSection({
      section: 'custom',
      status: 'ok',
      collectedAt: '2026-03-11T10:00:00.000Z',
      source: 'test',
      data: {},
    })
    expect(invalid.success).toBe(false)
  })

  it('barrel exports expose expected runtime functions', () => {
    expect(typeof rootExports.collectProcurementPack).toBe('function')
    expect(typeof rootExports.exportAsSignedZip).toBe('function')
    expect(typeof rootExports.createRealPorts).toBe('function')
    expect(typeof rootExports.collectLatestEvidencePack).toBe('function')
    expect(typeof rootExports.collectSupplyChainIntegrity).toBe('function')
  })
})
