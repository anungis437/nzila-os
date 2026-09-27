import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { repoRootFromHere } from '../verifier'
import { TREASURER_IDENTITY } from '../kernel'

describe('H. regression', () => {
  const root = repoRootFromHere()

  it('leaves the corporate treasury agent and approval default in place', () => {
    const treasury = readFileSync(join(root, 'packages/executive-os/src/agents/treasury.ts'), 'utf8')
    expect(treasury).toContain("key: 'treasury'")
    expect(treasury).toContain('Protect cash reality')
    expect(treasury).not.toContain("key: 'treasurer'")
    const contract = readFileSync(join(root, 'packages/executive-os/src/contract.ts'), 'utf8')
    expect(contract).toContain('return { ...action, requiresApproval: true }')
    const test = readFileSync(join(root, 'packages/executive-os/src/agents/treasury.test.ts'), 'utf8')
    expect(test).toContain('below minimum')
  })

  it('leaves corporate CAPITAL decisions intact and distinct', () => {
    const capital = readFileSync(join(root, 'scripts/lib/capital-allocation.ts'), 'utf8')
    expect(capital).toContain("export type CapitalDecision")
    expect(capital).toContain("'FUND NOW'")
    expect(capital).not.toContain('principal:aubert-nungisa')
    expect(TREASURER_IDENTITY.key).toBe('treasurer')
    expect(TREASURER_IDENTITY.capitalDomain).toBe('PERSONAL')
  })

  it('does not import payment, corporate finance, or executive-os runtimes', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'packages/treasurer/package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(Object.keys(pkg.dependencies)).toEqual(['zod'])
    const agent = readFileSync(join(root, 'packages/treasurer/src/agent.ts'), 'utf8')
    expect(agent).not.toContain('@nzila/payments-stripe')
    expect(agent).not.toContain('@nzila/finance-core')
    expect(agent).not.toContain('@nzila/executive-os')
  })
})
