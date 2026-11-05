/**
 * Contract Test — Union Eyes FSM Route Enforcement
 *
 * UE-FSM-001:
 *   1. Case PATCH rejects status changes; the dedicated transition route enforces the FSM.
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
  it('cases PATCH rejects status bypass and dedicated transition route validates FSM', () => {
    const src = read('apps/union-eyes/app/api/cases/[caseId]/route.ts')
    expect(src).toContain("'assignedTo' in body || 'status' in body")
    expect(src).toContain("throw ApiError.badRequest('Use the case assignment or transition endpoint for this change')")
    const transition = read('apps/union-eyes/app/api/cases/[caseId]/transition/route.ts')
    expect(transition).toContain('validateTransition(')
    expect(transition).toContain('if (!validation.allowed)')
    expect(src).not.toContain("status: 'status'")
  })

  it('cases escalate route uses FSM helper and does not hard-set resolved status', () => {
    const src = read('apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts')
    expect(src).toContain('updateClaimStatusById')

    const claimsUpdateStart = src.indexOf('.update(claims)')
    const claimsUpdateEnd = src.indexOf('.where(and(eq(claims.claimId, caseId), eq(claims.organizationId, orgId)));', claimsUpdateStart)
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
