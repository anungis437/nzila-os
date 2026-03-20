/**
 * Zonga — Command Bus Pre-Execution Guard Tests
 *
 * Validates that the guard infrastructure in the command bus
 * correctly blocks commands when guards return not-allowed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '../..')

describe('Command bus hardening', () => {
  it('has pre-execution guard registry', () => {
    const content = readFileSync(resolve(APP, 'lib/control/command-bus.ts'), 'utf-8')
    expect(content).toContain('PreExecutionGuard')
    expect(content).toContain('preGuards')
    expect(content).toContain('registerPreExecutionGuard')
  })

  it('blocks commands when guard returns allowed: false', () => {
    const content = readFileSync(resolve(APP, 'lib/control/command-bus.ts'), 'utf-8')
    expect(content).toContain('gate.allowed')
    expect(content).toContain('PRE_EXECUTION_GUARD_FAILED')
    expect(content).toContain('command.blocked')
  })

  it('exports registerPreExecutionGuard from control barrel', () => {
    const content = readFileSync(resolve(APP, 'lib/control/index.ts'), 'utf-8')
    expect(content).toContain('registerPreExecutionGuard')
  })

  it('execute-payout handler calls gatePayout before Stripe', () => {
    const content = readFileSync(resolve(APP, 'lib/control/handlers/execute-payout.handler.ts'), 'utf-8')
    expect(content).toContain('gatePayout')
    expect(content).toContain('PAYOUT_GATED')
    expect(content).toContain('hasActiveDisputes')
    // Verify the gate happens before Stripe
    const gateIdx = content.indexOf('gatePayout')
    const stripeIdx = content.indexOf('executeCreatorPayout')
    expect(gateIdx).toBeLessThan(stripeIdx)
  })

  it('execute-payout handler has compensation on post-execution failure', () => {
    const content = readFileSync(resolve(APP, 'lib/control/handlers/execute-payout.handler.ts'), 'utf-8')
    expect(content).toContain('compensateFailedPayout')
    expect(content).toContain('POST_EXECUTION_FAILURE')
  })

  it('resolve-moderation handler requires admin reason (G1)', () => {
    const content = readFileSync(resolve(APP, 'lib/control/handlers/resolve-moderation-case.handler.ts'), 'utf-8')
    expect(content).toContain('guardAdminActionReason')
    expect(content).toContain('GOVERNANCE_VIOLATION')
  })

  it('resolve-moderation handler has audit trail', () => {
    const content = readFileSync(resolve(APP, 'lib/control/handlers/resolve-moderation-case.handler.ts'), 'utf-8')
    expect(content).toContain('moderation.case.resolved')
    expect(content).toContain('audit_log')
  })
})
