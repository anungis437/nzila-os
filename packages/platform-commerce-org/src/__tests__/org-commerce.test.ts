/**
 * @nzila/platform-commerce-org — Unit tests
 *
 * Covers: schemas (Zod validation), pricing, suppliers, branding,
 * catalog, payments, workflows, audit, and utils.
 */
import { describe, it, expect } from 'vitest'

// Schemas
import {
  OrgCommerceSettingsSchema,
  OrgQuotePolicySchema,
  OrgPaymentPolicySchema,
  OrgSupplierPolicySchema,
  OrgCatalogPolicySchema,
  OrgBrandingConfigSchema,
} from '../schemas'

// Pricing
import { calculateTaxes, getCombinedTaxRate, formatCurrency, evaluateMargin } from '../pricing'

// Suppliers
import { rankSuppliers } from '../suppliers'

// Branding
import { resolveLogoInitials, resolveCopyrightNotice, resolveFooterText } from '../branding'

// Catalog
import { applyMarkup, resolveCategory, mapSku, getDecorationRule } from '../catalog'

// Payments
import { calculateDepositAmount, calculateDueDate, isProductionGated } from '../payments'

// Workflows
import {
  generateQuoteRef,
  generateInvoiceRef,
  generatePoRef,
  calculateExpiryDate,
  requiresApproval,
} from '../workflows'

// Audit
import { buildConfigChangeEvent, getEventType, getSensitiveFields } from '../audit'

// Utils
import { renderTemplate, diffConfig } from '../utils'

// Defaults (test fixtures)
import {
  SHOPMOICA_SETTINGS,
  SHOPMOICA_QUOTE_POLICY,
  SHOPMOICA_PAYMENT_POLICY,
  SHOPMOICA_SUPPLIER_POLICY,
  SHOPMOICA_CATALOG_POLICY,
  SHOPMOICA_BRANDING,
  PROMONORTH_SETTINGS,
  PROMONORTH_PAYMENT_POLICY,
} from '../defaults'

// ── Schemas ─────────────────────────────────────────────────────────────────

describe('schemas', () => {
  describe('OrgCommerceSettingsSchema', () => {
    it('parses valid settings', () => {
      const result = OrgCommerceSettingsSchema.safeParse(SHOPMOICA_SETTINGS)
      expect(result.success).toBe(true)
    })

    it('rejects invalid currency length', () => {
      const result = OrgCommerceSettingsSchema.safeParse({
        ...SHOPMOICA_SETTINGS,
        currency: 'ABCD',
      })
      expect(result.success).toBe(false)
    })

    it('rejects quoteValidityDays > 365', () => {
      const result = OrgCommerceSettingsSchema.safeParse({
        ...SHOPMOICA_SETTINGS,
        quoteValidityDays: 400,
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty quotePrefix', () => {
      const result = OrgCommerceSettingsSchema.safeParse({
        ...SHOPMOICA_SETTINGS,
        quotePrefix: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('OrgQuotePolicySchema', () => {
    it('parses valid policy', () => {
      const result = OrgQuotePolicySchema.safeParse(SHOPMOICA_QUOTE_POLICY)
      expect(result.success).toBe(true)
    })

    it('rejects negative minMarginPercent', () => {
      const result = OrgQuotePolicySchema.safeParse({
        ...SHOPMOICA_QUOTE_POLICY,
        minMarginPercent: -5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('OrgPaymentPolicySchema', () => {
    it('parses valid payment policy', () => {
      const result = OrgPaymentPolicySchema.safeParse(SHOPMOICA_PAYMENT_POLICY)
      expect(result.success).toBe(true)
    })
  })

  describe('OrgSupplierPolicySchema', () => {
    it('parses valid supplier policy', () => {
      const result = OrgSupplierPolicySchema.safeParse(SHOPMOICA_SUPPLIER_POLICY)
      expect(result.success).toBe(true)
    })
  })

  describe('OrgCatalogPolicySchema', () => {
    it('parses valid catalog policy', () => {
      const result = OrgCatalogPolicySchema.safeParse(SHOPMOICA_CATALOG_POLICY)
      expect(result.success).toBe(true)
    })
  })

  describe('OrgBrandingConfigSchema', () => {
    it('parses valid branding', () => {
      const result = OrgBrandingConfigSchema.safeParse(SHOPMOICA_BRANDING)
      expect(result.success).toBe(true)
    })
  })
})

// ── Pricing ─────────────────────────────────────────────────────────────────

describe('pricing', () => {
  describe('calculateTaxes', () => {
    it('calculates ShopMoiCa GST+QST correctly', () => {
      const result = calculateTaxes(1000, SHOPMOICA_SETTINGS)
      expect(result.taxes).toHaveLength(2)
      expect(result.taxes[0]!.code).toBe('GST')
      expect(result.taxes[0]!.amount).toBe('50.00')
      // QST is compounding: (1000 + 50) * 0.09975 = 104.74
      expect(result.taxes[1]!.code).toBe('QST')
      expect(result.taxes[1]!.amount).toBe('104.74')
      expect(result.totalTax).toBe('154.74')
      expect(result.totalWithTax).toBe('1154.74')
    })

    it('calculates PromoNorth NY sales tax', () => {
      const result = calculateTaxes(1000, PROMONORTH_SETTINGS)
      expect(result.taxes).toHaveLength(1)
      expect(result.taxes[0]!.code).toBe('SALES')
      expect(result.totalTax).toBe('88.75')
    })
  })

  describe('getCombinedTaxRate', () => {
    it('returns combined rate for ShopMoiCa (compounding)', () => {
      const rate = getCombinedTaxRate(SHOPMOICA_SETTINGS)
      // GST: 0.05, QST compounding: (1 + 0.05) * 0.09975 = 0.1047375
      expect(rate).toBeCloseTo(0.1547375, 5)
    })

    it('returns simple rate for PromoNorth', () => {
      const rate = getCombinedTaxRate(PROMONORTH_SETTINGS)
      expect(rate).toBeCloseTo(0.08875, 5)
    })
  })

  describe('formatCurrency', () => {
    it('formats CAD', () => {
      const formatted = formatCurrency(1234.56, 'CAD', 'en-CA')
      expect(formatted).toContain('1,234.56')
    })

    it('formats USD', () => {
      const formatted = formatCurrency(1234.56, 'USD', 'en-US')
      expect(formatted).toContain('1,234.56')
    })
  })

  describe('evaluateMargin', () => {
    it('meets floor when margin is above minimum', () => {
      const result = evaluateMargin(50, 100, SHOPMOICA_QUOTE_POLICY)
      expect(result.marginPercent).toBe(50)
      expect(result.meetsFloor).toBe(true)
      expect(result.requiresApproval).toBe(false)
    })

    it('fails floor and requires approval when below minimum', () => {
      const result = evaluateMargin(90, 100, SHOPMOICA_QUOTE_POLICY)
      expect(result.marginPercent).toBe(10)
      expect(result.meetsFloor).toBe(false)
      expect(result.requiresApproval).toBe(true)
    })

    it('handles zero sell price', () => {
      const result = evaluateMargin(50, 0, SHOPMOICA_QUOTE_POLICY)
      expect(result.marginPercent).toBe(0)
    })
  })
})

// ── Suppliers ───────────────────────────────────────────────────────────────

describe('suppliers', () => {
  const candidates = [
    { id: 's1', qualityRating: 4, leadTimeDays: 7, unitCost: 10 },
    { id: 's2', qualityRating: 5, leadTimeDays: 14, unitCost: 8 },
    { id: 's3', qualityRating: 3, leadTimeDays: 3, unitCost: 15 },
  ]

  describe('rankSuppliers', () => {
    it('ranks by LOWEST_COST — cheapest first', () => {
      const policy = { ...SHOPMOICA_SUPPLIER_POLICY, supplierSelectionStrategy: 'LOWEST_COST' as const }
      const ranked = rankSuppliers(candidates, policy)
      expect(ranked[0]!.supplierId).toBe('s2') // $8
    })

    it('ranks by FASTEST — shortest lead time first', () => {
      const policy = { ...SHOPMOICA_SUPPLIER_POLICY, supplierSelectionStrategy: 'FASTEST' as const }
      const ranked = rankSuppliers(candidates, policy)
      expect(ranked[0]!.supplierId).toBe('s3') // 3 days
    })

    it('ranks by BALANCED using configured weights', () => {
      const ranked = rankSuppliers(candidates, SHOPMOICA_SUPPLIER_POLICY)
      expect(ranked).toHaveLength(3)
      // All scores should be between 0..1+boost
      for (const s of ranked) {
        expect(s.totalScore).toBeGreaterThanOrEqual(0)
      }
    })

    it('returns zero-scored for MANUAL strategy', () => {
      const policy = { ...SHOPMOICA_SUPPLIER_POLICY, supplierSelectionStrategy: 'MANUAL' as const }
      const ranked = rankSuppliers(candidates, policy)
      for (const s of ranked) {
        expect(s.totalScore).toBe(0)
      }
    })

    it('boosts preferred suppliers', () => {
      const policy = { ...SHOPMOICA_SUPPLIER_POLICY, preferredSupplierIds: ['s3'] }
      const ranked = rankSuppliers(candidates, policy)
      const s3 = ranked.find((r) => r.supplierId === 's3')
      const s3NoBoost = rankSuppliers(candidates, SHOPMOICA_SUPPLIER_POLICY).find(
        (r) => r.supplierId === 's3',
      )
      expect(s3!.totalScore).toBeGreaterThan(s3NoBoost!.totalScore)
    })
  })
})

// ── Branding ────────────────────────────────────────────────────────────────

describe('branding', () => {
  describe('resolveLogoInitials', () => {
    it('uses configured initials when present', () => {
      expect(resolveLogoInitials(SHOPMOICA_BRANDING)).toBe('SM')
    })

    it('derives from display name when initials are empty', () => {
      const branding = { ...SHOPMOICA_BRANDING, logoInitials: '' }
      // ShopMoiCa is a single word → first char only
      expect(resolveLogoInitials(branding)).toBe('S')
    })
  })

  describe('resolveCopyrightNotice', () => {
    it('formats with year and legal name', () => {
      const notice = resolveCopyrightNotice(SHOPMOICA_BRANDING, 2026)
      expect(notice).toContain('2026')
      expect(notice).toContain(SHOPMOICA_BRANDING.companyLegalName)
    })
  })

  describe('resolveFooterText', () => {
    it('returns quoteFooterText when set', () => {
      const branding = { ...SHOPMOICA_BRANDING, quoteFooterText: 'Custom footer' }
      expect(resolveFooterText(branding)).toBe('Custom footer')
    })

    it('falls back to display name', () => {
      const branding = { ...SHOPMOICA_BRANDING, quoteFooterText: undefined }
      expect(resolveFooterText(branding)).toContain(SHOPMOICA_BRANDING.displayName)
    })
  })
})

// ── Catalog ─────────────────────────────────────────────────────────────────

describe('catalog', () => {
  describe('applyMarkup', () => {
    it('applies FIXED_PERCENT markup', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, defaultMarkupStrategy: 'FIXED_PERCENT' as const }
      const result = applyMarkup(100, policy)
      // ShopMoiCa fixed markup is 40%
      expect(result).toBe(140)
    })

    it('applies TIERED markup — standard tier', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, defaultMarkupStrategy: 'TIERED' as const }
      const result = applyMarkup(100, policy, 'standard')
      expect(result).toBe(150) // 1.5x
    })

    it('applies TIERED markup — premium tier', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, defaultMarkupStrategy: 'TIERED' as const }
      const result = applyMarkup(100, policy, 'premium')
      expect(result).toBe(200) // 2.0x
    })

    it('applies TIERED markup — budget tier', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, defaultMarkupStrategy: 'TIERED' as const }
      const result = applyMarkup(100, policy, 'budget')
      expect(result).toBe(125) // 1.25x
    })

    it('returns cost unchanged for MANUAL', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, defaultMarkupStrategy: 'MANUAL' as const }
      expect(applyMarkup(100, policy)).toBe(100)
    })
  })

  describe('resolveCategory', () => {
    it('maps known external category', () => {
      const result = resolveCategory('Apparel', SHOPMOICA_CATALOG_POLICY)
      if (SHOPMOICA_CATALOG_POLICY.categoryMappings['Apparel']) {
        expect(result).toBe(SHOPMOICA_CATALOG_POLICY.categoryMappings['Apparel'])
      } else {
        expect(result).toBe('Apparel')
      }
    })

    it('returns external category when no mapping exists', () => {
      expect(resolveCategory('UnknownCategory', SHOPMOICA_CATALOG_POLICY)).toBe('UnknownCategory')
    })
  })

  describe('mapSku', () => {
    it('returns original SKU when mapping is disabled', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, enableInternalSkuMapping: false }
      expect(mapSku('EXT-001', policy, { 'EXT-001': 'INT-001' })).toBe('EXT-001')
    })

    it('maps SKU when enabled and mapping exists', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, enableInternalSkuMapping: true }
      expect(mapSku('EXT-001', policy, { 'EXT-001': 'INT-001' })).toBe('INT-001')
    })

    it('falls back to external SKU when no mapping found', () => {
      const policy = { ...SHOPMOICA_CATALOG_POLICY, enableInternalSkuMapping: true }
      expect(mapSku('EXT-999', policy, { 'EXT-001': 'INT-001' })).toBe('EXT-999')
    })
  })

  describe('getDecorationRule', () => {
    it('returns the configured decoration rule', () => {
      expect(getDecorationRule(SHOPMOICA_CATALOG_POLICY)).toBe(
        SHOPMOICA_CATALOG_POLICY.defaultDecorationRule,
      )
    })
  })
})

// ── Payments ────────────────────────────────────────────────────────────────

describe('payments', () => {
  describe('calculateDepositAmount', () => {
    it('calculates deposit when required', () => {
      const result = calculateDepositAmount(10000, SHOPMOICA_PAYMENT_POLICY)
      expect(result.depositRequired).toBe(true)
      expect(result.depositPercent).toBe(30)
      expect(result.depositAmount).toBe(3000)
    })

    it('returns zero deposit when not required', () => {
      const policy = { ...SHOPMOICA_PAYMENT_POLICY, depositRequired: false }
      const result = calculateDepositAmount(10000, policy)
      expect(result.depositRequired).toBe(false)
      expect(result.depositAmount).toBe(0)
    })

    it('calculates PromoNorth 50% deposit', () => {
      const result = calculateDepositAmount(10000, PROMONORTH_PAYMENT_POLICY)
      expect(result.depositPercent).toBe(50)
      expect(result.depositAmount).toBe(5000)
    })
  })

  describe('calculateDueDate', () => {
    it('adds payment terms days', () => {
      const invoice = new Date('2026-01-01')
      const due = calculateDueDate(invoice, SHOPMOICA_PAYMENT_POLICY)
      expect(due.toISOString().slice(0, 10)).toBe('2026-01-31')
    })
  })

  describe('isProductionGated', () => {
    it('returns true when deposit is required before production', () => {
      expect(isProductionGated(SHOPMOICA_PAYMENT_POLICY)).toBe(true)
    })

    it('returns false when deposit is not required', () => {
      const policy = { ...SHOPMOICA_PAYMENT_POLICY, depositRequired: false }
      expect(isProductionGated(policy)).toBe(false)
    })
  })
})

// ── Workflows ───────────────────────────────────────────────────────────────

describe('workflows', () => {
  describe('generateQuoteRef', () => {
    it('generates ShopMoiCa ref', () => {
      expect(generateQuoteRef(SHOPMOICA_SETTINGS, 42, 2026)).toBe('SQ-2026-042')
    })

    it('generates PromoNorth ref', () => {
      expect(generateQuoteRef(PROMONORTH_SETTINGS, 1, 2026)).toBe('PN-2026-001')
    })
  })

  describe('generateInvoiceRef', () => {
    it('uses org invoice prefix', () => {
      expect(generateInvoiceRef(SHOPMOICA_SETTINGS, 7, 2026)).toBe('INV-2026-007')
    })
  })

  describe('generatePoRef', () => {
    it('uses org PO prefix', () => {
      expect(generatePoRef(SHOPMOICA_SETTINGS, 3, 2026)).toBe('PO-2026-003')
    })
  })

  describe('calculateExpiryDate', () => {
    it('adds quoteValidityDays to created date', () => {
      const created = new Date('2026-01-01')
      const expiry = calculateExpiryDate(created, SHOPMOICA_SETTINGS)
      expect(expiry.toISOString().slice(0, 10)).toBe('2026-01-31')
    })
  })

  describe('requiresApproval', () => {
    it('requires approval when total exceeds threshold', () => {
      expect(requiresApproval(15000, 50, 0, SHOPMOICA_QUOTE_POLICY)).toBe(true)
    })

    it('requires approval when margin below minimum', () => {
      expect(requiresApproval(5000, 10, 0, SHOPMOICA_QUOTE_POLICY)).toBe(true)
    })

    it('requires approval when discount exceeds max', () => {
      expect(requiresApproval(5000, 50, 30, SHOPMOICA_QUOTE_POLICY)).toBe(true)
    })

    it('does not require approval when all within limits', () => {
      expect(requiresApproval(5000, 50, 10, SHOPMOICA_QUOTE_POLICY)).toBe(false)
    })
  })
})

// ── Audit ───────────────────────────────────────────────────────────────────

describe('audit', () => {
  describe('buildConfigChangeEvent', () => {
    it('creates a valid change event', () => {
      const event = buildConfigChangeEvent('org-1', 'settings', 'actor-1', { a: 1 }, { a: 2 })
      expect(event.orgId).toBe('org-1')
      expect(event.configType).toBe('settings')
      expect(event.actorId).toBe('actor-1')
      expect(event.timestamp).toBeInstanceOf(Date)
      expect(event.previousValue).toEqual({ a: 1 })
      expect(event.newValue).toEqual({ a: 2 })
    })
  })

  describe('getEventType', () => {
    it('maps settings to org_commerce_config_updated', () => {
      expect(getEventType('settings')).toBe('org_commerce_config_updated')
    })

    it('maps quotePolicy to org_quote_policy_updated', () => {
      expect(getEventType('quotePolicy')).toBe('org_quote_policy_updated')
    })

    it('maps paymentPolicy to org_payment_policy_updated', () => {
      expect(getEventType('paymentPolicy')).toBe('org_payment_policy_updated')
    })

    it('maps branding to org_branding_updated', () => {
      expect(getEventType('branding')).toBe('org_branding_updated')
    })
  })

  describe('getSensitiveFields', () => {
    it('identifies sensitive fields', () => {
      const checks = getSensitiveFields(['depositRequired', 'minMarginPercent', 'currency'])
      expect(checks).toHaveLength(2) // currency is not sensitive
      expect(checks.map((c) => c.field)).toContain('depositRequired')
      expect(checks.map((c) => c.field)).toContain('minMarginPercent')
    })

    it('returns empty for non-sensitive fields', () => {
      expect(getSensitiveFields(['currency', 'locale'])).toHaveLength(0)
    })

    it('flags all known sensitive fields', () => {
      const allSensitive = [
        'depositRequired',
        'defaultDepositPercent',
        'minMarginPercent',
        'allowManualPriceOverride',
        'supplierSelectionStrategy',
        'approvalThreshold',
      ]
      const checks = getSensitiveFields(allSensitive)
      expect(checks).toHaveLength(6)
      for (const c of checks) {
        expect(c.requiresPolicyEvaluation).toBe(true)
      }
    })
  })
})

// ── Utils ───────────────────────────────────────────────────────────────────

describe('utils', () => {
  describe('renderTemplate', () => {
    it('replaces placeholders', () => {
      expect(renderTemplate('Hello {{name}}, your order {{ref}} is ready.', {
        name: 'Alice',
        ref: 'SQ-2026-001',
      })).toBe('Hello Alice, your order SQ-2026-001 is ready.')
    })

    it('replaces missing keys with empty string', () => {
      expect(renderTemplate('Hello {{name}}', {})).toBe('Hello ')
    })
  })

  describe('diffConfig', () => {
    it('detects changed fields', () => {
      const changed = diffConfig({ a: 1, b: 2 }, { a: 1, b: 3 })
      expect(changed).toEqual(['b'])
    })

    it('detects added fields', () => {
      const changed = diffConfig({ a: 1 }, { a: 1, b: 2 })
      expect(changed).toEqual(['b'])
    })

    it('detects removed fields', () => {
      const changed = diffConfig({ a: 1, b: 2 }, { a: 1 })
      expect(changed).toEqual(['b'])
    })

    it('returns empty when identical', () => {
      expect(diffConfig({ a: 1 }, { a: 1 })).toEqual([])
    })
  })
})
