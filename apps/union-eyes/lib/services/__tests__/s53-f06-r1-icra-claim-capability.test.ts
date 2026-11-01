/**
 * S53 / F06 R1 pins — ICRA claim withdraws the bearer capability and every capability-bearing path honors ownership.
 * Behaviour is proven in assessment-access.test.ts and the native icra-claim-capability-revocation.postgres.test.ts; these pins keep
 * a future edit from quietly routing a path around the gate.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

const GATED = [
  'app/api/icra/[assessmentId]/profile/route.ts',
  'app/api/icra/[assessmentId]/answer/route.ts',
  'app/api/icra/[assessmentId]/submit/route.ts',
  'app/api/icra/results/[id]/route.ts',
  'app/api/icra/report/[assessmentId]/route.ts',
  'app/api/icra/checkout/route.ts',
  'app/api/icra/start/route.ts',
]

describe('S53 ICRA claim and capability withdrawal', () => {
  it.each(GATED)('%s decides access through the ownership-aware gate, not the bare capability check', (file) => {
    const src = read(file)
    expect(src).toMatch(/authorizeAssessmentAccess\s*\(/)
    expect(src).not.toMatch(/\bcheckCapability\s*\(/)
    expect(src).toMatch(/claimedOrgId:\s*icraAssessments\.claimedOrgId|select\(\)/)
  })

  it.each(['actions/icra/get-profile.ts', 'actions/icra/get-adaptive-resolution.ts'])('%s uses the same gate', (file) => {
    const src = read(file)
    expect(src).toMatch(/authorizeAssessmentToken\s*\(/)
    expect(src).not.toMatch(/\bcheckCapability\s*\(/)
  })

  it('the claim writes the withdrawal of the capability in the same conditional update and clears the cookie', () => {
    const src = read('app/api/icra/[assessmentId]/claim/route.ts')
    const update = src.slice(src.indexOf('.update(icraAssessments)'), src.indexOf('.returning('))
    expect(update).toMatch(/capabilityTokenHash:\s*null/)
    expect(update).toMatch(/capabilityTokenExpiresAt:\s*null/)
    expect(update).toMatch(/isNull\(icraAssessments\.claimedAt\)/)
    expect(src).toMatch(/clearCapabilityCookie\(/)
  })

  it('a claimed assessment cannot mint a new capability cookie or have its link mailed', () => {
    expect(read('app/api/icra/[assessmentId]/capability/exchange/route.ts')).toMatch(/isAssessmentClaimed\(assessment\)/)
    expect(read('app/api/icra/email-results/route.ts')).toMatch(/isAssessmentClaimed\(/)
  })

  it('the gate never accepts the capability for a claimed row', () => {
    const src = read('lib/icra/assessment-access.ts')
    const claimedBranch = src.slice(src.indexOf('if (!isAssessmentClaimed(row))'))
    // checkCapability appears only inside the unclaimed branch, which returns before any claimed-owner logic
    expect(claimedBranch.indexOf('checkCapability(')).toBeLessThan(claimedBranch.indexOf('currentUserId()'))
    expect(claimedBranch.slice(0, claimedBranch.indexOf('currentUserId()'))).toMatch(/return check\.ok/)
  })
})
