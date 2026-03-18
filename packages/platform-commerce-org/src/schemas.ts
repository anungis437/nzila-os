/**
 * @nzila/platform-commerce-org — Zod schemas
 *
 * Validation schemas for all org-scoped commerce configuration objects.
 * Every schema validates input exhaustively. Defaults are provided for
 * backward-compatible migration of ShopMoiCa values.
 */
import { z } from 'zod'

// ── Tax configuration ───────────────────────────────────────────────────────

const TaxLineSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  rate: z.number().min(0).max(1),
  compounding: z.boolean().default(false),
})

export const OrgTaxConfigSchema = z.object({
  jurisdiction: z.string().min(1),
  taxes: z.array(TaxLineSchema).min(1),
})

// ── Email template ──────────────────────────────────────────────────────────

const EmailTemplateSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
})

// ── 2A — OrgCommerceSettings ────────────────────────────────────────────────

export const OrgCommerceSettingsSchema = z.object({
  orgId: z.string().uuid(),
  currency: z.string().length(3).default('CAD'),
  locale: z.string().default('en-CA'),
  quotePrefix: z.string().min(1).max(10).default('SQ'),
  invoicePrefix: z.string().min(1).max(10).default('INV'),
  poPrefix: z.string().min(1).max(10).default('PO'),
  orderPrefix: z.string().min(1).max(10).default('ORD'),
  quoteValidityDays: z.number().int().min(1).max(365).default(30),
  shareLinkExpiryDays: z.number().int().min(1).max(90).default(7),
  taxConfig: OrgTaxConfigSchema,
  defaultShippingPolicy: z.string().default('FOB Origin'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// ── 2B — OrgQuotePolicy ────────────────────────────────────────────────────

export const OrgQuotePolicySchema = z.object({
  orgId: z.string().uuid(),
  minMarginPercent: z.number().min(0).max(100).default(15),
  approvalRequiredBelowMargin: z.boolean().default(true),
  maxDiscountWithoutApproval: z.number().min(0).max(100).default(25),
  autoExpireQuotesAfterDays: z.number().int().min(0).default(30),
  allowManualPriceOverride: z.boolean().default(false),
  approvalThreshold: z.number().min(0).default(10_000),
  requireEvidenceForInvoice: z.boolean().default(true),
  marginFloors: z
    .object({
      budget: z.number().min(0).max(100).default(15),
      standard: z.number().min(0).max(100).default(25),
      premium: z.number().min(0).max(100).default(35),
    })
    .default({}),
})

// ── 2C — OrgPaymentPolicy ──────────────────────────────────────────────────

export const OrgPaymentPolicySchema = z.object({
  orgId: z.string().uuid(),
  depositRequired: z.boolean().default(true),
  defaultDepositPercent: z.number().min(0).max(100).default(30),
  depositRequiredBeforeProduction: z.boolean().default(true),
  allowPartialPayments: z.boolean().default(true),
  defaultPaymentTerms: z.string().default('Net 30'),
  defaultPaymentTermsDays: z.number().int().min(0).default(30),
  defaultLeadTimeDays: z.number().int().min(0).default(14),
  paymentInstructions: z
    .string()
    .default('Please reply to this email with your preferred payment method.'),
})

// ── 2D — OrgSupplierPolicy ─────────────────────────────────────────────────

export const OrgSupplierPolicySchema = z.object({
  orgId: z.string().uuid(),
  preferredSupplierIds: z.array(z.string().uuid()).default([]),
  supplierSelectionStrategy: z
    .enum(['LOWEST_COST', 'FASTEST', 'BALANCED', 'MANUAL'])
    .default('BALANCED'),
  qualityWeight: z.number().min(0).max(1).default(0.3),
  leadTimeWeight: z.number().min(0).max(1).default(0.3),
  costWeight: z.number().min(0).max(1).default(0.4),
})

// ── 2E — OrgCatalogPolicy ──────────────────────────────────────────────────

export const OrgCatalogPolicySchema = z.object({
  orgId: z.string().uuid(),
  enableInternalSkuMapping: z.boolean().default(false),
  defaultMarkupStrategy: z.enum(['FIXED_PERCENT', 'TIERED', 'MANUAL']).default('FIXED_PERCENT'),
  defaultFixedMarkupPercent: z.number().min(0).max(500).default(40),
  defaultDecorationRule: z.string().default('standard'),
  categoryMappings: z.record(z.string(), z.string()).default({}),
})

// ── 2F — OrgBrandingConfig ─────────────────────────────────────────────────

export const OrgBrandingConfigSchema = z.object({
  orgId: z.string().uuid(),
  companyName: z.string().min(1).default('ShopMoiCa.ca'),
  companyLegalName: z.string().default('Nzila Ventures SENC'),
  displayName: z.string().min(1).default('ShopMoiCa'),
  logoUrl: z.string().url().nullable().optional(),
  logoInitials: z.string().max(4).nullable().optional(),
  primaryColor: z.string().default('#7c3aed'),
  secondaryColor: z.string().default('#e5e7eb'),
  quoteFooterText: z.string().nullable().optional(),
  supportEmail: z.string().email().nullable().optional(),
  customerPortalLabel: z.string().default('Quote Portal'),
  address: z.string().default('Montréal, QC, Canada'),
  hashSalt: z.string().min(8).default('_shopmoica_salt'),
})

// ── 2G — OrgCommunicationTemplates ─────────────────────────────────────────

export const OrgCommunicationTemplatesSchema = z.object({
  orgId: z.string().uuid(),
  templates: z.object({
    quoteSent: EmailTemplateSchema.default({
      subject: 'Your quote {{ref}} from {{companyName}}',
      body: 'Dear {{customerName}},\n\nPlease find your quote {{ref}} attached.\n\nBest regards,\n{{companyName}}',
    }),
    revisionRequestAck: EmailTemplateSchema.default({
      subject: 'Re: Quote {{ref}} — revision acknowledged',
      body: 'Dear {{customerName}},\n\nWe have received your revision request for quote {{ref}}.\n\nBest regards,\n{{companyName}}',
    }),
    depositRequest: EmailTemplateSchema.default({
      subject: 'Deposit required for quote {{ref}}',
      body: 'Dear {{customerName}},\n\nA deposit is required to proceed with your order.\n\n{{paymentInstructions}}\n\nBest regards,\n{{companyName}}',
    }),
    paymentConfirmation: EmailTemplateSchema.default({
      subject: 'Payment received for quote {{ref}}',
      body: 'Dear {{customerName}},\n\nWe have received your payment for quote {{ref}}. Thank you!\n\nBest regards,\n{{companyName}}',
    }),
    productionStarted: EmailTemplateSchema.default({
      subject: 'Your order {{orderRef}} is in production',
      body: 'Dear {{customerName}},\n\nYour order {{orderRef}} is now in production.\n\nBest regards,\n{{companyName}}',
    }),
    shippingNotification: EmailTemplateSchema.default({
      subject: 'Your order {{orderRef}} has shipped!',
      body: 'Dear {{customerName}},\n\nYour order {{orderRef}} has been shipped.\n\nBest regards,\n{{companyName}}',
    }),
  }),
})
