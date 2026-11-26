import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('../../../../', import.meta.url)
const WORKFLOW = 'tax-reference-freshness.yml'

function read(path: string): string {
  return readFileSync(new URL(path, ROOT), 'utf8')
}

describe('tax freshness CI contract', () => {
  it('keeps shared unit coverage executable and free of a tax exclusion', () => {
    const ci = read('.github/workflows/ci.yml')
    expect(ci).toContain('name: Unit coverage (${{ matrix.lane }})')
    expect(ci).toContain("shared) pnpm test:coverage --force '--filter=!@nzila/union-eyes'")
    expect(ci).not.toContain('filter=!@nzila/tax')
    const coverage = ci.slice(ci.indexOf('name: Unit coverage'), ci.indexOf('name: Union Eyes frontend'))
    expect(coverage).not.toContain('continue-on-error')
  })

  it('runs the live audit on tax consumers without turning it into the software gate', () => {
    const workflow = read(`.github/workflows/${WORKFLOW}`)
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain('schedule:')
    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('- \'packages/tax/**\'')
    expect(workflow).toContain('- \'apps/cfo/**\'')
    expect(workflow).toContain('- \'apps/console/**\'')
    expect(workflow).toContain('pnpm --filter @nzila/tax freshness:audit')
    expect(workflow).not.toContain('continue-on-error')
    expect(workflow).not.toContain('Unit coverage')
  })

  it('keeps software tests on explicit instants', () => {
    const testsDirectory = fileURLToPath(new URL('./', import.meta.url))
    const tests = readdirSync(testsDirectory)
      .filter((name) => name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(testsDirectory, name), 'utf8'))
      .join('\n')
    expect(tests).not.toMatch(/getStaleModules\(\s*\)/)
    expect(tests).not.toMatch(/expect\(stale\)\.toHaveLength\(0\)/)
  })
})
