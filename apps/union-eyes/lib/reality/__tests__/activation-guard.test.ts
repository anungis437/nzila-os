/**
 * F06 R5 — turning on a configuration nothing consumes is refused as a specific blocked operation, recorded durably, and switching it off
 * is never refused. When a consumer ships (inEffect true) the guard stops refusing without any other change.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ audit: vi.fn(), contexts: [] as unknown[] }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: (...a: unknown[]) => m.audit(...a) }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => { m.contexts.push(ctx); return fn({ tx: true }) },
}))

import { ApiError } from '@/lib/api/framework'
import { activationRefusal, refuseUnavailableActivation, requestedActivation } from '../activation-guard'
import { INTEGRATION_SYNC_EFFECT, SSO_SIGN_IN_EFFECT } from '../configuration-effect'

const base = { organizationId: 'org-1', userId: 'admin-1', action: 'x.activate_blocked', resourceType: 'x' }

beforeEach(() => { m.audit.mockReset().mockResolvedValue(undefined); m.contexts = [] })

describe('requestedActivation', () => {
  it('names only the keys set to exactly true', () => {
    expect(requestedActivation({ enabled: true, autoProvision: false }, ['enabled', 'autoProvision'])).toEqual(['enabled'])
    expect(requestedActivation({ enabled: 'true', autoProvision: 1 }, ['enabled', 'autoProvision'])).toEqual([])
    expect(requestedActivation({}, ['enabled'])).toEqual([])
  })
})

describe('refuseUnavailableActivation', () => {
  it('records the attempt as a failure in its own organization-scoped transaction, then refuses with the operation and what it needs', async () => {
    let refused: unknown
    try { await refuseUnavailableActivation({ ...base, effect: INTEGRATION_SYNC_EFFECT, asked: ['enabled'], resourceId: 'i1' }) } catch (error) { refused = error }

    expect(refused).toBeInstanceOf(ApiError)
    expect((refused as ApiError).message).toContain('integration.sync.execute')
    expect((refused as ApiError).message).toContain('the institution approves the external system')
    expect((refused as ApiError).details).toMatchObject({ blockedOperation: { operation: 'integration.sync.execute' }, requested: ['enabled'] })
    expect(m.contexts).toEqual([{ organizationId: 'org-1', userId: 'admin-1' }])
    expect(m.audit).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({ action: 'x.activate_blocked', resourceId: 'i1', details: { blockedOperation: 'integration.sync.execute', capability: 'UE-EXT-INTEGRATION-SYNC', requested: ['enabled'] } }),
      'failure',
    )
  })

  it('does nothing when nothing is being turned on, so switching off and ordinary edits pass', async () => {
    await expect(refuseUnavailableActivation({ ...base, effect: SSO_SIGN_IN_EFFECT, asked: [] })).resolves.toBeUndefined()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('stops refusing once a consumer exists (inEffect true), with no other change', async () => {
    const live = { ...SSO_SIGN_IN_EFFECT, inEffect: true }
    await expect(refuseUnavailableActivation({ ...base, effect: live, asked: ['enabled'] })).resolves.toBeUndefined()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('refuses even when the refusal record cannot be written: an unrecorded refusal is not a reason to allow the activation', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit down'))
    await expect(refuseUnavailableActivation({ ...base, effect: SSO_SIGN_IN_EFFECT, asked: ['enabled'] })).rejects.toThrow('audit down')
  })

  it('words the refusal from the effect', () => {
    expect(activationRefusal(SSO_SIGN_IN_EFFECT, ['enabled', 'autoProvision']).message).toContain('enabled and autoProvision cannot be turned on')
  })
})
