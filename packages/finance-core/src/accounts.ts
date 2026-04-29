import { createHash } from 'node:crypto'
import type { FinanceAccount, BalanceSnapshot, AccountType, FinanceStatus } from './types.js'

export interface CreateAccountInput {
  orgId: string
  accountType: AccountType
  ownerId: string
  displayName: string
  currency: string
  initialBalanceCents?: number
  metadata?: Record<string, unknown>
}

export interface AccountService {
  createAccount(input: CreateAccountInput): Promise<FinanceAccount>
  getAccount(orgId: string, accountId: string): Promise<FinanceAccount | null>
  listAccounts(orgId: string): Promise<FinanceAccount[]>
  updateBalance(orgId: string, accountId: string, deltaAmountCents: number): Promise<FinanceAccount>
  snapshotBalance(orgId: string, accountId: string, runId: string): Promise<BalanceSnapshot>
  suspendAccount(orgId: string, accountId: string): Promise<FinanceAccount>
  archiveAccount(orgId: string, accountId: string): Promise<FinanceAccount>
}

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export class InMemoryAccountService implements AccountService {
  private accounts = new Map<string, FinanceAccount>()
  private snapshots: BalanceSnapshot[] = []

  async createAccount(input: CreateAccountInput): Promise<FinanceAccount> {
    const now = new Date().toISOString()
    const id = generateId(`${input.orgId}:${input.ownerId}:${input.accountType}:${now}`)
    const account: FinanceAccount = {
      id,
      orgId: input.orgId,
      accountType: input.accountType,
      status: 'pending' as FinanceStatus,
      ownerId: input.ownerId,
      displayName: input.displayName,
      currency: input.currency,
      balanceCents: input.initialBalanceCents ?? 0,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    }
    this.accounts.set(`${input.orgId}:${id}`, account)
    return account
  }

  async getAccount(orgId: string, accountId: string): Promise<FinanceAccount | null> {
    return this.accounts.get(`${orgId}:${accountId}`) ?? null
  }

  async listAccounts(orgId: string): Promise<FinanceAccount[]> {
    return Array.from(this.accounts.values()).filter((a) => a.orgId === orgId)
  }

  async updateBalance(orgId: string, accountId: string, deltaAmountCents: number): Promise<FinanceAccount> {
    const account = await this.getAccount(orgId, accountId)
    if (!account) throw new Error(`Account not found: ${accountId}`)
    const updated: FinanceAccount = {
      ...account,
      balanceCents: account.balanceCents + deltaAmountCents,
      updatedAt: new Date().toISOString(),
    }
    this.accounts.set(`${orgId}:${accountId}`, updated)
    return updated
  }

  async snapshotBalance(orgId: string, accountId: string, runId: string): Promise<BalanceSnapshot> {
    const account = await this.getAccount(orgId, accountId)
    if (!account) throw new Error(`Account not found: ${accountId}`)
    const snapshotAt = new Date().toISOString()
    const snapshot: BalanceSnapshot = {
      id: generateId(`${orgId}:${accountId}:${runId}:${snapshotAt}`),
      orgId,
      accountId,
      balanceCents: account.balanceCents,
      currency: account.currency,
      snapshotAt,
      runId,
    }
    this.snapshots.push(snapshot)
    return snapshot
  }

  async suspendAccount(orgId: string, accountId: string): Promise<FinanceAccount> {
    const account = await this.getAccount(orgId, accountId)
    if (!account) throw new Error(`Account not found: ${accountId}`)
    const updated: FinanceAccount = {
      ...account,
      status: 'suspended',
      updatedAt: new Date().toISOString(),
    }
    this.accounts.set(`${orgId}:${accountId}`, updated)
    return updated
  }

  async archiveAccount(orgId: string, accountId: string): Promise<FinanceAccount> {
    const account = await this.getAccount(orgId, accountId)
    if (!account) throw new Error(`Account not found: ${accountId}`)
    const updated: FinanceAccount = {
      ...account,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    }
    this.accounts.set(`${orgId}:${accountId}`, updated)
    return updated
  }
}
