import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { validateAppCompliance, validateAllApps } from '../src/complianceValidator'

function ensureFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, 'export const ok = true\n')
}

describe('complianceValidator', () => {
  const tempRoots: string[] = []

  afterEach(() => {
    for (const root of tempRoots) {
      fs.rmSync(root, { recursive: true, force: true })
    }
    tempRoots.length = 0
  })

  it('detects app-level and root-level capabilities', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-validator-'))
    tempRoots.push(rootDir)

    ensureFile(path.join(rootDir, 'sbom.json'))
    ensureFile(path.join(rootDir, 'apps', 'web', 'lib', 'policy-enforcement.ts'))
    ensureFile(path.join(rootDir, 'apps', 'web', 'app', 'api', 'evidence', 'export', 'route.ts'))
    ensureFile(path.join(rootDir, 'apps', 'web', 'app', 'api', 'health', 'route.ts'))
    ensureFile(path.join(rootDir, 'apps', 'web', 'app', 'api', 'metrics', 'route.ts'))
    ensureFile(path.join(rootDir, 'apps', 'web', 'tests', 'governance.test.ts'))

    const status = validateAppCompliance(rootDir, 'web')
    expect(status.app).toBe('web')
    expect(status.complianceLevel).toBe('full')
  })

  it('falls back to policyEnforcement.ts and handles missing directories', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-validator-'))
    tempRoots.push(rootDir)

    ensureFile(path.join(rootDir, 'apps', 'console', 'sbom.json'))
    ensureFile(path.join(rootDir, 'apps', 'console', 'lib', 'policyEnforcement.ts'))

    const status = validateAppCompliance(rootDir, 'console')
    expect(status.hasSbom).toBe(true)
    expect(status.hasPolicyEngine).toBe(true)
    expect(status.hasEvidencePack).toBe(false)
    expect(status.hasTests).toBe(false)
  })

  it('validates all apps from config', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-validator-'))
    tempRoots.push(rootDir)

    ensureFile(path.join(rootDir, 'apps', 'a1', 'sbom.json'))
    ensureFile(path.join(rootDir, 'apps', 'a1', '__tests__', 'coverage.test.ts'))

    const all = validateAllApps({ rootDir, apps: ['a1', 'a2'] })
    expect(all).toHaveLength(2)
    expect(all[0].app).toBe('a1')
    expect(all[1].app).toBe('a2')
  })
})
