import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, ORG_B, U } from './authority-kernel-harness'
import { freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { CASE_PROJECTION_ACTIONS, enforceAuthority, enforceCaseProjection } from '../../lib/authority/store/enforce'
import { assignCase, declareOwnRecusal } from '../../lib/authority/store/lifecycle'
import type { SqlExecutor } from '../../lib/authority/store/executor'

let db: PGlite
let k: ReturnType<typeof kit>
const caseId = newUuid()
const privileged = newUuid()
const expiring = newUuid()
const now = new Date()
const deps = () => ({ ...k.deps, now: () => now })

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await db.query(`INSERT INTO public.grievances(id,organization_id,created_by,has_legal_implications)
      VALUES($1,$2,$3,false),($4,$2,$3,true),($5,$2,$3,false)`, [caseId, ORG, U.member, privileged, expiring])
  })
  await k.adoptDefaultRules()
  await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [caseId, privileged, expiring] } })
  for (const id of [caseId, privileged, expiring]) await k.as(U.officer)(t => assignCase(t, k.deps, {
    organizationId: ORG, issuerUserId: U.officer, caseId: id, assigneeUserId: U.steward,
    permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence'],
    effectiveAt: minutesAgo(),
    ...(id === expiring ? { expiresAt: new Date(now.getTime() + 2 * 86400000) } : {}),
  }))
})
afterAll(async () => { await db?.close() })

/** Compare every actual kernel decision, including reasons/scopes, against independent fresh loads. */
async function equivalent(who: string, id = caseId, org = ORG, at = now) {
  return k.as(who, org)(async t => {
    let independentQueries = 0
    let projectionQueries = 0
    const counted = (increment: () => void): SqlExecutor => ({ query: (text, params) => { increment(); return t.query(text, params) } })
    const independent: Record<string, unknown> = {}
    for (const action of CASE_PROJECTION_ACTIONS) independent[action] = await enforceAuthority(
      counted(() => independentQueries++), { ...deps(), now: () => at }, {
        principalUserId: who, organizationId: org, action,
        resource: { type: 'case', id, organizationId: org },
      }, { authenticated: true },
    )
    const projection = await enforceCaseProjection(counted(() => projectionQueries++), { ...deps(), now: () => at }, {
      principalUserId: who, organizationId: org, caseId: id,
    })
    expect(projection).toEqual(independent)
    expect(projectionQueries * 5).toBeLessThan(independentQueries)
    return projection
  })
}

describe('read-only case action projection uses fresh canonical facts once per case', () => {
  it('preserves each distinct primary-handler decision with at least fivefold fewer queries', async () => {
    const result = await equivalent(U.steward)
    expect(result['case:read'].effect).toBe('allow')
    expect(result['case:export_sealed_evidence'].effect).toBe('allow')
  })

  it.each([U.member, U.steward2, U.chief, U.officer, U.president])(
    'matches independent authority for %s without deriving permissions from rank or another action', async who => {
      await equivalent(who)
    },
  )

  it('preserves privileged-case, foreign-tenant and missing-case denials', async () => {
    await equivalent(U.member, privileged)
    const foreign = await equivalent(U.steward, caseId, ORG_B)
    expect(Object.values(foreign).every(d => d.effect === 'deny')).toBe(true)
    const missing = await equivalent(U.steward, newUuid())
    expect(Object.values(missing).every(d => d.effect === 'deny')).toBe(true)
  })

  it('does not retain an earlier allow after a real recusal is recorded', async () => {
    expect((await equivalent(U.steward))['case:read'].effect).toBe('allow')
    await k.as(U.steward)(t => declareOwnRecusal(t, {
      organizationId: ORG, principalUserId: U.steward, resourceType: 'case', resourceId: caseId,
      reason: 'Synthetic local regression conflict',
    }))
    const refused = await equivalent(U.steward)
    expect(Object.values(refused).every(d => d.effect === 'deny')).toBe(true)
    expect(refused['case:read'].reasons.map(r => r.code)).toContain('RECUSED')
  })

  it('re-evaluates time-boxed case authority on every projection', async () => {
    expect((await equivalent(U.steward, expiring))['case:read'].effect).toBe('allow')
    const later = await equivalent(U.steward, expiring, ORG, new Date(now.getTime() + 3 * 86400000))
    expect(Object.values(later).every(d => d.effect === 'deny')).toBe(true)
  })

  it('denies every action for a forged principal and an authority-loader failure', async () => {
    await k.as(U.steward)(async t => {
      const forged = await enforceCaseProjection(t, deps(), { principalUserId: U.officer, organizationId: ORG, caseId })
      expect(Object.values(forged).every(d => d.effect === 'deny' && d.reasons.some(r => r.code === 'PRINCIPAL_MISMATCH'))).toBe(true)
      const failed = await enforceCaseProjection(t, { ...deps(), memberships: async () => { throw new Error('synthetic source failure') } }, {
        principalUserId: U.steward, organizationId: ORG, caseId,
      })
      expect(Object.values(failed).every(d => d.effect === 'deny' && d.reasons.some(r => r.code === 'FACTS_CONTRADICTORY'))).toBe(true)
    })
  })
})
