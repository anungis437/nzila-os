/**
 * F06 R1 — who may act on an ICRA assessment once it has been claimed.
 *
 * Unclaimed: the bearer capability is the whole credential (pseudonymous access preserved).
 * Claimed: the capability is not accepted even if a hash were still stored; only the claiming account (still a member of the
 * claiming organization) or an administrator of that organization is admitted.
 */
import { describe, expect, it } from 'vitest'
import {
  authorizeAssessmentAccess,
  authorizeAssessmentToken,
  isAssessmentClaimed,
  type AccessDeps,
  type AssessmentAccessRow,
} from '../assessment-access'
import { capabilityDenialStatus, generateCapabilityToken, hashCapabilityToken } from '../assessment-capability'

const ASSESSMENT = '11111111-1111-4111-8111-111111111111'
const OWNER_ORG = '22222222-2222-4222-8222-222222222222'
const OTHER_ORG = '33333333-3333-4333-8333-333333333333'
const FUTURE = new Date(Date.now() + 86_400_000)
const PAST = new Date(Date.now() - 86_400_000)

const token = generateCapabilityToken()
const requestWith = (value: string | null) =>
  new Request('https://ue.test/api/icra/x', { headers: value ? { authorization: `Bearer ${value}` } : {} })

const unclaimed = (over: Partial<AssessmentAccessRow> = {}): AssessmentAccessRow => ({
  capabilityTokenHash: hashCapabilityToken(token),
  capabilityTokenExpiresAt: FUTURE,
  claimedAt: null,
  claimedOrgId: null,
  claimedByUserId: null,
  ...over,
})

const claimed = (over: Partial<AssessmentAccessRow> = {}): AssessmentAccessRow =>
  unclaimed({ claimedAt: new Date(), claimedOrgId: OWNER_ORG, claimedByUserId: 'user_purchaser', ...over })

/** members: userId -> organization -> role. */
const deps = (userId: string | null, roles: Record<string, 'member' | 'admin'> = {}): AccessDeps => ({
  currentUserId: async () => userId,
  hasRole: async (organizationId, role, id) => {
    if (id !== userId) return false
    const held = roles[organizationId]
    if (!held) return false
    return role === 'member' ? true : held === 'admin'
  },
})

describe('unclaimed assessments stay pseudonymous', () => {
  it('admits the capability holder with no account', async () => {
    const result = await authorizeAssessmentAccess(requestWith(token), ASSESSMENT, unclaimed(), deps(null))
    expect(result).toEqual({ ok: true, via: 'capability' })
  })

  it('refuses a wrong or missing capability', async () => {
    expect((await authorizeAssessmentAccess(requestWith('wrong-token-value-wrong-token-value'), ASSESSMENT, unclaimed(), deps(null))).ok).toBe(false)
    expect((await authorizeAssessmentAccess(requestWith(null), ASSESSMENT, unclaimed(), deps(null))).ok).toBe(false)
  })

  it('refuses an expired capability', async () => {
    const result = await authorizeAssessmentToken(token, unclaimed({ capabilityTokenExpiresAt: PAST }), deps(null))
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('does not let a signed-in stranger substitute an account for the missing capability', async () => {
    const result = await authorizeAssessmentToken(null, unclaimed(), deps('user_stranger', { [OWNER_ORG]: 'admin' }))
    expect(result.ok).toBe(false)
  })

  it('reports an absent row as not found', async () => {
    expect(await authorizeAssessmentToken(token, undefined, deps(null))).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('claimed assessments no longer accept the bearer capability', () => {
  it('refuses a valid, unexpired capability held by an anonymous caller (old link reuse after the claim)', async () => {
    const result = await authorizeAssessmentAccess(requestWith(token), ASSESSMENT, claimed(), deps(null))
    expect(result).toEqual({ ok: false, reason: 'authentication_required' })
    expect(capabilityDenialStatus('authentication_required')).toBe(401)
  })

  it('refuses the old capability even when the stored hash was never cleared, for a signed-in non-owner', async () => {
    const result = await authorizeAssessmentAccess(requestWith(token), ASSESSMENT, claimed(), deps('user_stranger', { [OTHER_ORG]: 'admin' }))
    expect(result).toEqual({ ok: false, reason: 'not_owner' })
    expect(capabilityDenialStatus('not_owner')).toBe(403)
  })

  it('admits the purchaser who claimed it while they remain a member of the claiming organization', async () => {
    const result = await authorizeAssessmentToken(null, claimed(), deps('user_purchaser', { [OWNER_ORG]: 'member' }))
    expect(result).toEqual({ ok: true, via: 'owner', userId: 'user_purchaser', organizationId: OWNER_ORG })
  })

  it('refuses the purchaser once they have left the claiming organization', async () => {
    const result = await authorizeAssessmentToken(null, claimed(), deps('user_purchaser', {}))
    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('admits an administrator of the claiming organization who did not claim it', async () => {
    const result = await authorizeAssessmentToken(null, claimed(), deps('user_admin', { [OWNER_ORG]: 'admin' }))
    expect(result.ok).toBe(true)
  })

  it('refuses a plain member of the claiming organization who did not claim it', async () => {
    const result = await authorizeAssessmentToken(null, claimed(), deps('user_peer', { [OWNER_ORG]: 'member' }))
    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('refuses an administrator of a different organization (organization switching does not transfer authority)', async () => {
    const result = await authorizeAssessmentToken(null, claimed(), deps('user_other_admin', { [OTHER_ORG]: 'admin' }))
    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('judges the claiming organization, not whichever organization the account has selected', async () => {
    const asked: string[] = []
    const probing: AccessDeps = {
      currentUserId: async () => 'user_purchaser',
      hasRole: async (organizationId) => {
        asked.push(organizationId)
        return organizationId === OWNER_ORG
      },
    }
    const result = await authorizeAssessmentToken(null, claimed(), probing)
    expect(result.ok).toBe(true)
    expect(asked).toEqual([OWNER_ORG])
  })

  it('fails closed when a claimed row has no claiming organization', async () => {
    const result = await authorizeAssessmentToken(null, claimed({ claimedOrgId: null }), deps('user_purchaser', { [OWNER_ORG]: 'admin' }))
    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('treats any one claim column as claimed', () => {
    expect(isAssessmentClaimed(unclaimed())).toBe(false)
    expect(isAssessmentClaimed(unclaimed({ claimedAt: new Date() }))).toBe(true)
    expect(isAssessmentClaimed(unclaimed({ claimedOrgId: OWNER_ORG }))).toBe(true)
    expect(isAssessmentClaimed(unclaimed({ claimedByUserId: 'user_x' }))).toBe(true)
  })
})
