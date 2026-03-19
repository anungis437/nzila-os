/**
 * Flow — Payment Guard
 *
 * Single source of truth for all payment-gated operations.
 * Wraps the pure order-payment-gating functions with DB context.
 */
import type { PaymentGateCheckResult } from '@/lib/control/types'
import { orderRepo, paymentRepo } from '@/lib/repositories'
import { paymentRequirementRepo } from '@/lib/repositories/workflow-repository'
import {
  canGeneratePO,
  canStartProduction,
  canShipOrder,
  type DepositRequirement,
} from '@/lib/services/order-payment-gating'
import type { Order } from '@/domain/entities'
import { logger } from '@/lib/logger'

const DEFAULT_DEPOSIT: DepositRequirement = {
  required: false,
  percent: null,
  amount: null,
  due_before_production: false,
}

async function loadPaymentContext(orderId: string, orgId: string) {
  const dbOrder = await orderRepo.findById(orderId, orgId)
  if (!dbOrder) return null

  const totalPaid = await paymentRepo.totalPaidForOrder(orderId)

  // Map Drizzle camelCase/lowercase to domain snake_case/UPPERCASE shape
  const order: Pick<Order, 'id' | 'total_amount' | 'payment_status' | 'status' | 'quote_id'> = {
    id: dbOrder.id,
    total_amount: Number(dbOrder.total ?? 0),
    payment_status: (dbOrder.paymentStatus ?? 'PENDING_DEPOSIT') as Order['payment_status'],
    status: (dbOrder.status?.toUpperCase() ?? 'CREATED') as Order['status'],
    quote_id: dbOrder.quoteId ?? null,
  }

  // Look up deposit requirement — if order has quote_id, check quote-level requirement
  let depositRule: DepositRequirement = DEFAULT_DEPOSIT
  if (order.quote_id) {
    const req = await paymentRequirementRepo.findByQuoteId(order.quote_id)
    if (req) {
      depositRule = {
        required: req.depositRequired,
        percent: req.depositPercent ?? null,
        amount: req.depositAmount ?? null,
        due_before_production: req.dueBeforeProduction,
      }
    }
  }

  return { order, totalPaid, depositRule }
}

function toGateCheckResult(
  gate: ReturnType<typeof canGeneratePO>,
  paymentStatus: string,
  amountDue: number,
  amountPaid: number,
  depositRule: DepositRequirement,
): PaymentGateCheckResult {
  return {
    allowed: gate.allowed,
    gate_state: gate.allowed ? 'clear' : 'blocked',
    reasons: gate.blockers,
    required_actions: gate.allowed ? [] : gate.blockers.map(b => `Resolve: ${b}`),
    snapshot: {
      payment_status: paymentStatus,
      amount_due: amountDue,
      amount_paid: amountPaid,
      deposit_required: depositRule.required,
      due_before_production: depositRule.due_before_production,
    },
  }
}

export async function checkCanGeneratePO(
  orderId: string,
  orgId: string,
): Promise<PaymentGateCheckResult> {
  const ctx = await loadPaymentContext(orderId, orgId)
  if (!ctx) {
    return {
      allowed: false,
      gate_state: 'blocked',
      reasons: [`Order "${orderId}" not found`],
      required_actions: ['Provide valid order ID'],
      snapshot: { payment_status: 'unknown', amount_due: 0, amount_paid: 0, deposit_required: false, due_before_production: false },
    }
  }

  const gate = canGeneratePO(ctx.order, ctx.totalPaid, ctx.depositRule)
  logger.info('Payment guard: canGeneratePO', { orderId, allowed: gate.allowed })

  return toGateCheckResult(
    gate,
    ctx.order.payment_status,
    ctx.order.total_amount,
    ctx.totalPaid,
    ctx.depositRule,
  )
}

export async function checkCanStartProduction(
  orderId: string,
  orgId: string,
): Promise<PaymentGateCheckResult> {
  const ctx = await loadPaymentContext(orderId, orgId)
  if (!ctx) {
    return {
      allowed: false,
      gate_state: 'blocked',
      reasons: [`Order "${orderId}" not found`],
      required_actions: ['Provide valid order ID'],
      snapshot: { payment_status: 'unknown', amount_due: 0, amount_paid: 0, deposit_required: false, due_before_production: false },
    }
  }

  const gate = canStartProduction(ctx.order, ctx.totalPaid, ctx.depositRule)
  logger.info('Payment guard: canStartProduction', { orderId, allowed: gate.allowed })

  return toGateCheckResult(
    gate,
    ctx.order.payment_status,
    ctx.order.total_amount,
    ctx.totalPaid,
    ctx.depositRule,
  )
}

export async function checkCanShipOrder(
  orderId: string,
  orgId: string,
): Promise<PaymentGateCheckResult> {
  const ctx = await loadPaymentContext(orderId, orgId)
  if (!ctx) {
    return {
      allowed: false,
      gate_state: 'blocked',
      reasons: [`Order "${orderId}" not found`],
      required_actions: ['Provide valid order ID'],
      snapshot: { payment_status: 'unknown', amount_due: 0, amount_paid: 0, deposit_required: false, due_before_production: false },
    }
  }

  const gate = canShipOrder(ctx.order, ctx.totalPaid)
  logger.info('Payment guard: canShipOrder', { orderId, allowed: gate.allowed })

  return toGateCheckResult(
    gate,
    ctx.order.payment_status,
    ctx.order.total_amount,
    ctx.totalPaid,
    ctx.depositRule,
  )
}

export async function explainPaymentBlock(
  orderId: string,
  orgId: string,
): Promise<{ blocked: boolean; explanation: string[] }> {
  const ctx = await loadPaymentContext(orderId, orgId)
  if (!ctx) {
    return { blocked: true, explanation: [`Order "${orderId}" not found`] }
  }

  const poGate = canGeneratePO(ctx.order, ctx.totalPaid, ctx.depositRule)
  const prodGate = canStartProduction(ctx.order, ctx.totalPaid, ctx.depositRule)
  const shipGate = canShipOrder(ctx.order, ctx.totalPaid)

  const allBlockers = [
    ...poGate.blockers.map(b => `[PO] ${b}`),
    ...prodGate.blockers.map(b => `[Production] ${b}`),
    ...shipGate.blockers.map(b => `[Shipment] ${b}`),
  ]

  return {
    blocked: allBlockers.length > 0,
    explanation: allBlockers.length > 0 ? allBlockers : ['No payment blocks — all gates clear'],
  }
}
