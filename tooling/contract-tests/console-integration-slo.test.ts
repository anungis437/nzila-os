/**
 * Contract tests — Console Integration SLO Dashboard
 *
 * Enforces that:
 *   1. The SLA page imports and references the proof pack generator.
 *   2. The health page references invariants.
 *   3. The platform-proof package exports an integrations proof section.
 *
 * @invariant INTEGRATION_SLO_DASHBOARD_003
 * @invariant INTEGRATION_PROOF_INCLUDED_004
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('Console — Integration SLO Dashboard', () => {
  // ── INTEGRATION_SLO_DASHBOARD_003 ──────────────────────────────────────
  it('INTEGRATION_SLO_DASHBOARD_003: SLA page includes proof pack import from @nzila/platform-proof', () => {
    const slaPage = readContent('apps/console/app/(dashboard)/integrations/sla/page.tsx')
    expect(slaPage).toBeTruthy()

    const hasProofImport = slaPage.includes('@nzila/platform-proof/integrations')
    expect(
      hasProofImport,
      'SLA page must import from @nzila/platform-proof/integrations to include governance proof pack section',
    ).toBe(true)
  })

  // ── INTEGRATION_PROOF_INCLUDED_004 ─────────────────────────────────────
  it('INTEGRATION_PROOF_INCLUDED_004: platform-proof exports integrations proof section', () => {
    const proofIndex = readContent('packages/platform-proof/src/index.ts')
    expect(proofIndex).toBeTruthy()

    expect(
      proofIndex.includes('integrations-proof'),
      'platform-proof index must re-export from integrations-proof',
    ).toBe(true)

    const proofFile = readContent('packages/platform-proof/src/integrations-proof.ts')
    expect(proofFile).toBeTruthy()

    expect(
      proofFile.includes('generateIntegrationsProofSection'),
      'integrations-proof.ts must export generateIntegrationsProofSection',
    ).toBe(true)

    expect(
      proofFile.includes('IntegrationsProofSection'),
      'integrations-proof.ts must export IntegrationsProofSection type',
    ).toBe(true)

    expect(
      proofFile.includes('IntegrationProviderSnapshot'),
      'integrations-proof.ts must export IntegrationProviderSnapshot type',
    ).toBe(true)
  })

  // ── INTEGRATION_HEALTHCHECK_REQUIRED_002 ───────────────────────────────
  it('INTEGRATION_HEALTHCHECK_REQUIRED_002: health page declares healthcheck invariant', () => {
    const healthPage = readContent('apps/console/app/(dashboard)/integrations/health/page.tsx')
    expect(healthPage).toBeTruthy()

    expect(
      healthPage.includes('INTEGRATION_HEALTHCHECK_REQUIRED_002'),
      'Health page must declare @invariant INTEGRATION_HEALTHCHECK_REQUIRED_002 in its doc comment',
    ).toBe(true)
  })

  // ── Proof pack schema ─────────────────────────────────────────────────
  it('INTEGRATION_PROOF_SCHEMA_005: integrations proof section includes required fields', () => {
    const proofFile = readContent('packages/platform-proof/src/integrations-proof.ts')
    expect(proofFile).toBeTruthy()

    const requiredFields = [
      'sectionId',
      'sectionType',
      'generatedAt',
      'providers',
      'overallAvailability',
      'totalDlqBacklog',
      'totalCircuitOpenCount',
      'activeSlaBreaches',
      'signatureHash',
    ]

    for (const field of requiredFields) {
      expect(
        proofFile.includes(field),
        `IntegrationsProofSection must include field: ${field}`,
      ).toBe(true)
    }
  })

  // ── console depends on platform-proof ─────────────────────────────────
  it('INTEGRATION_PROOF_DEP_006: console package.json declares @nzila/platform-proof dependency', () => {
    const pkg = readContent('apps/console/package.json')
    expect(pkg).toBeTruthy()

    const parsed = JSON.parse(pkg)
    expect(
      parsed.dependencies?.['@nzila/platform-proof'],
      'console must have @nzila/platform-proof in dependencies',
    ).toBeTruthy()
  })
})
