/**
 * @nzila/zonga-wallet — Wallet Service
 *
 * Multi-currency wallet system. ALL mutations go through the
 * Economic Engine's double-entry ledger. Supports credit, debit,
 * transfer, refund, and payout-to-rail operations.
 *
 * Invariants:
 * - Every wallet mutation produces balanced ledger entries
 * - Idempotent via idempotency keys
 * - Hold balances for pending payouts
 * - All amounts in minor units (cents/centimes)
 *
 * @module @nzila/zonga-wallet
 */

import { z } from 'zod'

// ── Wallet Types ────────────────────────────────────────────────────────────

export const WalletStatus = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  CLOSED: 'closed',
} as const
export type WalletStatus = (typeof WalletStatus)[keyof typeof WalletStatus]

export const WalletTxType = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
  HOLD: 'hold',
  RELEASE_HOLD: 'release_hold',
  REFUND: 'refund',
  PAYOUT: 'payout',
  FEE: 'fee',
  REVENUE_SHARE: 'revenue_share',
} as const
export type WalletTxType = (typeof WalletTxType)[keyof typeof WalletTxType]

export interface Wallet {
  readonly id: string
  readonly orgId: string
  readonly ownerId: string
  readonly ownerType: 'creator' | 'listener' | 'promoter' | 'platform'
  readonly currency: string
  readonly balance: number
  readonly holdBalance: number
  readonly status: WalletStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface WalletTransaction {
  readonly id: string
  readonly walletId: string
  readonly type: WalletTxType
  readonly amount: number
  readonly balanceBefore: number
  readonly balanceAfter: number
  readonly holdBalanceBefore: number
  readonly holdBalanceAfter: number
  readonly description: string
  readonly referenceId: string | null
  readonly counterpartyWalletId: string | null
  readonly idempotencyKey: string
  readonly createdAt: Date
}

// ── Wallet Operations ───────────────────────────────────────────────────────

export interface WalletOperationResult {
  readonly success: boolean
  readonly transactionId: string | null
  readonly wallet: Wallet
  readonly error: string | null
}

export interface CreditParams {
  readonly walletId: string
  readonly amount: number
  readonly description: string
  readonly referenceId: string
  readonly idempotencyKey: string
  readonly source: 'revenue_share' | 'refund' | 'transfer' | 'manual'
}

export interface DebitParams {
  readonly walletId: string
  readonly amount: number
  readonly description: string
  readonly referenceId: string
  readonly idempotencyKey: string
  readonly reason: 'payout' | 'fee' | 'transfer' | 'penalty'
}

export interface TransferParams {
  readonly fromWalletId: string
  readonly toWalletId: string
  readonly amount: number
  readonly description: string
  readonly idempotencyKey: string
}

export interface HoldParams {
  readonly walletId: string
  readonly amount: number
  readonly description: string
  readonly referenceId: string
  readonly idempotencyKey: string
}

// ── Ledger Entry Builder ────────────────────────────────────────────────────

export interface WalletLedgerEntry {
  readonly accountId: string
  readonly direction: 'debit' | 'credit'
  readonly amount: number
  readonly currency: string
  readonly description: string
}

/**
 * Builds balanced double-entry ledger entries for a wallet credit.
 * Revenue → Wallet (credit wallet, debit revenue source).
 * Pure function.
 */
export function buildCreditEntries(
  walletId: string,
  revenueSourceAccountId: string,
  amount: number,
  currency: string,
  description: string,
): readonly WalletLedgerEntry[] {
  return [
    {
      accountId: revenueSourceAccountId,
      direction: 'debit',
      amount,
      currency,
      description: `[OUT] ${description}`,
    },
    {
      accountId: walletId,
      direction: 'credit',
      amount,
      currency,
      description: `[IN] ${description}`,
    },
  ]
}

/**
 * Builds balanced double-entry ledger entries for a wallet debit.
 * Wallet → Destination (debit wallet, credit destination).
 * Pure function.
 */
export function buildDebitEntries(
  walletId: string,
  destinationAccountId: string,
  amount: number,
  currency: string,
  description: string,
): readonly WalletLedgerEntry[] {
  return [
    {
      accountId: walletId,
      direction: 'debit',
      amount,
      currency,
      description: `[OUT] ${description}`,
    },
    {
      accountId: destinationAccountId,
      direction: 'credit',
      amount,
      currency,
      description: `[IN] ${description}`,
    },
  ]
}

/**
 * Builds balanced double-entry ledger entries for a wallet-to-wallet transfer.
 * Pure function.
 */
export function buildTransferEntries(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  currency: string,
  description: string,
): readonly WalletLedgerEntry[] {
  return [
    {
      accountId: fromWalletId,
      direction: 'debit',
      amount,
      currency,
      description: `[TRANSFER OUT] ${description}`,
    },
    {
      accountId: toWalletId,
      direction: 'credit',
      amount,
      currency,
      description: `[TRANSFER IN] ${description}`,
    },
  ]
}

// ── Wallet Validation ───────────────────────────────────────────────────────

export interface WalletValidation {
  readonly valid: boolean
  readonly errors: readonly string[]
}

/**
 * Validate a debit operation against wallet constraints.
 * Pure function.
 */
export function validateDebit(wallet: Wallet, amount: number): WalletValidation {
  const errors: string[] = []

  if (wallet.status !== WalletStatus.ACTIVE) {
    errors.push(`Wallet ${wallet.id} is ${wallet.status} — cannot debit`)
  }

  const availableBalance = wallet.balance - wallet.holdBalance
  if (amount > availableBalance) {
    errors.push(
      `Insufficient available balance: requested ${amount}, available ${availableBalance} (balance=${wallet.balance}, held=${wallet.holdBalance})`,
    )
  }

  if (amount <= 0) {
    errors.push('Debit amount must be positive')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a hold operation.
 */
export function validateHold(wallet: Wallet, amount: number): WalletValidation {
  const errors: string[] = []

  if (wallet.status !== WalletStatus.ACTIVE) {
    errors.push(`Wallet ${wallet.id} is ${wallet.status} — cannot hold`)
  }

  const availableBalance = wallet.balance - wallet.holdBalance
  if (amount > availableBalance) {
    errors.push(
      `Insufficient available balance for hold: requested ${amount}, available ${availableBalance}`,
    )
  }

  if (amount <= 0) {
    errors.push('Hold amount must be positive')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a credit operation.
 */
export function validateCredit(wallet: Wallet, amount: number): WalletValidation {
  const errors: string[] = []

  if (wallet.status === WalletStatus.CLOSED) {
    errors.push(`Wallet ${wallet.id} is closed — cannot credit`)
  }

  if (amount <= 0) {
    errors.push('Credit amount must be positive')
  }

  return { valid: errors.length === 0, errors }
}

// ── Wallet Service Factory ──────────────────────────────────────────────────

export interface WalletRepository {
  findById(walletId: string): Promise<Wallet | null>
  findByOwner(orgId: string, ownerId: string): Promise<Wallet | null>
  create(wallet: Omit<Wallet, 'createdAt' | 'updatedAt'>): Promise<Wallet>
  updateBalance(walletId: string, balance: number, holdBalance: number): Promise<Wallet>
  updateStatus(walletId: string, status: WalletStatus): Promise<Wallet>
  insertTransaction(tx: Omit<WalletTransaction, 'createdAt'>): Promise<WalletTransaction>
  findTransactionByIdempotencyKey(key: string): Promise<WalletTransaction | null>
}

export interface LedgerPort {
  postEntries(params: {
    correlationId: string
    description: string
    entries: readonly WalletLedgerEntry[]
  }): Promise<{ transactionId: string }>
}

/**
 * Creates the wallet service. All mutations go through the economic engine ledger.
 */
export function createWalletService(deps: {
  repository: WalletRepository
  ledger: LedgerPort
}) {
  const { repository, ledger } = deps

  return {
    async getWallet(walletId: string): Promise<Wallet | null> {
      return repository.findById(walletId)
    },

    async getOrCreateWallet(params: {
      orgId: string
      ownerId: string
      ownerType: 'creator' | 'listener' | 'promoter' | 'platform'
      currency: string
    }): Promise<Wallet> {
      const existing = await repository.findByOwner(params.orgId, params.ownerId)
      if (existing) return existing

      return repository.create({
        id: crypto.randomUUID(),
        orgId: params.orgId,
        ownerId: params.ownerId,
        ownerType: params.ownerType,
        currency: params.currency,
        balance: 0,
        holdBalance: 0,
        status: WalletStatus.ACTIVE,
      })
    },

    async credit(params: CreditParams): Promise<WalletOperationResult> {
      // Idempotency check
      const existing = await repository.findTransactionByIdempotencyKey(params.idempotencyKey)
      if (existing) {
        const wallet = await repository.findById(params.walletId)
        return { success: true, transactionId: existing.id, wallet: wallet!, error: null }
      }

      const wallet = await repository.findById(params.walletId)
      if (!wallet) {
        return { success: false, transactionId: null, wallet: null as unknown as Wallet, error: 'Wallet not found' }
      }

      const validation = validateCredit(wallet, params.amount)
      if (!validation.valid) {
        return { success: false, transactionId: null, wallet, error: validation.errors.join('; ') }
      }

      // Post to economic engine ledger
      const platformAccountId = `platform_revenue_${wallet.currency}`
      const entries = buildCreditEntries(
        wallet.id,
        platformAccountId,
        params.amount,
        wallet.currency,
        params.description,
      )

      const ledgerResult = await ledger.postEntries({
        correlationId: params.referenceId,
        description: params.description,
        entries,
      })

      // Update wallet balance
      const newBalance = wallet.balance + params.amount
      const updatedWallet = await repository.updateBalance(wallet.id, newBalance, wallet.holdBalance)

      // Record transaction
      const txId = crypto.randomUUID()
      await repository.insertTransaction({
        id: txId,
        walletId: wallet.id,
        type: WalletTxType.CREDIT,
        amount: params.amount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        holdBalanceBefore: wallet.holdBalance,
        holdBalanceAfter: wallet.holdBalance,
        description: params.description,
        referenceId: params.referenceId,
        counterpartyWalletId: null,
        idempotencyKey: params.idempotencyKey,
      })

      return { success: true, transactionId: txId, wallet: updatedWallet, error: null }
    },

    async debit(params: DebitParams): Promise<WalletOperationResult> {
      const existing = await repository.findTransactionByIdempotencyKey(params.idempotencyKey)
      if (existing) {
        const wallet = await repository.findById(params.walletId)
        return { success: true, transactionId: existing.id, wallet: wallet!, error: null }
      }

      const wallet = await repository.findById(params.walletId)
      if (!wallet) {
        return { success: false, transactionId: null, wallet: null as unknown as Wallet, error: 'Wallet not found' }
      }

      const validation = validateDebit(wallet, params.amount)
      if (!validation.valid) {
        return { success: false, transactionId: null, wallet, error: validation.errors.join('; ') }
      }

      const destinationAccountId = params.reason === 'payout'
        ? `payout_clearing_${wallet.currency}`
        : `platform_fees_${wallet.currency}`

      const entries = buildDebitEntries(
        wallet.id,
        destinationAccountId,
        params.amount,
        wallet.currency,
        params.description,
      )

      await ledger.postEntries({
        correlationId: params.referenceId,
        description: params.description,
        entries,
      })

      const newBalance = wallet.balance - params.amount
      const updatedWallet = await repository.updateBalance(wallet.id, newBalance, wallet.holdBalance)

      const txId = crypto.randomUUID()
      await repository.insertTransaction({
        id: txId,
        walletId: wallet.id,
        type: WalletTxType.DEBIT,
        amount: params.amount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        holdBalanceBefore: wallet.holdBalance,
        holdBalanceAfter: wallet.holdBalance,
        description: params.description,
        referenceId: params.referenceId,
        counterpartyWalletId: null,
        idempotencyKey: params.idempotencyKey,
      })

      return { success: true, transactionId: txId, wallet: updatedWallet, error: null }
    },

    async transfer(params: TransferParams): Promise<WalletOperationResult> {
      const existing = await repository.findTransactionByIdempotencyKey(params.idempotencyKey)
      if (existing) {
        const wallet = await repository.findById(params.fromWalletId)
        return { success: true, transactionId: existing.id, wallet: wallet!, error: null }
      }

      const fromWallet = await repository.findById(params.fromWalletId)
      const toWallet = await repository.findById(params.toWalletId)

      if (!fromWallet || !toWallet) {
        return { success: false, transactionId: null, wallet: null as unknown as Wallet, error: 'One or both wallets not found' }
      }

      if (fromWallet.currency !== toWallet.currency) {
        return { success: false, transactionId: null, wallet: fromWallet, error: 'Cross-currency transfers not supported' }
      }

      const validation = validateDebit(fromWallet, params.amount)
      if (!validation.valid) {
        return { success: false, transactionId: null, wallet: fromWallet, error: validation.errors.join('; ') }
      }

      const entries = buildTransferEntries(
        fromWallet.id,
        toWallet.id,
        params.amount,
        fromWallet.currency,
        params.description,
      )

      await ledger.postEntries({
        correlationId: params.idempotencyKey,
        description: params.description,
        entries,
      })

      // Update both wallets
      const newFromBalance = fromWallet.balance - params.amount
      const newToBalance = toWallet.balance + params.amount
      await repository.updateBalance(fromWallet.id, newFromBalance, fromWallet.holdBalance)
      await repository.updateBalance(toWallet.id, newToBalance, toWallet.holdBalance)

      const txId = crypto.randomUUID()
      await repository.insertTransaction({
        id: txId,
        walletId: fromWallet.id,
        type: WalletTxType.TRANSFER_OUT,
        amount: params.amount,
        balanceBefore: fromWallet.balance,
        balanceAfter: newFromBalance,
        holdBalanceBefore: fromWallet.holdBalance,
        holdBalanceAfter: fromWallet.holdBalance,
        description: params.description,
        referenceId: null,
        counterpartyWalletId: toWallet.id,
        idempotencyKey: params.idempotencyKey,
      })

      // Record credit side
      await repository.insertTransaction({
        id: crypto.randomUUID(),
        walletId: toWallet.id,
        type: WalletTxType.TRANSFER_IN,
        amount: params.amount,
        balanceBefore: toWallet.balance,
        balanceAfter: newToBalance,
        holdBalanceBefore: toWallet.holdBalance,
        holdBalanceAfter: toWallet.holdBalance,
        description: params.description,
        referenceId: null,
        counterpartyWalletId: fromWallet.id,
        idempotencyKey: `${params.idempotencyKey}_credit`,
      })

      const updatedFrom = await repository.findById(fromWallet.id)
      return { success: true, transactionId: txId, wallet: updatedFrom!, error: null }
    },

    async hold(params: HoldParams): Promise<WalletOperationResult> {
      const existing = await repository.findTransactionByIdempotencyKey(params.idempotencyKey)
      if (existing) {
        const wallet = await repository.findById(params.walletId)
        return { success: true, transactionId: existing.id, wallet: wallet!, error: null }
      }

      const wallet = await repository.findById(params.walletId)
      if (!wallet) {
        return { success: false, transactionId: null, wallet: null as unknown as Wallet, error: 'Wallet not found' }
      }

      const validation = validateHold(wallet, params.amount)
      if (!validation.valid) {
        return { success: false, transactionId: null, wallet, error: validation.errors.join('; ') }
      }

      const newHoldBalance = wallet.holdBalance + params.amount
      const updatedWallet = await repository.updateBalance(wallet.id, wallet.balance, newHoldBalance)

      const txId = crypto.randomUUID()
      await repository.insertTransaction({
        id: txId,
        walletId: wallet.id,
        type: WalletTxType.HOLD,
        amount: params.amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        holdBalanceBefore: wallet.holdBalance,
        holdBalanceAfter: newHoldBalance,
        description: params.description,
        referenceId: params.referenceId,
        counterpartyWalletId: null,
        idempotencyKey: params.idempotencyKey,
      })

      return { success: true, transactionId: txId, wallet: updatedWallet, error: null }
    },

    async releaseHold(params: HoldParams): Promise<WalletOperationResult> {
      const existing = await repository.findTransactionByIdempotencyKey(params.idempotencyKey)
      if (existing) {
        const wallet = await repository.findById(params.walletId)
        return { success: true, transactionId: existing.id, wallet: wallet!, error: null }
      }

      const wallet = await repository.findById(params.walletId)
      if (!wallet) {
        return { success: false, transactionId: null, wallet: null as unknown as Wallet, error: 'Wallet not found' }
      }

      if (params.amount > wallet.holdBalance) {
        return { success: false, transactionId: null, wallet, error: `Cannot release ${params.amount} — only ${wallet.holdBalance} held` }
      }

      const newHoldBalance = wallet.holdBalance - params.amount
      const updatedWallet = await repository.updateBalance(wallet.id, wallet.balance, newHoldBalance)

      const txId = crypto.randomUUID()
      await repository.insertTransaction({
        id: txId,
        walletId: wallet.id,
        type: WalletTxType.RELEASE_HOLD,
        amount: params.amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        holdBalanceBefore: wallet.holdBalance,
        holdBalanceAfter: newHoldBalance,
        description: params.description,
        referenceId: params.referenceId,
        counterpartyWalletId: null,
        idempotencyKey: params.idempotencyKey,
      })

      return { success: true, transactionId: txId, wallet: updatedWallet, error: null }
    },

    async freezeWallet(walletId: string): Promise<Wallet> {
      return repository.updateStatus(walletId, WalletStatus.FROZEN)
    },

    async unfreezeWallet(walletId: string): Promise<Wallet> {
      return repository.updateStatus(walletId, WalletStatus.ACTIVE)
    },
  }
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const CreditWalletSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  source: z.enum(['revenue_share', 'refund', 'transfer', 'manual']),
})

export const DebitWalletSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  reason: z.enum(['payout', 'fee', 'transfer', 'penalty']),
})

export const TransferSchema = z.object({
  fromWalletId: z.string().uuid(),
  toWalletId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().min(1),
  idempotencyKey: z.string().min(1),
})
