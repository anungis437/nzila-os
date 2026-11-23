import { describe, expect, it } from 'vitest'
import {
  InMemorySageInstitutionalCapacityStore,
  resolveInstitutionalCapacityForAdmission,
} from './institutional-capacity'

describe('institutional capacity resolution', () => {
  it('fails closed when no capacity store is wired', async () => {
    const result = await resolveInstitutionalCapacityForAdmission(null, {
      orgId: 'o1',
      workspaceId: 'w1',
      actorId: 'a1',
      resourceId: 'r1',
      action: 'resource.commit',
      mandateId: 'm1',
      mandatePositionId: 'pos-1',
    })
    expect(result).toEqual({ resolved: false, reason: 'CAPACITY_DATA_UNAVAILABLE' })
  })

  it('fails closed when conflict/recusal cannot be resolved', async () => {
    const store = new InMemorySageInstitutionalCapacityStore()
    store.setPosition('o1', 'w1', 'a1', 'pos-1')
    const result = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: 'o1',
      workspaceId: 'w1',
      actorId: 'a1',
      resourceId: 'r1',
      action: 'resource.commit',
      mandateId: 'm1',
      mandatePositionId: 'pos-1',
    })
    expect(result).toEqual({ resolved: false, reason: 'CONFLICT_DATA_UNAVAILABLE' })
  })

  it('rejects a browser position claim that does not match the mandate office', async () => {
    const store = new InMemorySageInstitutionalCapacityStore()
    store.setPosition('o1', 'w1', 'a1', 'pos-1')
    store.setConflict('o1', 'w1', 'a1', 'r1', 'resource.commit', false)
    const result = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: 'o1',
      workspaceId: 'w1',
      actorId: 'a1',
      resourceId: 'r1',
      action: 'resource.commit',
      mandateId: 'm1',
      mandatePositionId: 'pos-1',
      claimedPositionId: 'pos-other',
    })
    expect(result).toEqual({ resolved: false, reason: 'POSITION_CLAIM_MISMATCH' })
  })

  it('admits only when position and clear conflict status are server-verified', async () => {
    const store = new InMemorySageInstitutionalCapacityStore()
    store.setPosition('o1', 'w1', 'a1', 'pos-1')
    store.setConflict('o1', 'w1', 'a1', 'r1', 'resource.commit', false)
    const result = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: 'o1',
      workspaceId: 'w1',
      actorId: 'a1',
      resourceId: 'r1',
      action: 'resource.commit',
      mandateId: 'm1',
      mandatePositionId: 'pos-1',
      claimedPositionId: 'pos-1',
    })
    expect(result).toEqual({
      resolved: true,
      currentPositionId: 'pos-1',
      conflictOrRecusal: false,
    })
  })
})
