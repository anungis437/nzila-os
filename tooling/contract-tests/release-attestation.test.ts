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
import { readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { assertPromotedRevision, parseArgs, parseManifestTargets } from '../../scripts/deploy-transactional'
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

  it('RELEASE_ATTESTATION_REQUIRED_001: dispatch inputs cannot inject workflow shell source', () => {
    const production = readContent('.github/workflows/deploy-production.yml')
    const staging = readContent('.github/workflows/deploy-staging.yml')
    // GitHub expressions inside run: are evaluated before bash parses them.
    // Quoting an expression does not prevent shell command substitution.
    for (const workflow of [production, staging]) {
      const scripts = [...workflow.matchAll(/^\s*run:\s*\|\s*\n((?: {10,}.*\n)*)/gm)]
        .map(match => match[1]).join('\n')
      expect(scripts).not.toMatch(/\$\{\{\s*github\.event\.inputs\./)
      expect(scripts).not.toMatch(/\$\{\{\s*(?:steps\.resolve|needs\.verify-artifact)\.outputs\.approved_apps/)
    }
    expect(production).toContain('STAGING_RUN_ID_INPUT: ${{ github.event.inputs.staging_run_id }}')
    expect(production).toContain('REQUESTED_APPS_INPUT: ${{ github.event.inputs.apps || \'all\' }}')
    expect(staging).toContain('EMERGENCY_ACK_INPUT: ${{ github.event.inputs.emergency_ack }}')
  })

  it('P0 #1038: production digest enforcement cannot be disabled through CLI', () => {
    expect(parseArgs(['--resource-group', 'nzila-canada-prod-rg']).requireDigestPinned).toBe(true)
    expect(() => parseArgs(['--resource-group', 'nzila-canada-prod-rg', '--require-digest-pinned', 'false']))
      .toThrow(/production digest pinning cannot be disabled/)
    expect(() => parseArgs(['--resource-group', 'nzila-canada-prod-rg', '--require-digest-pinned', 'maybe']))
      .toThrow(/Invalid --require-digest-pinned/)
  })

  it('P0 #1038: production target parsing rejects fallback, conflicting aliases, and shell payloads', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nzila-release-targets-'))
    const manifestPath = join(dir, 'manifest.json')
    const pinned = 'registry.example/app@sha256:' + 'a'.repeat(64)
    const fallback = JSON.stringify([{ name: 'demo', image: pinned }])
    const write = (deployTargets: unknown[]) => writeFileSync(manifestPath, JSON.stringify({ deployTargets }))
    try {
      write([])
      expect(() => parseManifestTargets(manifestPath, fallback, true)).toThrow(/No deploy targets/)
      write([{ name: 'demo', image: pinned }])
      expect(parseManifestTargets(manifestPath, fallback, true)).toMatchObject([
        { containerAppName: 'demo', image: pinned },
      ])
      write([{ name: 'demo', image: 'registry.example/$(touch /tmp/owned)@sha256:' + 'a'.repeat(64) }])
      expect(() => parseManifestTargets(manifestPath, undefined, true)).toThrow(/not pinned/)
      write([{ name: 'demo";touch /tmp/owned', image: pinned }])
      expect(() => parseManifestTargets(manifestPath, undefined, true)).toThrow(/Noncanonical/)
      write([{ name: 'demo', app: 'other', image: pinned }])
      expect(() => parseManifestTargets(manifestPath, undefined, true)).toThrow(/conflicting deployment target/)
      write([{ name: 'demo', image: pinned, imageRef: 'registry.example/other@sha256:' + 'b'.repeat(64) }])
      expect(() => parseManifestTargets(manifestPath, undefined, true)).toThrow(/conflicting deployment image/)
      write([{ name: 'demo', image: pinned }, { name: 'demo', image: pinned }])
      expect(() => parseManifestTargets(manifestPath, undefined, true)).toThrow(/Duplicate Azure/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('P0 #1038: ready revision and signed image must match before a public health check can pass', () => {
    const image = 'registry.example/app@sha256:' + 'a'.repeat(64)
    const other = 'registry.example/app@sha256:' + 'b'.repeat(64)
    const target = { containerAppName: 'demo', image }
    const previous = {
      appName: 'demo',
      previousImage: other,
      previousRevision: 'demo--old',
      newImage: image,
    }
    const azure = (deployedImage: string, latest: unknown, ready: unknown) => ({
      properties: {
        template: { containers: [{ image: deployedImage }] },
        latestRevisionName: latest,
        latestReadyRevisionName: ready,
      },
    })
    expect(assertPromotedRevision(target, previous, azure(image, 'demo--new', 'demo--new')))
      .toBe('demo--new')
    expect(() => assertPromotedRevision(target, previous, azure(other, 'demo--new', 'demo--new')))
      .toThrow(/image mismatch/)
    expect(() => assertPromotedRevision(target, previous, azure(image, 'demo--new', 'demo--old')))
      .toThrow(/not ready/)
    expect(() => assertPromotedRevision(target, previous, azure(image, 'demo--old', 'demo--old')))
      .toThrow(/previous revision/)
    expect(() => assertPromotedRevision(target, previous, azure(image, undefined, undefined)))
      .toThrow(/Missing latest Azure revision/)
    expect(() => assertPromotedRevision(target, previous, null))
      .toThrow(/image mismatch/)
  })

  it('P0 #1038: production Azure commands cannot interpolate signed manifest values into shell', () => {
    const deployer = readContent('scripts/deploy-transactional.ts')
    expect(deployer).toContain("execFileSync('az',")
    expect(deployer).not.toContain('execSync(')
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
