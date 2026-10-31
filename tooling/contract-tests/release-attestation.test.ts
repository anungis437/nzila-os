/**
 * Contract tests — Release Attestation Required
 *
 * Enforces that:
 *   1. The release attestation generator script exists.
 *   2. Build workflows generate and upload attestation artifacts;
 *      production promotion verifies and retains the SAME signed artifact.
 *   3. Attestation includes required fields (SHA, contract test, SLO, SBOM, trivy, secret-scan).
 *
 * @invariant RELEASE_ATTESTATION_REQUIRED_001
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = join(__dirname, '..', '..')

function readContent(rel: string): string {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('RELEASE_ATTESTATION_REQUIRED_001 — Release Attestation on Deploy', () => {
  // 1. The generator script must exist
  it('RELEASE_ATTESTATION_REQUIRED_001: release attestation generator exists', () => {
    const script = readContent('scripts/release-attestation.ts')
    expect(script).toBeTruthy()

    expect(
      script.includes('generateReleaseAttestation'),
      'script must export generateReleaseAttestation',
    ).toBe(true)

    expect(
      script.includes('commitSha'),
      'attestation must include commit SHA',
    ).toBe(true)

    expect(
      script.includes('contractTestResult'),
      'attestation must include contract test result',
    ).toBe(true)

    expect(
      script.includes('sloGateResult'),
      'attestation must include SLO gate result',
    ).toBe(true)

    expect(
      script.includes('sbomDigest'),
      'attestation must include SBOM digest',
    ).toBe(true)

    expect(
      script.includes('trivySummary'),
      'attestation must include trivy summary',
    ).toBe(true)

    expect(
      script.includes('secretScanSummary'),
      'attestation must include secret scan summary',
    ).toBe(true)

    expect(
      script.includes('attestationDigest'),
      'attestation must include self-digest for tamper evidence',
    ).toBe(true)
  })

  // 2. Build workflows generate; promotion cryptographically verifies the staged artifact
  it('RELEASE_ATTESTATION_REQUIRED_001: all deploy workflows generate release attestation', () => {
    const workflowDir = join(ROOT, '.github', 'workflows')
    if (!existsSync(workflowDir)) {
      expect.fail('.github/workflows directory must exist')
    }

    const deployWorkflows = readdirSync(workflowDir)
      .filter((f) => f.startsWith('deploy-') && f.endsWith('.yml'))

    expect(
      deployWorkflows.length,
      'at least one deploy workflow must exist',
    ).toBeGreaterThan(0)

    const violations: string[] = []
    for (const wf of deployWorkflows) {
      const content = readContent(`.github/workflows/${wf}`)

      if (wf === 'deploy-production.yml') {
        // Production promotion must not generate another self-claimed PASS.
        // It consumes verified signed staging evidence and binds image digest.
        if (!content.includes('verify-promotion-evidence.mjs') ||
            !content.includes('staging-artifacts/release-attestation.json') ||
            !content.includes('staging-artifacts/artifact-manifest.json') ||
            !content.includes('staging-artifacts/sbom.json')) {
          violations.push(wf)
        }
      } else if (!content.includes('scripts/release-attestation.ts')) {
        violations.push(wf)
      }
    }

    expect(
      violations,
      `Deploy workflows missing release attestation:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })

  it('RELEASE_ATTESTATION_REQUIRED_001: staging manifest secrets are parsed as data, not shell source', () => {
    const staging = readContent('.github/workflows/deploy-staging.yml')
    expect(staging).toContain('STAGING_DEPLOY_TARGETS_JSON: ${{ secrets.STAGING_DEPLOY_TARGETS_JSON }}')
    expect(staging).toContain('<<< "$STAGING_DEPLOY_TARGETS_JSON"')
    expect(staging).not.toMatch(/echo\s+['"]\$\{\{\s*secrets\.STAGING_DEPLOY_TARGETS_JSON/)
    expect(staging).not.toContain('[ -n "${{ secrets.STAGING_DEPLOY_TARGETS_JSON }}" ]')
  })

  // 3. The same exact verified attestation must survive production promotion
  it('RELEASE_ATTESTATION_REQUIRED_001: deploy workflows upload attestation artifact', () => {
    const workflowDir = join(ROOT, '.github', 'workflows')
    if (!existsSync(workflowDir)) return

    const deployWorkflows = readdirSync(workflowDir)
      .filter((f) => f.startsWith('deploy-') && f.endsWith('.yml'))

    const violations: string[] = []
    for (const wf of deployWorkflows) {
      const content = readContent(`.github/workflows/${wf}`)

      if (!content.includes('release-attestation.json')) {
        violations.push(wf)
      }
    }

    expect(
      violations,
      `Deploy workflows not uploading release-attestation.json:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
    ).toEqual([])
  })
})
