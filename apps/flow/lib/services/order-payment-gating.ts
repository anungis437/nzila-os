/**
 * Flow compatibility surface for payment gating.
 *
 * The canonical pure payment gating logic now lives in @nzila/flow-engine.
 * Flow keeps this file so existing imports remain stable while the guard layer
 * continues to adapt repository-backed order context inside the app.
 */
export {
  canGeneratePO,
  canShipOrder,
  canStartProduction,
  explainBlock,
  getPaymentGateState,
  outstandingBalance,
  requiresDeposit,
} from '@nzila/flow-engine'

export type {
  DepositRequirement,
  FlowPaymentGateOrder as PaymentGateOrder,
  PaymentGateResult,
  PaymentGateType,
} from '@nzila/flow-engine'
