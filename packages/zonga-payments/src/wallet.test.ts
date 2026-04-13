import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildCreditEntries,
  buildDebitEntries,
  buildTransferEntries,
  validateDebit,
  validateHold,
  validateCredit,
  createWalletService,
  WalletStatus,
  WalletTxType,
  type Wallet,
  type WalletRepository,
  type LedgerPort,
} from './wallet'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeWallet(overrides?: Partial<Wallet>): Wallet {
  return {
    id: 'wallet-1',
    orgId: 'org-1',
    ownerId: 'owner-1',
    ownerType: 'creator',
    currency: 'USD',
    balance: 10000,
    holdBalance: 0,
    status: WalletStatus.ACTIVE,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function makeMockRepo(): WalletRepository {
  const wallet = makeWallet()
  return {
    findById: vi.fn().mockResolvedValue(wallet),
    findByOwner: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (w) => ({
      ...w,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    updateBalance: vi.fn().mockImplementation(async (id, balance, holdBalance) => ({
      ...wallet,
      id,
      balance,
      holdBalance,
      updatedAt: new Date(),
    })),
    updateStatus: vi.fn().mockImplementation(async (id, status) => ({
      ...wallet,
      id,
      status,
      updatedAt: new Date(),
    })),
    insertTransaction: vi.fn().mockImplementation(async (tx) => ({
      ...tx,
      createdAt: new Date(),
    })),
    findTransactionByIdempotencyKey: vi.fn().mockResolvedValue(null),
  }
}

function makeMockLedger(): LedgerPort {
  return {
    postEntries: vi.fn().mockResolvedValue({ transactionId: 'ledger-tx-1' }),
  }
}

// ── Ledger Entry Builders ───────────────────────────────────────────────────

describe('buildCreditEntries', () => {
  it('produces two balanced entries (debit source, credit wallet)', () => {
    const entries = buildCreditEntries('w1', 'revenue-acct', 5000, 'USD', 'Payment')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.accountId).toBe('revenue-acct')
    expect(entries[0]!.direction).toBe('debit')
    expect(entries[0]!.amount).toBe(5000)
    expect(entries[1]!.accountId).toBe('w1')
    expect(entries[1]!.direction).toBe('credit')
    expect(entries[1]!.amount).toBe(5000)
  })

  it('includes currency and description in each entry', () => {
    const entries = buildCreditEntries('w1', 'rev', 100, 'KES', 'tip')
    for (const e of entries) {
      expect(e.currency).toBe('KES')
      expect(e.description).toContain('tip')
    }
  })
})

describe('buildDebitEntries', () => {
  it('produces two balanced entries (debit wallet, credit destination)', () => {
    const entries = buildDebitEntries('w1', 'payout-acct', 3000, 'KES', 'Payout')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.accountId).toBe('w1')
    expect(entries[0]!.direction).toBe('debit')
    expect(entries[1]!.accountId).toBe('payout-acct')
    expect(entries[1]!.direction).toBe('credit')
  })
})

describe('buildTransferEntries', () => {
  it('produces two balanced entries for wallet-to-wallet transfer', () => {
    const entries = buildTransferEntries('from-w', 'to-w', 2000, 'USD', 'Transfer')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.accountId).toBe('from-w')
    expect(entries[0]!.direction).toBe('debit')
    expect(entries[1]!.accountId).toBe('to-w')
    expect(entries[1]!.direction).toBe('credit')
  })
})

// ── Wallet Validation ───────────────────────────────────────────────────────

describe('validateDebit', () => {
  it('allows debit within available balance', () => {
    const wallet = makeWallet({ balance: 10000, holdBalance: 2000 })
    const result = validateDebit(wallet, 5000)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects debit exceeding available balance (balance - hold)', () => {
    const wallet = makeWallet({ balance: 10000, holdBalance: 8000 })
    const result = validateDebit(wallet, 5000)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Insufficient available balance')
  })

  it('rejects debit on frozen wallet', () => {
    const wallet = makeWallet({ status: WalletStatus.FROZEN })
    const result = validateDebit(wallet, 100)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('frozen')
  })

  it('rejects debit on closed wallet', () => {
    const wallet = makeWallet({ status: WalletStatus.CLOSED })
    const result = validateDebit(wallet, 100)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('closed')
  })

  it('rejects zero amount', () => {
    const wallet = makeWallet()
    const result = validateDebit(wallet, 0)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Debit amount must be positive')
  })

  it('rejects negative amount', () => {
    const wallet = makeWallet()
    const result = validateDebit(wallet, -100)
    expect(result.valid).toBe(false)
  })

  it('collects multiple errors at once', () => {
    const wallet = makeWallet({ status: WalletStatus.FROZEN, balance: 0 })
    const result = validateDebit(wallet, 5000)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('validateHold', () => {
  it('allows hold within available balance', () => {
    const wallet = makeWallet({ balance: 10000, holdBalance: 0 })
    expect(validateHold(wallet, 5000).valid).toBe(true)
  })

  it('rejects hold exceeding available balance', () => {
    const wallet = makeWallet({ balance: 10000, holdBalance: 7000 })
    const result = validateHold(wallet, 5000)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Insufficient')
  })

  it('rejects hold on frozen wallet', () => {
    const wallet = makeWallet({ status: WalletStatus.FROZEN })
    expect(validateHold(wallet, 100).valid).toBe(false)
  })

  it('rejects zero amount', () => {
    const wallet = makeWallet()
    expect(validateHold(wallet, 0).valid).toBe(false)
  })
})

describe('validateCredit', () => {
  it('allows credit on active wallet', () => {
    const wallet = makeWallet()
    expect(validateCredit(wallet, 100).valid).toBe(true)
  })

  it('allows credit on frozen wallet (not closed)', () => {
    const wallet = makeWallet({ status: WalletStatus.FROZEN })
    expect(validateCredit(wallet, 100).valid).toBe(true)
  })

  it('rejects credit on closed wallet', () => {
    const wallet = makeWallet({ status: WalletStatus.CLOSED })
    const result = validateCredit(wallet, 100)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('closed')
  })

  it('rejects zero amount', () => {
    const wallet = makeWallet()
    expect(validateCredit(wallet, 0).valid).toBe(false)
  })

  it('rejects negative amount', () => {
    const wallet = makeWallet()
    expect(validateCredit(wallet, -50).valid).toBe(false)
  })
})

// ── Wallet Service ──────────────────────────────────────────────────────────

describe('createWalletService', () => {
  let repo: ReturnType<typeof makeMockRepo>
  let ledgerPort: ReturnType<typeof makeMockLedger>
  let service: ReturnType<typeof createWalletService>

  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('mock-uuid') })
    repo = makeMockRepo()
    ledgerPort = makeMockLedger()
    service = createWalletService({ repository: repo, ledger: ledgerPort })
  })

  describe('getWallet', () => {
    it('returns wallet when found', async () => {
      const wallet = await service.getWallet('wallet-1')
      expect(wallet).not.toBeNull()
      expect(repo.findById).toHaveBeenCalledWith('wallet-1')
    })

    it('returns null when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null)
      expect(await service.getWallet('missing')).toBeNull()
    })
  })

  describe('getOrCreateWallet', () => {
    it('returns existing wallet if found', async () => {
      const existing = makeWallet()
      vi.mocked(repo.findByOwner).mockResolvedValueOnce(existing)

      const result = await service.getOrCreateWallet({
        orgId: 'org-1',
        ownerId: 'owner-1',
        ownerType: 'creator',
        currency: 'USD',
      })
      expect(result).toBe(existing)
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('creates wallet if not found', async () => {
      const result = await service.getOrCreateWallet({
        orgId: 'org-1',
        ownerId: 'owner-1',
        ownerType: 'creator',
        currency: 'USD',
      })
      expect(repo.create).toHaveBeenCalled()
      expect(result.ownerId).toBe('owner-1')
    })
  })

  describe('credit', () => {
    it('credits wallet and posts to ledger', async () => {
      const result = await service.credit({
        walletId: 'wallet-1',
        amount: 5000,
        description: 'Revenue share',
        referenceId: 'ref-1',
        idempotencyKey: 'idem-1',
        source: 'revenue_share',
      })
      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('mock-uuid')
      expect(ledgerPort.postEntries).toHaveBeenCalledOnce()
      expect(repo.updateBalance).toHaveBeenCalledWith('wallet-1', 15000, 0)
      expect(repo.insertTransaction).toHaveBeenCalledOnce()
    })

    it('returns existing transaction for duplicate idempotency key', async () => {
      vi.mocked(repo.findTransactionByIdempotencyKey).mockResolvedValueOnce({
        id: 'existing-tx',
        walletId: 'wallet-1',
        type: WalletTxType.CREDIT,
        amount: 5000,
        balanceBefore: 10000,
        balanceAfter: 15000,
        holdBalanceBefore: 0,
        holdBalanceAfter: 0,
        description: 'dup',
        referenceId: null,
        counterpartyWalletId: null,
        idempotencyKey: 'idem-1',
        createdAt: new Date(),
      })

      const result = await service.credit({
        walletId: 'wallet-1',
        amount: 5000,
        description: 'Revenue share',
        referenceId: 'ref-1',
        idempotencyKey: 'idem-1',
        source: 'revenue_share',
      })
      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('existing-tx')
      expect(ledgerPort.postEntries).not.toHaveBeenCalled()
    })

    it('fails for non-existent wallet', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(null)
      const result = await service.credit({
        walletId: 'missing',
        amount: 100,
        description: 'test',
        referenceId: 'ref',
        idempotencyKey: 'k1',
        source: 'manual',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Wallet not found')
    })

    it('fails for closed wallet', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(makeWallet({ status: WalletStatus.CLOSED }))
      const result = await service.credit({
        walletId: 'wallet-1',
        amount: 100,
        description: 'test',
        referenceId: 'ref',
        idempotencyKey: 'k2',
        source: 'manual',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('closed')
    })
  })

  describe('debit', () => {
    it('debits wallet and posts to ledger', async () => {
      const result = await service.debit({
        walletId: 'wallet-1',
        amount: 3000,
        description: 'Payout',
        referenceId: 'ref-1',
        idempotencyKey: 'idem-d1',
        reason: 'payout',
      })
      expect(result.success).toBe(true)
      expect(ledgerPort.postEntries).toHaveBeenCalledOnce()
      expect(repo.updateBalance).toHaveBeenCalledWith('wallet-1', 7000, 0)
    })

    it('fails for insufficient balance', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(makeWallet({ balance: 100 }))
      const result = await service.debit({
        walletId: 'wallet-1',
        amount: 5000,
        description: 'Too much',
        referenceId: 'ref',
        idempotencyKey: 'k3',
        reason: 'payout',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient')
    })

    it('uses payout clearing account for payout reason', async () => {
      await service.debit({
        walletId: 'wallet-1',
        amount: 100,
        description: 'Payout test',
        referenceId: 'ref',
        idempotencyKey: 'k4',
        reason: 'payout',
      })
      const entries = vi.mocked(ledgerPort.postEntries).mock.calls[0]![0].entries
      expect(entries[1]!.accountId).toContain('payout_clearing')
    })

    it('uses platform fees account for fee reason', async () => {
      await service.debit({
        walletId: 'wallet-1',
        amount: 100,
        description: 'Fee test',
        referenceId: 'ref',
        idempotencyKey: 'k5',
        reason: 'fee',
      })
      const entries = vi.mocked(ledgerPort.postEntries).mock.calls[0]![0].entries
      expect(entries[1]!.accountId).toContain('platform_fees')
    })
  })

  describe('transfer', () => {
    it('transfers between two wallets', async () => {
      const fromW = makeWallet({ id: 'from-w', balance: 10000 })
      const toW = makeWallet({ id: 'to-w', balance: 5000 })
      vi.mocked(repo.findById)
        .mockResolvedValueOnce(null) // findTransactionByIdempotencyKey pass-through
        .mockResolvedValueOnce(fromW)
        .mockResolvedValueOnce(toW)
        .mockResolvedValueOnce({ ...fromW, balance: 7000 }) // final fetch

      vi.mocked(repo.findTransactionByIdempotencyKey).mockResolvedValueOnce(null)
      // findById calls in sequence: fromWallet, toWallet, final fetch

      // Reset to give proper sequence
      vi.mocked(repo.findById)
        .mockReset()
        .mockResolvedValueOnce(fromW)    // fromWallet
        .mockResolvedValueOnce(toW)      // toWallet
        .mockResolvedValueOnce({ ...fromW, balance: 7000 }) // final

      const result = await service.transfer({
        fromWalletId: 'from-w',
        toWalletId: 'to-w',
        amount: 3000,
        description: 'Transfer',
        idempotencyKey: 'txfr-1',
      })
      expect(result.success).toBe(true)
      expect(ledgerPort.postEntries).toHaveBeenCalledOnce()
      expect(repo.insertTransaction).toHaveBeenCalledTimes(2) // debit + credit
    })

    it('fails for cross-currency transfer', async () => {
      const fromW = makeWallet({ id: 'from-w', currency: 'USD' })
      const toW = makeWallet({ id: 'to-w', currency: 'KES' })
      vi.mocked(repo.findById)
        .mockReset()
        .mockResolvedValueOnce(fromW)
        .mockResolvedValueOnce(toW)

      const result = await service.transfer({
        fromWalletId: 'from-w',
        toWalletId: 'to-w',
        amount: 100,
        description: 'Cross currency',
        idempotencyKey: 'txfr-2',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Cross-currency')
    })

    it('fails if from wallet not found', async () => {
      vi.mocked(repo.findById)
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeWallet())

      const result = await service.transfer({
        fromWalletId: 'missing',
        toWalletId: 'w2',
        amount: 100,
        description: 'test',
        idempotencyKey: 'txfr-3',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('hold', () => {
    it('increases hold balance without changing main balance', async () => {
      const result = await service.hold({
        walletId: 'wallet-1',
        amount: 2000,
        description: 'Payout hold',
        referenceId: 'ref-1',
        idempotencyKey: 'hold-1',
      })
      expect(result.success).toBe(true)
      expect(repo.updateBalance).toHaveBeenCalledWith('wallet-1', 10000, 2000)
    })

    it('fails for insufficient available balance', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(makeWallet({ balance: 1000, holdBalance: 900 }))
      const result = await service.hold({
        walletId: 'wallet-1',
        amount: 500,
        description: 'test',
        referenceId: 'ref',
        idempotencyKey: 'hold-2',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('releaseHold', () => {
    it('decreases hold balance', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(makeWallet({ holdBalance: 5000 }))
      const result = await service.releaseHold({
        walletId: 'wallet-1',
        amount: 3000,
        description: 'Release',
        referenceId: 'ref-1',
        idempotencyKey: 'release-1',
      })
      expect(result.success).toBe(true)
      expect(repo.updateBalance).toHaveBeenCalledWith('wallet-1', 10000, 2000)
    })

    it('fails to release more than held', async () => {
      vi.mocked(repo.findById).mockResolvedValueOnce(makeWallet({ holdBalance: 1000 }))
      const result = await service.releaseHold({
        walletId: 'wallet-1',
        amount: 5000,
        description: 'Over-release',
        referenceId: 'ref',
        idempotencyKey: 'release-2',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('only')
    })
  })

  describe('freezeWallet / unfreezeWallet', () => {
    it('freezes wallet', async () => {
      await service.freezeWallet('wallet-1')
      expect(repo.updateStatus).toHaveBeenCalledWith('wallet-1', WalletStatus.FROZEN)
    })

    it('unfreezes wallet', async () => {
      await service.unfreezeWallet('wallet-1')
      expect(repo.updateStatus).toHaveBeenCalledWith('wallet-1', WalletStatus.ACTIVE)
    })
  })
})
