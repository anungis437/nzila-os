/**
 * @nzila/platform-commerce-org — Service layer
 *
 * Canonical CRUD for org-scoped commerce configuration.
 * All writes are Zod-validated and produce auditable change events.
 * Reads fall back to ShopMoiCa defaults when no row exists (backward compat).
 */
import { eq } from 'drizzle-orm'
import {
  db,
  commerceOrgSettings,
  commerceOrgQuotePolicies,
  commerceOrgPaymentPolicies,
  commerceOrgSupplierPolicies,
  commerceOrgCatalogPolicies,
  commerceOrgBrandingConfigs,
  commerceOrgCommunicationTemplates,
} from '@nzila/db'

import {
  OrgCommerceSettingsSchema,
  OrgQuotePolicySchema,
  OrgPaymentPolicySchema,
  OrgSupplierPolicySchema,
  OrgCatalogPolicySchema,
  OrgBrandingConfigSchema,
  OrgCommunicationTemplatesSchema,
} from './schemas'

import type {
  OrgCommerceSettings,
  OrgQuotePolicy,
  OrgPaymentPolicy,
  OrgSupplierPolicy,
  OrgCatalogPolicy,
  OrgBrandingConfig,
  OrgCommunicationTemplates,
  OrgCommerceConfig,
  OrgConfigChangeEvent,
} from './types'

import {
  SHOPMOICA_SETTINGS,
  SHOPMOICA_QUOTE_POLICY,
  SHOPMOICA_PAYMENT_POLICY,
  SHOPMOICA_SUPPLIER_POLICY,
  SHOPMOICA_CATALOG_POLICY,
  SHOPMOICA_BRANDING,
  SHOPMOICA_COMMUNICATION_TEMPLATES,
} from './defaults'

import { buildConfigChangeEvent } from './audit'

// ── Helpers ─────────────────────────────────────────────────────────────────

function numericToNumber(v: string | null | undefined, fallback: number): number {
  if (v == null) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getOrgSettings(orgId: string): Promise<OrgCommerceSettings> {
  const [row] = await db
    .select()
    .from(commerceOrgSettings)
    .where(eq(commerceOrgSettings.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_SETTINGS, orgId }

  return {
    orgId: row.orgId,
    currency: row.currency,
    locale: row.locale,
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    poPrefix: row.poPrefix,
    orderPrefix: row.orderPrefix,
    quoteValidityDays: row.quoteValidityDays,
    shareLinkExpiryDays: row.shareLinkExpiryDays,
    taxConfig: row.taxConfig as OrgCommerceSettings['taxConfig'],
    defaultShippingPolicy: row.defaultShippingPolicy,
  }
}

export async function upsertOrgSettings(
  orgId: string,
  input: Omit<OrgCommerceSettings, 'orgId'>,
  actorId: string,
): Promise<{ settings: OrgCommerceSettings; changeEvent: OrgConfigChangeEvent }> {
  const validated = OrgCommerceSettingsSchema.parse({ ...input, orgId })
  const previous = await getOrgSettings(orgId)

  const [row] = await db
    .insert(commerceOrgSettings)
    .values({
      orgId,
      currency: validated.currency,
      locale: validated.locale,
      quotePrefix: validated.quotePrefix,
      invoicePrefix: validated.invoicePrefix,
      poPrefix: validated.poPrefix,
      orderPrefix: validated.orderPrefix,
      quoteValidityDays: validated.quoteValidityDays,
      shareLinkExpiryDays: validated.shareLinkExpiryDays,
      taxConfig: validated.taxConfig,
      defaultShippingPolicy: validated.defaultShippingPolicy,
    })
    .onConflictDoUpdate({
      target: commerceOrgSettings.orgId,
      set: {
        currency: validated.currency,
        locale: validated.locale,
        quotePrefix: validated.quotePrefix,
        invoicePrefix: validated.invoicePrefix,
        poPrefix: validated.poPrefix,
        orderPrefix: validated.orderPrefix,
        quoteValidityDays: validated.quoteValidityDays,
        shareLinkExpiryDays: validated.shareLinkExpiryDays,
        taxConfig: validated.taxConfig,
        defaultShippingPolicy: validated.defaultShippingPolicy,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert settings returned no row')

  const settings: OrgCommerceSettings = {
    orgId: row.orgId,
    currency: row.currency,
    locale: row.locale,
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    poPrefix: row.poPrefix,
    orderPrefix: row.orderPrefix,
    quoteValidityDays: row.quoteValidityDays,
    shareLinkExpiryDays: row.shareLinkExpiryDays,
    taxConfig: row.taxConfig as OrgCommerceSettings['taxConfig'],
    defaultShippingPolicy: row.defaultShippingPolicy,
  }

  const changeEvent = buildConfigChangeEvent(orgId, 'settings', actorId, previous, settings)
  return { settings, changeEvent }
}

// ── Quote Policy ────────────────────────────────────────────────────────────

export async function getOrgQuotePolicy(orgId: string): Promise<OrgQuotePolicy> {
  const [row] = await db
    .select()
    .from(commerceOrgQuotePolicies)
    .where(eq(commerceOrgQuotePolicies.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_QUOTE_POLICY, orgId }

  return {
    orgId: row.orgId,
    minMarginPercent: numericToNumber(row.minMarginPercent, 15),
    approvalRequiredBelowMargin: row.approvalRequiredBelowMargin,
    maxDiscountWithoutApproval: numericToNumber(row.maxDiscountWithoutApproval, 25),
    autoExpireQuotesAfterDays: row.autoExpireQuotesAfterDays,
    allowManualPriceOverride: row.allowManualPriceOverride,
    approvalThreshold: numericToNumber(row.approvalThreshold, 10_000),
    requireEvidenceForInvoice: row.requireEvidenceForInvoice,
    marginFloors: row.marginFloors as OrgQuotePolicy['marginFloors'],
  }
}

export async function upsertOrgQuotePolicy(
  orgId: string,
  input: Omit<OrgQuotePolicy, 'orgId'>,
  actorId: string,
): Promise<{ quotePolicy: OrgQuotePolicy; changeEvent: OrgConfigChangeEvent }> {
  const validated = OrgQuotePolicySchema.parse({ ...input, orgId })
  const previous = await getOrgQuotePolicy(orgId)

  const [row] = await db
    .insert(commerceOrgQuotePolicies)
    .values({
      orgId,
      minMarginPercent: String(validated.minMarginPercent),
      approvalRequiredBelowMargin: validated.approvalRequiredBelowMargin,
      maxDiscountWithoutApproval: String(validated.maxDiscountWithoutApproval),
      autoExpireQuotesAfterDays: validated.autoExpireQuotesAfterDays,
      allowManualPriceOverride: validated.allowManualPriceOverride,
      approvalThreshold: String(validated.approvalThreshold),
      requireEvidenceForInvoice: validated.requireEvidenceForInvoice,
      marginFloors: validated.marginFloors,
    })
    .onConflictDoUpdate({
      target: commerceOrgQuotePolicies.orgId,
      set: {
        minMarginPercent: String(validated.minMarginPercent),
        approvalRequiredBelowMargin: validated.approvalRequiredBelowMargin,
        maxDiscountWithoutApproval: String(validated.maxDiscountWithoutApproval),
        autoExpireQuotesAfterDays: validated.autoExpireQuotesAfterDays,
        allowManualPriceOverride: validated.allowManualPriceOverride,
        approvalThreshold: String(validated.approvalThreshold),
        requireEvidenceForInvoice: validated.requireEvidenceForInvoice,
        marginFloors: validated.marginFloors,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert quotePolicy returned no row')

  const quotePolicy: OrgQuotePolicy = {
    orgId: row.orgId,
    minMarginPercent: numericToNumber(row.minMarginPercent, 15),
    approvalRequiredBelowMargin: row.approvalRequiredBelowMargin,
    maxDiscountWithoutApproval: numericToNumber(row.maxDiscountWithoutApproval, 25),
    autoExpireQuotesAfterDays: row.autoExpireQuotesAfterDays,
    allowManualPriceOverride: row.allowManualPriceOverride,
    approvalThreshold: numericToNumber(row.approvalThreshold, 10_000),
    requireEvidenceForInvoice: row.requireEvidenceForInvoice,
    marginFloors: row.marginFloors as OrgQuotePolicy['marginFloors'],
  }

  const changeEvent = buildConfigChangeEvent(orgId, 'quotePolicy', actorId, previous, quotePolicy)
  return { quotePolicy, changeEvent }
}

// ── Payment Policy ──────────────────────────────────────────────────────────

export async function getOrgPaymentPolicy(orgId: string): Promise<OrgPaymentPolicy> {
  const [row] = await db
    .select()
    .from(commerceOrgPaymentPolicies)
    .where(eq(commerceOrgPaymentPolicies.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_PAYMENT_POLICY, orgId }

  return {
    orgId: row.orgId,
    depositRequired: row.depositRequired,
    defaultDepositPercent: numericToNumber(row.defaultDepositPercent, 30),
    depositRequiredBeforeProduction: row.depositRequiredBeforeProduction,
    allowPartialPayments: row.allowPartialPayments,
    defaultPaymentTerms: row.defaultPaymentTerms,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    defaultLeadTimeDays: row.defaultLeadTimeDays,
    paymentInstructions: row.paymentInstructions,
  }
}

export async function upsertOrgPaymentPolicy(
  orgId: string,
  input: Omit<OrgPaymentPolicy, 'orgId'>,
  actorId: string,
): Promise<{ paymentPolicy: OrgPaymentPolicy; changeEvent: OrgConfigChangeEvent }> {
  const validated = OrgPaymentPolicySchema.parse({ ...input, orgId })
  const previous = await getOrgPaymentPolicy(orgId)

  const [row] = await db
    .insert(commerceOrgPaymentPolicies)
    .values({
      orgId,
      depositRequired: validated.depositRequired,
      defaultDepositPercent: String(validated.defaultDepositPercent),
      depositRequiredBeforeProduction: validated.depositRequiredBeforeProduction,
      allowPartialPayments: validated.allowPartialPayments,
      defaultPaymentTerms: validated.defaultPaymentTerms,
      defaultPaymentTermsDays: validated.defaultPaymentTermsDays,
      defaultLeadTimeDays: validated.defaultLeadTimeDays,
      paymentInstructions: validated.paymentInstructions,
    })
    .onConflictDoUpdate({
      target: commerceOrgPaymentPolicies.orgId,
      set: {
        depositRequired: validated.depositRequired,
        defaultDepositPercent: String(validated.defaultDepositPercent),
        depositRequiredBeforeProduction: validated.depositRequiredBeforeProduction,
        allowPartialPayments: validated.allowPartialPayments,
        defaultPaymentTerms: validated.defaultPaymentTerms,
        defaultPaymentTermsDays: validated.defaultPaymentTermsDays,
        defaultLeadTimeDays: validated.defaultLeadTimeDays,
        paymentInstructions: validated.paymentInstructions,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert paymentPolicy returned no row')

  const paymentPolicy: OrgPaymentPolicy = {
    orgId: row.orgId,
    depositRequired: row.depositRequired,
    defaultDepositPercent: numericToNumber(row.defaultDepositPercent, 30),
    depositRequiredBeforeProduction: row.depositRequiredBeforeProduction,
    allowPartialPayments: row.allowPartialPayments,
    defaultPaymentTerms: row.defaultPaymentTerms,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    defaultLeadTimeDays: row.defaultLeadTimeDays,
    paymentInstructions: row.paymentInstructions,
  }

  const changeEvent = buildConfigChangeEvent(orgId, 'paymentPolicy', actorId, previous, paymentPolicy)
  return { paymentPolicy, changeEvent }
}

// ── Supplier Policy ─────────────────────────────────────────────────────────

export async function getOrgSupplierPolicy(orgId: string): Promise<OrgSupplierPolicy> {
  const [row] = await db
    .select()
    .from(commerceOrgSupplierPolicies)
    .where(eq(commerceOrgSupplierPolicies.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_SUPPLIER_POLICY, orgId }

  return {
    orgId: row.orgId,
    preferredSupplierIds: row.preferredSupplierIds as string[],
    supplierSelectionStrategy: row.supplierSelectionStrategy,
    qualityWeight: numericToNumber(row.qualityWeight, 0.3),
    leadTimeWeight: numericToNumber(row.leadTimeWeight, 0.3),
    costWeight: numericToNumber(row.costWeight, 0.4),
  }
}

export async function upsertOrgSupplierPolicy(
  orgId: string,
  input: Omit<OrgSupplierPolicy, 'orgId'>,
  actorId: string,
): Promise<{ supplierPolicy: OrgSupplierPolicy; changeEvent: OrgConfigChangeEvent }> {
  const validated = OrgSupplierPolicySchema.parse({ ...input, orgId })
  const previous = await getOrgSupplierPolicy(orgId)

  const [row] = await db
    .insert(commerceOrgSupplierPolicies)
    .values({
      orgId,
      preferredSupplierIds: validated.preferredSupplierIds,
      supplierSelectionStrategy: validated.supplierSelectionStrategy,
      qualityWeight: String(validated.qualityWeight),
      leadTimeWeight: String(validated.leadTimeWeight),
      costWeight: String(validated.costWeight),
    })
    .onConflictDoUpdate({
      target: commerceOrgSupplierPolicies.orgId,
      set: {
        preferredSupplierIds: validated.preferredSupplierIds,
        supplierSelectionStrategy: validated.supplierSelectionStrategy,
        qualityWeight: String(validated.qualityWeight),
        leadTimeWeight: String(validated.leadTimeWeight),
        costWeight: String(validated.costWeight),
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert supplierPolicy returned no row')

  const supplierPolicy: OrgSupplierPolicy = {
    orgId: row.orgId,
    preferredSupplierIds: row.preferredSupplierIds as string[],
    supplierSelectionStrategy: row.supplierSelectionStrategy,
    qualityWeight: numericToNumber(row.qualityWeight, 0.3),
    leadTimeWeight: numericToNumber(row.leadTimeWeight, 0.3),
    costWeight: numericToNumber(row.costWeight, 0.4),
  }

  const changeEvent = buildConfigChangeEvent(orgId, 'supplierPolicy', actorId, previous, supplierPolicy)
  return { supplierPolicy, changeEvent }
}

// ── Catalog Policy ──────────────────────────────────────────────────────────

export async function getOrgCatalogPolicy(orgId: string): Promise<OrgCatalogPolicy> {
  const [row] = await db
    .select()
    .from(commerceOrgCatalogPolicies)
    .where(eq(commerceOrgCatalogPolicies.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_CATALOG_POLICY, orgId }

  return {
    orgId: row.orgId,
    enableInternalSkuMapping: row.enableInternalSkuMapping,
    defaultMarkupStrategy: row.defaultMarkupStrategy,
    defaultFixedMarkupPercent: numericToNumber(row.defaultFixedMarkupPercent, 40),
    defaultDecorationRule: row.defaultDecorationRule,
    categoryMappings: row.categoryMappings as Record<string, string>,
  }
}

export async function upsertOrgCatalogPolicy(
  orgId: string,
  input: Omit<OrgCatalogPolicy, 'orgId'>,
  actorId: string,
): Promise<{ catalogPolicy: OrgCatalogPolicy; changeEvent: OrgConfigChangeEvent }> {
  const validated = OrgCatalogPolicySchema.parse({ ...input, orgId })
  const previous = await getOrgCatalogPolicy(orgId)

  const [row] = await db
    .insert(commerceOrgCatalogPolicies)
    .values({
      orgId,
      enableInternalSkuMapping: validated.enableInternalSkuMapping,
      defaultMarkupStrategy: validated.defaultMarkupStrategy,
      defaultFixedMarkupPercent: String(validated.defaultFixedMarkupPercent),
      defaultDecorationRule: validated.defaultDecorationRule,
      categoryMappings: validated.categoryMappings,
    })
    .onConflictDoUpdate({
      target: commerceOrgCatalogPolicies.orgId,
      set: {
        enableInternalSkuMapping: validated.enableInternalSkuMapping,
        defaultMarkupStrategy: validated.defaultMarkupStrategy,
        defaultFixedMarkupPercent: String(validated.defaultFixedMarkupPercent),
        defaultDecorationRule: validated.defaultDecorationRule,
        categoryMappings: validated.categoryMappings,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert catalogPolicy returned no row')

  const catalogPolicy: OrgCatalogPolicy = {
    orgId: row.orgId,
    enableInternalSkuMapping: row.enableInternalSkuMapping,
    defaultMarkupStrategy: row.defaultMarkupStrategy,
    defaultFixedMarkupPercent: numericToNumber(row.defaultFixedMarkupPercent, 40),
    defaultDecorationRule: row.defaultDecorationRule,
    categoryMappings: row.categoryMappings as Record<string, string>,
  }

  const changeEvent = buildConfigChangeEvent(orgId, 'catalogPolicy', actorId, previous, catalogPolicy)
  return { catalogPolicy, changeEvent }
}

// ── Branding ────────────────────────────────────────────────────────────────

export async function getOrgBranding(orgId: string): Promise<OrgBrandingConfig> {
  const [row] = await db
    .select()
    .from(commerceOrgBrandingConfigs)
    .where(eq(commerceOrgBrandingConfigs.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_BRANDING, orgId }

  return {
    orgId: row.orgId,
    companyName: row.companyName,
    companyLegalName: row.companyLegalName,
    displayName: row.displayName,
    logoUrl: row.logoUrl ?? null,
    logoInitials: row.logoInitials ?? null,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    quoteFooterText: row.quoteFooterText ?? null,
    supportEmail: row.supportEmail ?? null,
    customerPortalLabel: row.customerPortalLabel,
    address: row.address,
    hashSalt: row.hashSalt,
  }
}

export async function upsertOrgBranding(
  orgId: string,
  input: Omit<OrgBrandingConfig, 'orgId'>,
  actorId: string,
): Promise<{ branding: OrgBrandingConfig; changeEvent: OrgConfigChangeEvent }> {
  const validated = OrgBrandingConfigSchema.parse({ ...input, orgId })
  const previous = await getOrgBranding(orgId)

  const [row] = await db
    .insert(commerceOrgBrandingConfigs)
    .values({
      orgId,
      companyName: validated.companyName,
      companyLegalName: validated.companyLegalName,
      displayName: validated.displayName,
      logoUrl: validated.logoUrl ?? null,
      logoInitials: validated.logoInitials ?? null,
      primaryColor: validated.primaryColor,
      secondaryColor: validated.secondaryColor,
      quoteFooterText: validated.quoteFooterText ?? null,
      supportEmail: validated.supportEmail ?? null,
      customerPortalLabel: validated.customerPortalLabel,
      address: validated.address,
      hashSalt: validated.hashSalt,
    })
    .onConflictDoUpdate({
      target: commerceOrgBrandingConfigs.orgId,
      set: {
        companyName: validated.companyName,
        companyLegalName: validated.companyLegalName,
        displayName: validated.displayName,
        logoUrl: validated.logoUrl ?? null,
        logoInitials: validated.logoInitials ?? null,
        primaryColor: validated.primaryColor,
        secondaryColor: validated.secondaryColor,
        quoteFooterText: validated.quoteFooterText ?? null,
        supportEmail: validated.supportEmail ?? null,
        customerPortalLabel: validated.customerPortalLabel,
        address: validated.address,
        hashSalt: validated.hashSalt,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert branding returned no row')

  const branding: OrgBrandingConfig = {
    orgId: row.orgId,
    companyName: row.companyName,
    companyLegalName: row.companyLegalName,
    displayName: row.displayName,
    logoUrl: row.logoUrl ?? null,
    logoInitials: row.logoInitials ?? null,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    quoteFooterText: row.quoteFooterText ?? null,
    supportEmail: row.supportEmail ?? null,
    customerPortalLabel: row.customerPortalLabel,
    address: row.address,
    hashSalt: row.hashSalt,
  }

  const changeEvent = buildConfigChangeEvent(orgId, 'branding', actorId, previous, branding)
  return { branding, changeEvent }
}

// ── Communication Templates ─────────────────────────────────────────────────

export async function getOrgCommunicationTemplates(
  orgId: string,
): Promise<OrgCommunicationTemplates> {
  const [row] = await db
    .select()
    .from(commerceOrgCommunicationTemplates)
    .where(eq(commerceOrgCommunicationTemplates.orgId, orgId))
    .limit(1)

  if (!row) return { ...SHOPMOICA_COMMUNICATION_TEMPLATES, orgId }

  return {
    orgId: row.orgId,
    templates: row.templates as OrgCommunicationTemplates['templates'],
  }
}

export async function upsertOrgCommunicationTemplates(
  orgId: string,
  input: Omit<OrgCommunicationTemplates, 'orgId'>,
  actorId: string,
): Promise<{
  communicationTemplates: OrgCommunicationTemplates
  changeEvent: OrgConfigChangeEvent
}> {
  const validated = OrgCommunicationTemplatesSchema.parse({ ...input, orgId })
  const previous = await getOrgCommunicationTemplates(orgId)

  const [row] = await db
    .insert(commerceOrgCommunicationTemplates)
    .values({
      orgId,
      templates: validated.templates,
    })
    .onConflictDoUpdate({
      target: commerceOrgCommunicationTemplates.orgId,
      set: {
        templates: validated.templates,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) throw new Error('upsert communicationTemplates returned no row')

  const communicationTemplates: OrgCommunicationTemplates = {
    orgId: row.orgId,
    templates: row.templates as OrgCommunicationTemplates['templates'],
  }

  const changeEvent = buildConfigChangeEvent(
    orgId,
    'communicationTemplates',
    actorId,
    previous,
    communicationTemplates,
  )
  return { communicationTemplates, changeEvent }
}

// ── Composite ───────────────────────────────────────────────────────────────

export async function getOrgCommerceConfig(orgId: string): Promise<OrgCommerceConfig> {
  const [settings, quotePolicy, paymentPolicy, supplierPolicy, catalogPolicy, branding, communicationTemplates] =
    await Promise.all([
      getOrgSettings(orgId),
      getOrgQuotePolicy(orgId),
      getOrgPaymentPolicy(orgId),
      getOrgSupplierPolicy(orgId),
      getOrgCatalogPolicy(orgId),
      getOrgBranding(orgId),
      getOrgCommunicationTemplates(orgId),
    ])

  return {
    settings,
    quotePolicy,
    paymentPolicy,
    supplierPolicy,
    catalogPolicy,
    branding,
    communicationTemplates,
  }
}
