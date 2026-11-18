import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  canonicalActionScope,
  ACTION_ACTOR,
  ACTION_ORG,
} from '@/actions/__tests__/fixtures/canonical-action-scope'
import { UserRole } from './auth/roles'
import { assertOrgActionContext, resolveOrgContext, type OrgActionContext } from './resolve-org'

describe('canonical server action callback scope', () => {
  beforeEach(() => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
  })
  afterEach(() => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2
  })
  it('keeps a verified actor/organization through asynchronous effects and never exposes the bearer', async () => {
    let saved: OrgActionContext | undefined
    await canonicalActionScope(() =>
      resolveOrgContext({}, async (context) => {
        saved = context
        expect(context).toEqual({
          userId: ACTION_ACTOR,
          organizationId: ACTION_ORG,
          role: UserRole.MEMBER,
        })
        await Promise.resolve()
        assertOrgActionContext(context)
        expect(Object.isFrozen(context)).toBe(true)
        expect(JSON.stringify(context)).not.toContain('bearer')
      }),
    )
    expect(() => assertOrgActionContext(saved!)).toThrow('SESSION_AUTHORITY_REQUIRED')
  })
  it('rejects forged structurally identical contexts', () =>
    canonicalActionScope(async () => {
      expect(() =>
        assertOrgActionContext({
          userId: ACTION_ACTOR,
          organizationId: ACTION_ORG,
          role: UserRole.MEMBER,
        }),
      ).toThrow('SESSION_AUTHORITY_REQUIRED')
    }))
  it('denies foreign org and actor substitutions before the callback', async () => {
    let effects = 0
    await expect(
      canonicalActionScope(() =>
        resolveOrgContext(
          { organizationId: '22222222-2222-4222-8222-222222222222' },
          async () => ++effects,
        ),
      ),
    ).rejects.toThrow('MEMBERSHIP_REQUIRED')
    await expect(
      canonicalActionScope(() =>
        resolveOrgContext({ expectedActorUserId: 'other-actor' }, async () => ++effects),
      ),
    ).rejects.toThrow('ACTOR_MISMATCH')
    expect(effects).toBe(0)
  })
  it('refuses blank selectors and expired scope instead of selecting a fallback', async () => {
    await expect(
      canonicalActionScope(() => resolveOrgContext({ organizationId: '' }, async () => 1)),
    ).rejects.toThrow('INVALID_ORGANIZATION')
    await expect(
      canonicalActionScope(() => resolveOrgContext({}, async () => 1), { expiresAt: new Date(0) }),
    ).rejects.toThrow('SESSION_AUTHORITY_REQUIRED')
  })
  it('fails closed in the historical identity-GUC mode', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '0'
    await expect(canonicalActionScope(() => resolveOrgContext({}, async () => 1))).rejects.toThrow(
      'SESSION_AUTHORITY_REQUIRED',
    )
  })
})
