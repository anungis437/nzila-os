/**
 * @nzila/zonga-economics — Settlement Engine
 *
 * Batch payout processing and settlement.
 * Groups payout instructions by currency, validates, and generates batches.
 */
import type {
  PayoutInstruction,
  SettlementBatch,
  EconomicAccount,
  PayoutBatch,
  Currency,
} from './types'
import { PayoutInstructionStatus, SettlementBatchStatus } from './types'

export interface SettlementValidation {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly totalAmount: number
  readonly instructionCount: number
}

/**
 * Validate payout instructions before settlement.
 */
export function validateSettlement(
  instructions: readonly PayoutInstruction[],
  accounts: readonly EconomicAccount[],
): SettlementValidation {
  const errors: string[] = []

  if (instructions.length === 0) {
    return { valid: false, errors: ['No payout instructions'], totalAmount: 0, instructionCount: 0 }
  }

  const currencies = new Set(instructions.map((i) => i.currency))
  if (currencies.size > 1) {
    errors.push(`Settlement batch must be single-currency (found: ${[...currencies].join(', ')})`)
  }

  let totalAmount = 0

  for (const instruction of instructions) {
    if (instruction.status !== PayoutInstructionStatus.APPROVED) {
      errors.push(`Instruction ${instruction.id}: must be APPROVED (got ${instruction.status})`)
    }

    if (instruction.amount <= 0) {
      errors.push(`Instruction ${instruction.id}: amount must be positive`)
    }

    const account = accounts.find((a) => a.id === instruction.accountId)
    if (!account) {
      errors.push(`Instruction ${instruction.id}: account ${instruction.accountId} not found`)
    } else if (account.balance - account.holdBalance < instruction.amount) {
      errors.push(
        `Instruction ${instruction.id}: insufficient available balance (${account.balance - account.holdBalance} < ${instruction.amount})`,
      )
    }

    totalAmount += instruction.amount
  }

  return {
    valid: errors.length === 0,
    errors,
    totalAmount,
    instructionCount: instructions.length,
  }
}

/**
 * Generate payout batches grouped by currency.
 */
export function generatePayoutBatches(
  instructions: readonly PayoutInstruction[],
): readonly PayoutBatch[] {
  const byCurrency = new Map<Currency, PayoutInstruction[]>()

  for (const instruction of instructions) {
    if (instruction.status !== PayoutInstructionStatus.APPROVED) continue

    const existing = byCurrency.get(instruction.currency) ?? []
    existing.push(instruction)
    byCurrency.set(instruction.currency, existing)
  }

  const batches: PayoutBatch[] = []
  let batchIndex = 0

  for (const [currency, batchInstructions] of byCurrency) {
    const uniqueAccounts = new Set(batchInstructions.map((i) => i.accountId))
    batches.push({
      batchId: `batch_${Date.now()}_${batchIndex++}`,
      instructions: batchInstructions,
      totalAmount: batchInstructions.reduce((sum, i) => sum + i.amount, 0),
      currency,
      accountCount: uniqueAccounts.size,
    })
  }

  return batches
}

/**
 * Compute settlement summary for reporting.
 */
export function computeSettlementSummary(batch: SettlementBatch): {
  successRate: number
  failureRate: number
  isComplete: boolean
  pendingCount: number
} {
  const total = batch.instructionCount
  if (total === 0) {
    return { successRate: 0, failureRate: 0, isComplete: true, pendingCount: 0 }
  }

  const successRate = (batch.processedCount / total) * 100
  const failureRate = (batch.failedCount / total) * 100
  const pendingCount = total - batch.processedCount - batch.failedCount

  return {
    successRate: Math.round(successRate * 100) / 100,
    failureRate: Math.round(failureRate * 100) / 100,
    isComplete: pendingCount === 0,
    pendingCount,
  }
}
