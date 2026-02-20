/**
 * Contract Tests: API Response Shape Contracts (Phase 6, PR6.1a)
 *
 * Verifies that API route response shapes conform to the documented contract.
 * These are static analysis tests that inspect source code shape consistency.
 *
 * For runtime API contract tests, see the integration test suite.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '../..')

describe('Health Endpoint Contracts', () => {
  const APPS = ['console', 'partners', 'web', 'union-eyes']

  for (const app of APPS) {
    it(`${app} /api/health route exists`, () => {
      const routePath = join(REPO_ROOT, 'apps', app, 'app', 'api', 'health', 'route.ts')
      expect(existsSync(routePath)).toBe(true)
    })

    it(`${app} /api/health returns status, app, buildInfo, checks`, () => {
      const routePath = join(REPO_ROOT, 'apps', app, 'app', 'api', 'health', 'route.ts')
      const content = readFileSync(routePath, 'utf-8')
      expect(content).toContain('status')
      expect(content).toContain('buildInfo')
      expect(content).toContain('checks')
      expect(content).toContain("app: APP")
    })
  }
})

describe('Retention API Contracts', () => {
  it('retention run route exists in console app', () => {
    const routePath = join(
      REPO_ROOT,
      'apps',
      'console',
      'app',
      'api',
      'admin',
      'retention',
      'run',
      'route.ts',
    )
    expect(existsSync(routePath)).toBe(true)
  })

  it('retention run route checks authorization before executing', () => {
    const routePath = join(
      REPO_ROOT,
      'apps',
      'console',
      'app',
      'api',
      'admin',
      'retention',
      'run',
      'route.ts',
    )
    const content = readFileSync(routePath, 'utf-8')
    expect(content).toContain('auth()')
    expect(content).toContain('authorize')
    expect(content).toContain('enforceRetention')
  })
})

describe('Evidence API Contracts', () => {
  it('evidence canonical generator is in os-core (not in tooling/scripts)', () => {
    const canonicalPath = join(
      REPO_ROOT,
      'packages',
      'os-core',
      'src',
      'evidence',
      'generate-evidence-index.ts',
    )
    const toolingPath = join(REPO_ROOT, 'tooling', 'scripts', 'generate-evidence-index.ts')

    const canonicalContent = readFileSync(canonicalPath, 'utf-8')
    const toolingContent = readFileSync(toolingPath, 'utf-8')

    // Canonical has the actual logic
    expect(canonicalContent).toContain('processEvidencePack')
    expect(canonicalContent).toContain('buildLocalEvidencePackIndex')

    // Tooling is a thin wrapper
    expect(toolingContent).not.toContain('EvidencePackIndex')
    expect(toolingContent).not.toContain('computeSha256')
    expect(toolingContent).not.toContain('UploadContext')
    expect(toolingContent).not.toContain("from '@nzila/blob'")
    expect(toolingContent).not.toContain("from '@nzila/db'")
  })
})
