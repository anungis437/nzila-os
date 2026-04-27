/**
 * Contract Test — Union Eyes FSM Route Enforcement
 *
 * UE-FSM-001:
 *   1. Case PATCH route must delegate status transitions to workflow-engine FSM helper.
 *   2. Case escalate route must not directly set claim status; it must use FSM helper.
 *   3. Grievance status route must validate transitions through unified lifecycle FSM.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8')
}

describe('UE-FSM-001: Union Eyes route-level FSM enforcement', () => {
  it('cases PATCH route delegates status transitions to updateClaimStatusById', () => {
    const src = read('apps/union-eyes/app/api/cases/[caseId]/route.ts')
    expect(src).toContain('updateClaimStatusById')
    expect(src).toContain('if (body.status !== undefined)')
    expect(src).not.toContain("status: 'status'")
  })

  it('cases escalate route uses FSM helper and does not hard-set resolved status', () => {
    const src = read('apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts')
    expect(src).toContain('updateClaimStatusById')

    const claimsUpdateStart = src.indexOf('.update(claims)')
    const claimsUpdateEnd = src.indexOf('.where(eq(claims.claimId, caseId));', claimsUpdateStart)
    expect(claimsUpdateStart).toBeGreaterThanOrEqual(0)
    expect(claimsUpdateEnd).toBeGreaterThan(claimsUpdateStart)

    const claimsUpdateBlock = src.slice(claimsUpdateStart, claimsUpdateEnd)
    expect(claimsUpdateBlock).not.toContain("status: 'resolved'")
    expect(claimsUpdateBlock).toContain('resolutionOutcome')
  })

  it('grievance status route validates transitions via unified lifecycle FSM', () => {
    const src = read('apps/union-eyes/app/api/grievances/[id]/status/route.ts')
    expect(src).toContain('validateTransition')
    expect(src).toContain("toLifecycleState('grievance'")
    expect(src).toContain("toLifecycleState('cupe'")
  })
})
