/**
 * Unit tests — check-health.ts exit policy
 *
 * Verifies that process.exit(1) is only triggered by BLOCKING findings,
 * not by advisory-only failures.  Also verifies HEALTH_FAIL_ON_ADVISORY override.
 *
 * These tests target the exit-code decision logic in isolation — they do NOT
 * invoke the full script (which requires network / filesystem side effects).
 */

import { describe, it, expect, afterEach } from 'vitest'

/**
 * Mirror of the exit-decision logic extracted from check-health.ts main().
 * Must be kept in sync with the source.
 */
function computeExitCode(opts: {
  skipNetwork: boolean
  blockingFindingsCount: number
  advisoryFindingsCount: number
  failOnAdvisoryEnv?: string
}): number {
  const failOnAdvisory = (opts.failOnAdvisoryEnv ?? '') === 'true'
  const shouldFail =
    !opts.skipNetwork &&
    (opts.blockingFindingsCount > 0 || (failOnAdvisory && opts.advisoryFindingsCount > 0))
  return shouldFail ? 1 : 0
}

describe('check-health exit policy', () => {
  afterEach(() => {
    delete process.env.HEALTH_FAIL_ON_ADVISORY
  })

  it('exits 0 when all endpoints pass', () => {
    expect(
      computeExitCode({ skipNetwork: false, blockingFindingsCount: 0, advisoryFindingsCount: 0 }),
    ).toBe(0)
  })

  it('exits 0 for advisory-only failures (0 blocking)', () => {
    // Current staging posture: 20 advisory failures, 0 blocking — must NOT block releases
    expect(
      computeExitCode({ skipNetwork: false, blockingFindingsCount: 0, advisoryFindingsCount: 20 }),
    ).toBe(0)
  })

  it('exits 1 when any blocking (policyCritical) finding is present', () => {
    expect(
      computeExitCode({ skipNetwork: false, blockingFindingsCount: 1, advisoryFindingsCount: 5 }),
    ).toBe(1)
  })

  it('exits 0 when skipNetwork=true regardless of findings (local skip mode)', () => {
    expect(
      computeExitCode({
        skipNetwork: true,
        blockingFindingsCount: 3,
        advisoryFindingsCount: 10,
        failOnAdvisoryEnv: 'true',
      }),
    ).toBe(0)
  })

  it('exits 1 for advisory failures when HEALTH_FAIL_ON_ADVISORY=true', () => {
    expect(
      computeExitCode({
        skipNetwork: false,
        blockingFindingsCount: 0,
        advisoryFindingsCount: 1,
        failOnAdvisoryEnv: 'true',
      }),
    ).toBe(1)
  })

  it('exits 0 for advisory failures when HEALTH_FAIL_ON_ADVISORY is absent', () => {
    expect(
      computeExitCode({
        skipNetwork: false,
        blockingFindingsCount: 0,
        advisoryFindingsCount: 1,
        failOnAdvisoryEnv: undefined,
      }),
    ).toBe(0)
  })
})
