import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAccountService } from './accounts.js'

describe('InMemoryAccountService', () => {
  let service: InMemoryAccountService

  beforeEach(() => {
    service = new InMemoryAccountService()
  })

  it('creates an account with initial balance', async () => {
    const account = await service.createAccount({
      orgId: 'org-1',
      accountType: 'member',
      ownerId: 'user-1',
      displayName: 'Test Account',
      currency: 'ZAR',
      initialBalanceCents: 10000,
    })
    expect(account.orgId).toBe('org-1')
    expect(account.balanceCents).toBe(10000)
    expect(account.status).toBe('pending')
  })

  it('isolates accounts by orgId', async () => {
    await service.createAccount({
      orgId: 'org-1',
      accountType: 'member',
      ownerId: 'user-1',
      displayName: 'Org1 Account',
      currency: 'ZAR',
    })
    await service.createAccount({
      orgId: 'org-2',
      accountType: 'member',
      ownerId: 'user-2',
      displayName: 'Org2 Account',
      currency: 'ZAR',
    })
    const org1Accounts = await service.listAccounts('org-1')
    const org2Accounts = await service.listAccounts('org-2')
    expect(org1Accounts).toHaveLength(1)
    expect(org2Accounts).toHaveLength(1)
    expect(org1Accounts[0]?.orgId).toBe('org-1')
    expect(org2Accounts[0]?.orgId).toBe('org-2')
  })

  it('updates balance with delta', async () => {
    const account = await service.createAccount({
      orgId: 'org-1',
      accountType: 'treasury',
      ownerId: 'treasury-1',
      displayName: 'Treasury',
      currency: 'ZAR',
      initialBalanceCents: 50000,
    })
    const updated = await service.updateBalance('org-1', account.id, 10000)
    expect(updated.balanceCents).toBe(60000)
  })

  it('snapshots balance for a run', async () => {
    const account = await service.createAccount({
      orgId: 'org-1',
      accountType: 'treasury',
      ownerId: 'treasury-1',
      displayName: 'Treasury',
      currency: 'ZAR',
      initialBalanceCents: 75000,
    })
    const snapshot = await service.snapshotBalance('org-1', account.id, 'run-001')
    expect(snapshot.balanceCents).toBe(75000)
    expect(snapshot.runId).toBe('run-001')
    expect(snapshot.orgId).toBe('org-1')
  })

  it('suspends an account', async () => {
    const account = await service.createAccount({
      orgId: 'org-1',
      accountType: 'member',
      ownerId: 'user-1',
      displayName: 'Account',
      currency: 'ZAR',
    })
    const suspended = await service.suspendAccount('org-1', account.id)
    expect(suspended.status).toBe('suspended')
  })

  it('archives an account', async () => {
    const account = await service.createAccount({
      orgId: 'org-1',
      accountType: 'member',
      ownerId: 'user-1',
      displayName: 'Account',
      currency: 'ZAR',
    })
    const archived = await service.archiveAccount('org-1', account.id)
    expect(archived.status).toBe('archived')
  })

  it('returns null for non-existent account', async () => {
    const result = await service.getAccount('org-1', 'does-not-exist')
    expect(result).toBeNull()
  })
})
