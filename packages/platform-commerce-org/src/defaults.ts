/**
 * @nzila/platform-commerce-org — ShopMoiCa defaults
 *
 * These are the canonical ShopMoiCa defaults. They match the previously
 * hardcoded values, preserving backward compatibility during the migration
 * to org-native configuration.
 */
import type {
  OrgCommerceSettings,
  OrgQuotePolicy,
  OrgPaymentPolicy,
  OrgSupplierPolicy,
  OrgCatalogPolicy,
  OrgBrandingConfig,
  OrgCommunicationTemplates,
  OrgCommerceConfig,
} from './types'

// ── ShopMoiCa org ID (seed) ────────────────────────────────────────────────

export const SHOPMOICA_ORG_ID = '11111111-1111-1111-1111-111111111111'
export const PROMONORTH_ORG_ID = '22222222-2222-2222-2222-222222222222'

// ── ShopMoiCa defaults ─────────────────────────────────────────────────────

export const SHOPMOICA_SETTINGS: OrgCommerceSettings = {
  orgId: SHOPMOICA_ORG_ID,
  currency: 'CAD',
  locale: 'en-CA',
  quotePrefix: 'SQ',
  invoicePrefix: 'INV',
  poPrefix: 'PO',
  orderPrefix: 'ORD',
  quoteValidityDays: 30,
  shareLinkExpiryDays: 7,
  taxConfig: {
    jurisdiction: 'CA-QC',
    taxes: [
      { code: 'GST', label: 'GST (5%)', rate: 0.05, compounding: false },
      { code: 'QST', label: 'QST (9.975%)', rate: 0.09975, compounding: true },
    ],
  },
  defaultShippingPolicy: 'FOB Origin',
}

export const SHOPMOICA_QUOTE_POLICY: OrgQuotePolicy = {
  orgId: SHOPMOICA_ORG_ID,
  minMarginPercent: 15,
  approvalRequiredBelowMargin: true,
  maxDiscountWithoutApproval: 25,
  autoExpireQuotesAfterDays: 30,
  allowManualPriceOverride: false,
  approvalThreshold: 10_000,
  requireEvidenceForInvoice: true,
  marginFloors: { budget: 15, standard: 25, premium: 35 },
}

export const SHOPMOICA_PAYMENT_POLICY: OrgPaymentPolicy = {
  orgId: SHOPMOICA_ORG_ID,
  depositRequired: true,
  defaultDepositPercent: 30,
  depositRequiredBeforeProduction: true,
  allowPartialPayments: true,
  defaultPaymentTerms: 'Net 30',
  defaultPaymentTermsDays: 30,
  defaultLeadTimeDays: 14,
  paymentInstructions: 'Please reply to this email with your preferred payment method.',
}

export const SHOPMOICA_SUPPLIER_POLICY: OrgSupplierPolicy = {
  orgId: SHOPMOICA_ORG_ID,
  preferredSupplierIds: [],
  supplierSelectionStrategy: 'BALANCED',
  qualityWeight: 0.3,
  leadTimeWeight: 0.3,
  costWeight: 0.4,
}

export const SHOPMOICA_CATALOG_POLICY: OrgCatalogPolicy = {
  orgId: SHOPMOICA_ORG_ID,
  enableInternalSkuMapping: false,
  defaultMarkupStrategy: 'FIXED_PERCENT',
  defaultFixedMarkupPercent: 40,
  defaultDecorationRule: 'standard',
  categoryMappings: {},
}

export const SHOPMOICA_BRANDING: OrgBrandingConfig = {
  orgId: SHOPMOICA_ORG_ID,
  companyName: 'ShopMoiCa.ca',
  companyLegalName: 'Nzila Ventures SENC',
  displayName: 'ShopMoiCa',
  logoUrl: null,
  logoInitials: 'SM',
  primaryColor: '#7c3aed',
  secondaryColor: '#e5e7eb',
  quoteFooterText: 'Thank you for your business.',
  supportEmail: null,
  customerPortalLabel: 'Quote Portal',
  address: 'Montréal, QC, Canada',
  hashSalt: '_shopmoica_salt',
}

export const SHOPMOICA_COMMUNICATION_TEMPLATES: OrgCommunicationTemplates = {
  orgId: SHOPMOICA_ORG_ID,
  templates: {
    quoteSent: {
      subject: 'Your quote {{ref}} from {{companyName}}',
      body: 'Dear {{customerName}},\n\nPlease find your quote {{ref}} attached.\nYou can view and approve it here: {{approvalLink}}\n\nBest regards,\n{{companyName}}',
    },
    revisionRequestAck: {
      subject: 'Re: Quote {{ref}} — revision acknowledged',
      body: 'Dear {{customerName}},\n\nWe have received your revision request for quote {{ref}}. Our team will review and respond shortly.\n\nBest regards,\n{{companyName}}',
    },
    depositRequest: {
      subject: 'Deposit required for quote {{ref}}',
      body: 'Dear {{customerName}},\n\nA {{depositPercent}}% deposit is required to proceed with your order (quote {{ref}}).\n\n{{paymentInstructions}}\n\nBest regards,\n{{companyName}}',
    },
    paymentConfirmation: {
      subject: 'Payment received for quote {{ref}}',
      body: 'Dear {{customerName}},\n\nWe have received your payment for quote {{ref}}. Thank you!\n\nBest regards,\n{{companyName}}',
    },
    productionStarted: {
      subject: 'Your order {{orderRef}} is in production',
      body: 'Dear {{customerName}},\n\nYour order {{orderRef}} is now in production. We will notify you when it ships.\n\nBest regards,\n{{companyName}}',
    },
    shippingNotification: {
      subject: 'Your order {{orderRef}} has shipped!',
      body: 'Dear {{customerName}},\n\nYour order {{orderRef}} has been shipped.\n\nBest regards,\n{{companyName}}',
    },
  },
}

// ── Composite ───────────────────────────────────────────────────────────────

export const SHOPMOICA_CONFIG: OrgCommerceConfig = {
  settings: SHOPMOICA_SETTINGS,
  quotePolicy: SHOPMOICA_QUOTE_POLICY,
  paymentPolicy: SHOPMOICA_PAYMENT_POLICY,
  supplierPolicy: SHOPMOICA_SUPPLIER_POLICY,
  catalogPolicy: SHOPMOICA_CATALOG_POLICY,
  branding: SHOPMOICA_BRANDING,
  communicationTemplates: SHOPMOICA_COMMUNICATION_TEMPLATES,
}

// ── PromoNorth defaults (proof-of-SaaS second org) ──────────────────────────

export const PROMONORTH_SETTINGS: OrgCommerceSettings = {
  orgId: PROMONORTH_ORG_ID,
  currency: 'USD',
  locale: 'en-US',
  quotePrefix: 'PN',
  invoicePrefix: 'PNI',
  poPrefix: 'PNP',
  orderPrefix: 'PNO',
  quoteValidityDays: 14,
  shareLinkExpiryDays: 5,
  taxConfig: {
    jurisdiction: 'US-NY',
    taxes: [
      { code: 'SALES', label: 'Sales Tax (8.875%)', rate: 0.08875, compounding: false },
    ],
  },
  defaultShippingPolicy: 'FOB Destination',
}

export const PROMONORTH_QUOTE_POLICY: OrgQuotePolicy = {
  orgId: PROMONORTH_ORG_ID,
  minMarginPercent: 20,
  approvalRequiredBelowMargin: true,
  maxDiscountWithoutApproval: 15,
  autoExpireQuotesAfterDays: 14,
  allowManualPriceOverride: true,
  approvalThreshold: 5_000,
  requireEvidenceForInvoice: false,
  marginFloors: { budget: 20, standard: 30, premium: 40 },
}

export const PROMONORTH_PAYMENT_POLICY: OrgPaymentPolicy = {
  orgId: PROMONORTH_ORG_ID,
  depositRequired: true,
  defaultDepositPercent: 50,
  depositRequiredBeforeProduction: true,
  allowPartialPayments: false,
  defaultPaymentTerms: 'Net 15',
  defaultPaymentTermsDays: 15,
  defaultLeadTimeDays: 10,
  paymentInstructions: 'Wire transfer to PromoNorth Inc. See attached banking details.',
}

export const PROMONORTH_SUPPLIER_POLICY: OrgSupplierPolicy = {
  orgId: PROMONORTH_ORG_ID,
  preferredSupplierIds: [],
  supplierSelectionStrategy: 'LOWEST_COST',
  qualityWeight: 0.2,
  leadTimeWeight: 0.2,
  costWeight: 0.6,
}

export const PROMONORTH_CATALOG_POLICY: OrgCatalogPolicy = {
  orgId: PROMONORTH_ORG_ID,
  enableInternalSkuMapping: true,
  defaultMarkupStrategy: 'TIERED',
  defaultFixedMarkupPercent: 50,
  defaultDecorationRule: 'premium',
  categoryMappings: { apparel: 'wearables', drinkware: 'beverage-containers' },
}

export const PROMONORTH_BRANDING: OrgBrandingConfig = {
  orgId: PROMONORTH_ORG_ID,
  companyName: 'PromoNorth Inc.',
  companyLegalName: 'PromoNorth Inc.',
  displayName: 'PromoNorth',
  logoUrl: null,
  logoInitials: 'PN',
  primaryColor: '#0ea5e9',
  secondaryColor: '#f0f9ff',
  quoteFooterText: 'We appreciate your business. — The PromoNorth Team',
  supportEmail: 'support@promonorth.com',
  customerPortalLabel: 'Client Portal',
  address: 'New York, NY, USA',
  hashSalt: '_promonorth_salt_2026',
}

export const PROMONORTH_COMMUNICATION_TEMPLATES: OrgCommunicationTemplates = {
  orgId: PROMONORTH_ORG_ID,
  templates: {
    quoteSent: {
      subject: 'PromoNorth Quote {{ref}} Ready for Review',
      body: 'Hi {{customerName}},\n\nYour PromoNorth quote {{ref}} is ready. Review it here: {{approvalLink}}\n\nThanks,\nPromoNorth',
    },
    revisionRequestAck: {
      subject: 'Quote {{ref}} — Revision Received',
      body: 'Hi {{customerName}},\n\nGot your changes for {{ref}}. We will update and resend shortly.\n\nThanks,\nPromoNorth',
    },
    depositRequest: {
      subject: 'Deposit Needed — Quote {{ref}}',
      body: 'Hi {{customerName}},\n\nA {{depositPercent}}% deposit is needed for quote {{ref}}.\n\n{{paymentInstructions}}\n\nThanks,\nPromoNorth',
    },
    paymentConfirmation: {
      subject: 'Payment Confirmed — {{ref}}',
      body: 'Hi {{customerName}},\n\nPayment received for {{ref}}. Thank you!\n\nPromoNorth',
    },
    productionStarted: {
      subject: 'Order {{orderRef}} — Production Started',
      body: 'Hi {{customerName}},\n\nYour order {{orderRef}} is in production. ETA will follow.\n\nPromoNorth',
    },
    shippingNotification: {
      subject: 'Order {{orderRef}} Shipped!',
      body: 'Hi {{customerName}},\n\nOrder {{orderRef}} is on its way!\n\nPromoNorth',
    },
  },
}

export const PROMONORTH_CONFIG: OrgCommerceConfig = {
  settings: PROMONORTH_SETTINGS,
  quotePolicy: PROMONORTH_QUOTE_POLICY,
  paymentPolicy: PROMONORTH_PAYMENT_POLICY,
  supplierPolicy: PROMONORTH_SUPPLIER_POLICY,
  catalogPolicy: PROMONORTH_CATALOG_POLICY,
  branding: PROMONORTH_BRANDING,
  communicationTemplates: PROMONORTH_COMMUNICATION_TEMPLATES,
}
