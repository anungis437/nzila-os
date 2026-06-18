import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const PACKAGE_JSON = join(ROOT, 'package.json')
const RUNTIME_TRUTH = join(ROOT, 'reports', 'runtime', 'platform-runtime-truth-latest.json')

function readJSON(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('Console and Union Eyes symbiosis', () => {
  it('union-eyes readiness script stays on the package-scoped test command', () => {
    const pkg = readJSON(PACKAGE_JSON)
    const script = pkg.scripts?.['readiness:union-eyes'] as string | undefined

    expect(script).toContain('pnpm --filter @nzila/union-eyes test')
    expect(script).not.toContain('test:fast --filter')
    expect(script).toContain('platform-runtime-truth-latest.json')
  })

  it('shared runtime truth reports both console and union-eyes as deployed apps', () => {
    expect(existsSync(RUNTIME_TRUTH)).toBe(true)

    const report = readJSON(RUNTIME_TRUTH)
    const deployedApps = report?.sections?.deployment?.deployedApps as unknown[] | undefined

    expect(report?.overallStatus).toBe('HEALTHY')
    expect(Array.isArray(deployedApps)).toBe(true)
    expect(deployedApps).toContain('nzila-os-console')
    expect(deployedApps).toContain('nzila-os-union-eyes')
  })
})