/**
 * ShopMoiCa — Customer Communication Templates
 *
 * Structured templates for all customer-facing communications.
 * Each template returns subject + body (plain text) for emails,
 * SMS, or notification content.
 *
 * Template data is validated via Zod to ensure no variable
 * placeholders are left unresolved.
 */
import { z } from 'zod'
import { SHOPMOICA_BRANDING } from '@nzila/platform-commerce-org/defaults'

// ── Template Types ─────────────────────────────────────────────────────────

export type TemplateName =
  | 'quote_sent'
  | 'revision_requested_ack'
  | 'deposit_request'
  | 'payment_received_confirmation'
  | 'order_in_production'
  | 'shipped_notice'

export interface RenderedTemplate {
  subject: string
  body: string
  templateName: TemplateName
}

// ── Template Data Schemas ──────────────────────────────────────────────────

const QuoteSentData = z.object({
  customerName: z.string().min(1),
  quoteRef: z.string().min(1),
  quoteTitle: z.string().min(1),
  totalFormatted: z.string().min(1),
  validUntil: z.string().min(1),
  portalUrl: z.string().url(),
  companyName: z.string().default(SHOPMOICA_BRANDING.companyName),
})

const RevisionRequestedAckData = z.object({
  customerName: z.string().min(1),
  quoteRef: z.string().min(1),
  revisionMessage: z.string().min(1),
  companyName: z.string().default(SHOPMOICA_BRANDING.companyName),
})

const DepositRequestData = z.object({
  customerName: z.string().min(1),
  quoteRef: z.string().min(1),
  depositAmount: z.string().min(1),
  totalFormatted: z.string().min(1),
  depositPercent: z.number().min(0).max(100),
  paymentInstructions: z.string().default('Please reply to this email with your preferred payment method.'),
  companyName: z.string().default(SHOPMOICA_BRANDING.companyName),
})

const PaymentReceivedData = z.object({
  customerName: z.string().min(1),
  quoteRef: z.string().min(1),
  amountReceived: z.string().min(1),
  remainingBalance: z.string().min(1),
  companyName: z.string().default(SHOPMOICA_BRANDING.companyName),
})

const OrderInProductionData = z.object({
  customerName: z.string().min(1),
  quoteRef: z.string().min(1),
  orderRef: z.string().min(1),
  estimatedCompletion: z.string().optional(),
  companyName: z.string().default(SHOPMOICA_BRANDING.companyName),
})

const ShippedNoticeData = z.object({
  customerName: z.string().min(1),
  quoteRef: z.string().min(1),
  orderRef: z.string().min(1),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  companyName: z.string().default(SHOPMOICA_BRANDING.companyName),
})

// ── Template Renderers ─────────────────────────────────────────────────────

function renderQuoteSent(data: z.infer<typeof QuoteSentData>): RenderedTemplate {
  return {
    templateName: 'quote_sent',
    subject: `Your quote ${data.quoteRef} from ${data.companyName}`,
    body: [
      `Dear ${data.customerName},`,
      '',
      `Thank you for your interest. We have prepared a quote for you:`,
      '',
      `  Reference: ${data.quoteRef}`,
      `  Description: ${data.quoteTitle}`,
      `  Total: ${data.totalFormatted} (taxes included)`,
      `  Valid until: ${data.validUntil}`,
      '',
      `You can review and approve the quote here:`,
      data.portalUrl,
      '',
      `If you have any questions, please don't hesitate to reach out.`,
      '',
      `Best regards,`,
      `${data.companyName} Team`,
    ].join('\n'),
  }
}

function renderRevisionRequestedAck(
  data: z.infer<typeof RevisionRequestedAckData>,
): RenderedTemplate {
  return {
    templateName: 'revision_requested_ack',
    subject: `Re: Quote ${data.quoteRef} — revision acknowledged`,
    body: [
      `Dear ${data.customerName},`,
      '',
      `We received your revision request for quote ${data.quoteRef}:`,
      '',
      `  "${data.revisionMessage}"`,
      '',
      `Our team will review your feedback and send an updated quote shortly.`,
      '',
      `Best regards,`,
      `${data.companyName} Team`,
    ].join('\n'),
  }
}

function renderDepositRequest(data: z.infer<typeof DepositRequestData>): RenderedTemplate {
  return {
    templateName: 'deposit_request',
    subject: `Deposit required for quote ${data.quoteRef}`,
    body: [
      `Dear ${data.customerName},`,
      '',
      `Thank you for approving quote ${data.quoteRef}.`,
      '',
      `To proceed with your order, a deposit is required:`,
      '',
      `  Quote total: ${data.totalFormatted}`,
      `  Deposit: ${data.depositAmount} (${data.depositPercent}%)`,
      '',
      data.paymentInstructions,
      '',
      `Once the deposit is received, we will begin processing your order.`,
      '',
      `Best regards,`,
      `${data.companyName} Team`,
    ].join('\n'),
  }
}

function renderPaymentReceived(data: z.infer<typeof PaymentReceivedData>): RenderedTemplate {
  return {
    templateName: 'payment_received_confirmation',
    subject: `Payment received for quote ${data.quoteRef}`,
    body: [
      `Dear ${data.customerName},`,
      '',
      `We have received your payment for quote ${data.quoteRef}:`,
      '',
      `  Amount received: ${data.amountReceived}`,
      `  Remaining balance: ${data.remainingBalance}`,
      '',
      `Your order will now be processed. We will notify you when production begins.`,
      '',
      `Best regards,`,
      `${data.companyName} Team`,
    ].join('\n'),
  }
}

function renderOrderInProduction(
  data: z.infer<typeof OrderInProductionData>,
): RenderedTemplate {
  const estimateLine = data.estimatedCompletion
    ? `  Estimated completion: ${data.estimatedCompletion}`
    : ''

  return {
    templateName: 'order_in_production',
    subject: `Your order ${data.orderRef} is in production`,
    body: [
      `Dear ${data.customerName},`,
      '',
      `Great news! Your order (${data.orderRef}, from quote ${data.quoteRef}) is now in production.`,
      estimateLine,
      '',
      `We will notify you when your order ships.`,
      '',
      `Best regards,`,
      `${data.companyName} Team`,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

function renderShippedNotice(data: z.infer<typeof ShippedNoticeData>): RenderedTemplate {
  const trackingLines: string[] = []
  if (data.carrier) trackingLines.push(`  Carrier: ${data.carrier}`)
  if (data.trackingNumber) trackingLines.push(`  Tracking #: ${data.trackingNumber}`)
  if (data.estimatedDelivery) trackingLines.push(`  Estimated delivery: ${data.estimatedDelivery}`)

  return {
    templateName: 'shipped_notice',
    subject: `Your order ${data.orderRef} has shipped!`,
    body: [
      `Dear ${data.customerName},`,
      '',
      `Your order ${data.orderRef} (quote ${data.quoteRef}) has been shipped!`,
      '',
      ...(trackingLines.length ? ['Shipping details:', ...trackingLines, ''] : []),
      `If you have any questions about your delivery, please don't hesitate to contact us.`,
      '',
      `Best regards,`,
      `${data.companyName} Team`,
    ].join('\n'),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

const TEMPLATE_CONFIG = {
  quote_sent: { schema: QuoteSentData, render: renderQuoteSent },
  revision_requested_ack: { schema: RevisionRequestedAckData, render: renderRevisionRequestedAck },
  deposit_request: { schema: DepositRequestData, render: renderDepositRequest },
  payment_received_confirmation: { schema: PaymentReceivedData, render: renderPaymentReceived },
  order_in_production: { schema: OrderInProductionData, render: renderOrderInProduction },
  shipped_notice: { schema: ShippedNoticeData, render: renderShippedNotice },
} as const

/**
 * Render a customer communication template.
 *
 * @throws ZodError if data is invalid
 */
export function renderTemplate(
  templateName: TemplateName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): RenderedTemplate {
  const config = TEMPLATE_CONFIG[templateName]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = (config.schema as any).parse(data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (config.render as any)(parsed)
}

/**
 * List all available template names.
 */
export function getAvailableTemplates(): TemplateName[] {
  return Object.keys(TEMPLATE_CONFIG) as TemplateName[]
}
