/**
 * Flow — Handler Registry
 *
 * Registers all 17 command handlers with the command bus.
 * Import this module once at app startup to activate the control layer.
 */
import { registerHandler } from './command-bus'

// Quote handlers
import { createQuoteHandler } from './handlers/create-quote.handler'
import { sendQuoteHandler } from './handlers/send-quote.handler'
import { acceptQuoteHandler } from './handlers/accept-quote.handler'
import { requestQuoteRevisionHandler } from './handlers/request-quote-revision.handler'
import { convertQuoteToOrderHandler } from './handlers/convert-quote-to-order.handler'

// Order handlers
import { confirmOrderHandler } from './handlers/confirm-order.handler'
import { startFulfillmentHandler } from './handlers/start-fulfillment.handler'
import { completeOrderHandler } from './handlers/complete-order.handler'
import { cancelOrderHandler } from './handlers/cancel-order.handler'
import { requireDepositHandler } from './handlers/require-deposit.handler'

// Payment handlers
import { recordPaymentHandler } from './handlers/record-payment.handler'
import { confirmPaymentHandler } from './handlers/confirm-payment.handler'

// Purchase order handlers
import { createPurchaseOrderHandler } from './handlers/create-purchase-order.handler'
import { sendPurchaseOrderHandler } from './handlers/send-purchase-order.handler'
import { confirmPurchaseOrderHandler } from './handlers/confirm-purchase-order.handler'

// Production handlers
import { startProductionHandler } from './handlers/start-production.handler'
import { completeProductionHandler } from './handlers/complete-production.handler'

// Shipment handlers
import { createShipmentHandler } from './handlers/create-shipment.handler'
import { markShipmentShippedHandler } from './handlers/mark-shipment-shipped.handler'
import { markShipmentDeliveredHandler } from './handlers/mark-shipment-delivered.handler'

// Review handler
import { submitForReviewHandler } from './handlers/submit-for-review.handler'

// Invoice handlers
import { createInvoiceHandler } from './handlers/create-invoice.handler'
import { issueInvoiceHandler } from './handlers/issue-invoice.handler'
import { voidInvoiceHandler } from './handlers/void-invoice.handler'

// Workflow trigger handlers
import { triggerSalesToProcurementHandler } from './handlers/trigger-sales-to-procurement.handler'

// ── Registration ───────────────────────────────────────────────────────────

const handlers = [
  createQuoteHandler,
  sendQuoteHandler,
  acceptQuoteHandler,
  requestQuoteRevisionHandler,
  convertQuoteToOrderHandler,
  confirmOrderHandler,
  startFulfillmentHandler,
  completeOrderHandler,
  cancelOrderHandler,
  requireDepositHandler,
  recordPaymentHandler,
  confirmPaymentHandler,
  createPurchaseOrderHandler,
  sendPurchaseOrderHandler,
  confirmPurchaseOrderHandler,
  startProductionHandler,
  completeProductionHandler,
  createShipmentHandler,
  markShipmentShippedHandler,
  markShipmentDeliveredHandler,
  submitForReviewHandler,
  createInvoiceHandler,
  issueInvoiceHandler,
  voidInvoiceHandler,
  triggerSalesToProcurementHandler,
]

for (const handler of handlers) {
  registerHandler(handler as never)
}

export { handlers }
