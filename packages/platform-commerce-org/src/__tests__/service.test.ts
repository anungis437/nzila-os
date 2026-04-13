import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => {
  return {
    selectQueue: [] as unknown[][],
    insertQueue: [] as unknown[][],
  }
})

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
}))

vi.mock('@nzila/db', () => {
  const makeSelectChain = (rows: unknown[]) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  })

  const makeInsertChain = (rows: unknown[]) => ({
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  })

  const db = {
    select: vi.fn(() => {
      const rows = (mockState.selectQueue.shift() ?? []) as unknown[]
      return makeSelectChain(rows)
    }),
    insert: vi.fn(() => {
      const rows = (mockState.insertQueue.shift() ?? []) as unknown[]
      return makeInsertChain(rows)
    }),
  }

  return {
    db,
    commerceOrgSettings: { orgId: 'orgId' },
    commerceOrgQuotePolicies: { orgId: 'orgId' },
    commerceOrgPaymentPolicies: { orgId: 'orgId' },
    commerceOrgSupplierPolicies: { orgId: 'orgId' },
    commerceOrgCatalogPolicies: { orgId: 'orgId' },
    commerceOrgBrandingConfigs: { orgId: 'orgId' },
    commerceOrgCommunicationTemplates: { orgId: 'orgId' },
  }
})

import {
  getOrgSettings,
  upsertOrgSettings,
  getOrgQuotePolicy,
  upsertOrgQuotePolicy,
  getOrgPaymentPolicy,
  upsertOrgPaymentPolicy,
  getOrgSupplierPolicy,
  upsertOrgSupplierPolicy,
  getOrgCatalogPolicy,
  upsertOrgCatalogPolicy,
  getOrgBranding,
  upsertOrgBranding,
  getOrgCommunicationTemplates,
  upsertOrgCommunicationTemplates,
  getOrgCommerceConfig,
} from '../service'
import {
  SHOPMOICA_SETTINGS,
  SHOPMOICA_QUOTE_POLICY,
  SHOPMOICA_PAYMENT_POLICY,
  SHOPMOICA_SUPPLIER_POLICY,
  SHOPMOICA_CATALOG_POLICY,
  SHOPMOICA_BRANDING,
  SHOPMOICA_COMMUNICATION_TEMPLATES,
} from '../defaults'
import * as platformCommerceOrg from '../index'

describe('service', () => {
  beforeEach(() => {
    mockState.selectQueue.length = 0
    mockState.insertQueue.length = 0
  })

  it('returns defaults for all get* functions when rows are missing', async () => {
    mockState.selectQueue.push([], [], [], [], [], [], [])

    const orgId = 'org-fallback'
    await expect(getOrgSettings(orgId)).resolves.toMatchObject({ ...SHOPMOICA_SETTINGS, orgId })
    await expect(getOrgQuotePolicy(orgId)).resolves.toMatchObject({ ...SHOPMOICA_QUOTE_POLICY, orgId })
    await expect(getOrgPaymentPolicy(orgId)).resolves.toMatchObject({ ...SHOPMOICA_PAYMENT_POLICY, orgId })
    await expect(getOrgSupplierPolicy(orgId)).resolves.toMatchObject({ ...SHOPMOICA_SUPPLIER_POLICY, orgId })
    await expect(getOrgCatalogPolicy(orgId)).resolves.toMatchObject({ ...SHOPMOICA_CATALOG_POLICY, orgId })
    await expect(getOrgBranding(orgId)).resolves.toMatchObject({ ...SHOPMOICA_BRANDING, orgId })
    await expect(getOrgCommunicationTemplates(orgId)).resolves.toMatchObject({
      ...SHOPMOICA_COMMUNICATION_TEMPLATES,
      orgId,
    })
  })

  it('maps settings row and upserts settings with change event', async () => {
    mockState.selectQueue.push([
      {
        orgId: '11111111-1111-1111-1111-111111111110',
        currency: 'USD',
        locale: 'en-US',
        quotePrefix: 'Q',
        invoicePrefix: 'I',
        poPrefix: 'P',
        orderPrefix: 'O',
        quoteValidityDays: 10,
        shareLinkExpiryDays: 2,
        taxConfig: { jurisdiction: 'US-NY', taxes: [] },
        defaultShippingPolicy: 'Standard',
      },
    ])

    const settings = await getOrgSettings('11111111-1111-1111-1111-111111111110')
    expect(settings.currency).toBe('USD')

    mockState.selectQueue.push([])
    mockState.insertQueue.push([
      {
        orgId: '11111111-1111-1111-1111-111111111110',
        currency: 'CAD',
        locale: 'en-CA',
        quotePrefix: 'SQ',
        invoicePrefix: 'INV',
        poPrefix: 'PO',
        orderPrefix: 'ORD',
        quoteValidityDays: 30,
        shareLinkExpiryDays: 7,
        taxConfig: SHOPMOICA_SETTINGS.taxConfig,
        defaultShippingPolicy: 'FOB Origin',
      },
    ])

    const result = await upsertOrgSettings(
      '11111111-1111-1111-1111-111111111110',
      {
        currency: 'CAD',
        locale: 'en-CA',
        quotePrefix: 'SQ',
        invoicePrefix: 'INV',
        poPrefix: 'PO',
        orderPrefix: 'ORD',
        quoteValidityDays: 30,
        shareLinkExpiryDays: 7,
        taxConfig: SHOPMOICA_SETTINGS.taxConfig,
        defaultShippingPolicy: 'FOB Origin',
      },
      'actor-1',
    )

    expect(result.settings.orgId).toBe('11111111-1111-1111-1111-111111111110')
    expect(result.changeEvent.configType).toBe('settings')
  })

  it('maps numeric conversions and upserts quote policy', async () => {
    mockState.selectQueue.push([
      {
        orgId: '22222222-2222-2222-2222-222222222220',
        minMarginPercent: 'bad',
        approvalRequiredBelowMargin: true,
        maxDiscountWithoutApproval: '20',
        autoExpireQuotesAfterDays: 5,
        allowManualPriceOverride: false,
        approvalThreshold: 'broken',
        requireEvidenceForInvoice: true,
        marginFloors: { budget: 10, standard: 20, premium: 30 },
      },
    ])

    const policy = await getOrgQuotePolicy('22222222-2222-2222-2222-222222222220')
    expect(policy.minMarginPercent).toBe(15)
    expect(policy.maxDiscountWithoutApproval).toBe(20)
    expect(policy.approvalThreshold).toBe(10000)

    mockState.selectQueue.push([])
    mockState.insertQueue.push([
      {
        orgId: '22222222-2222-2222-2222-222222222220',
        minMarginPercent: '22',
        approvalRequiredBelowMargin: true,
        maxDiscountWithoutApproval: '18',
        autoExpireQuotesAfterDays: 12,
        allowManualPriceOverride: true,
        approvalThreshold: '9000',
        requireEvidenceForInvoice: false,
        marginFloors: { budget: 12, standard: 22, premium: 32 },
      },
    ])

    const updated = await upsertOrgQuotePolicy(
      '22222222-2222-2222-2222-222222222220',
      {
        minMarginPercent: 22,
        approvalRequiredBelowMargin: true,
        maxDiscountWithoutApproval: 18,
        autoExpireQuotesAfterDays: 12,
        allowManualPriceOverride: true,
        approvalThreshold: 9000,
        requireEvidenceForInvoice: false,
        marginFloors: { budget: 12, standard: 22, premium: 32 },
      },
      'actor-2',
    )

    expect(updated.quotePolicy.minMarginPercent).toBe(22)
    expect(updated.changeEvent.configType).toBe('quotePolicy')
  })

  it('upserts payment, supplier, catalog, branding, and communication templates', async () => {
    mockState.selectQueue.push([], [], [], [], [])
    mockState.insertQueue.push(
      [
        {
          orgId: '33333333-3333-3333-3333-333333333330',
          depositRequired: true,
          defaultDepositPercent: '40',
          depositRequiredBeforeProduction: true,
          allowPartialPayments: false,
          defaultPaymentTerms: 'Net 15',
          defaultPaymentTermsDays: 15,
          defaultLeadTimeDays: 8,
          paymentInstructions: 'Wire transfer',
        },
      ],
      [
        {
          orgId: '33333333-3333-3333-3333-333333333330',
          preferredSupplierIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
          supplierSelectionStrategy: 'FASTEST',
          qualityWeight: '0.2',
          leadTimeWeight: '0.5',
          costWeight: '0.3',
        },
      ],
      [
        {
          orgId: '33333333-3333-3333-3333-333333333330',
          enableInternalSkuMapping: true,
          defaultMarkupStrategy: 'FIXED_PERCENT',
          defaultFixedMarkupPercent: '55',
          defaultDecorationRule: 'premium',
          categoryMappings: { apparel: 'wearables' },
        },
      ],
      [
        {
          orgId: '33333333-3333-3333-3333-333333333330',
          companyName: 'Acme',
          companyLegalName: 'Acme Inc.',
          displayName: 'Acme',
          logoUrl: null,
          logoInitials: 'AC',
          primaryColor: '#000000',
          secondaryColor: '#ffffff',
          quoteFooterText: null,
          supportEmail: null,
          customerPortalLabel: 'Portal',
          address: 'Montreal',
          hashSalt: 'salt-value',
        },
      ],
      [
        {
          orgId: '33333333-3333-3333-3333-333333333330',
          templates: SHOPMOICA_COMMUNICATION_TEMPLATES.templates,
        },
      ],
    )

    const payment = await upsertOrgPaymentPolicy(
      '33333333-3333-3333-3333-333333333330',
      {
        depositRequired: true,
        defaultDepositPercent: 40,
        depositRequiredBeforeProduction: true,
        allowPartialPayments: false,
        defaultPaymentTerms: 'Net 15',
        defaultPaymentTermsDays: 15,
        defaultLeadTimeDays: 8,
        paymentInstructions: 'Wire transfer',
      },
      'actor-3',
    )
    expect(payment.paymentPolicy.defaultDepositPercent).toBe(40)

    const supplier = await upsertOrgSupplierPolicy(
      '33333333-3333-3333-3333-333333333330',
      {
        preferredSupplierIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
        supplierSelectionStrategy: 'FASTEST',
        qualityWeight: 0.2,
        leadTimeWeight: 0.5,
        costWeight: 0.3,
      },
      'actor-3',
    )
    expect(supplier.supplierPolicy.supplierSelectionStrategy).toBe('FASTEST')

    const catalog = await upsertOrgCatalogPolicy(
      '33333333-3333-3333-3333-333333333330',
      {
        enableInternalSkuMapping: true,
        defaultMarkupStrategy: 'FIXED_PERCENT',
        defaultFixedMarkupPercent: 55,
        defaultDecorationRule: 'premium',
        categoryMappings: { apparel: 'wearables' },
      },
      'actor-3',
    )
    expect(catalog.catalogPolicy.defaultFixedMarkupPercent).toBe(55)

    const branding = await upsertOrgBranding(
      '33333333-3333-3333-3333-333333333330',
      {
        companyName: 'Acme',
        companyLegalName: 'Acme Inc.',
        displayName: 'Acme',
        logoUrl: null,
        logoInitials: 'AC',
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        quoteFooterText: null,
        supportEmail: null,
        customerPortalLabel: 'Portal',
        address: 'Montreal',
        hashSalt: 'salt-value',
      },
      'actor-3',
    )
    expect(branding.branding.displayName).toBe('Acme')

    const templates = await upsertOrgCommunicationTemplates(
      '33333333-3333-3333-3333-333333333330',
      {
        templates: SHOPMOICA_COMMUNICATION_TEMPLATES.templates,
      },
      'actor-3',
    )
    expect(templates.communicationTemplates.templates.quoteSent.subject).toContain('{{ref}}')
  })

  it('throws when upsert returns no row', async () => {
    mockState.selectQueue.push([])
    mockState.insertQueue.push([])

    await expect(
      upsertOrgCommunicationTemplates(
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        { templates: SHOPMOICA_COMMUNICATION_TEMPLATES.templates },
        'actor-err',
      ),
    ).rejects.toThrow('upsert communicationTemplates returned no row')
  })

  it('builds composite config from all get* calls', async () => {
    mockState.selectQueue.push(
      [
        {
          orgId: 'org-4',
          currency: 'CAD',
          locale: 'en-CA',
          quotePrefix: 'Q',
          invoicePrefix: 'I',
          poPrefix: 'P',
          orderPrefix: 'O',
          quoteValidityDays: 25,
          shareLinkExpiryDays: 7,
          taxConfig: SHOPMOICA_SETTINGS.taxConfig,
          defaultShippingPolicy: 'FOB',
        },
      ],
      [
        {
          orgId: 'org-4',
          minMarginPercent: '15',
          approvalRequiredBelowMargin: true,
          maxDiscountWithoutApproval: '20',
          autoExpireQuotesAfterDays: 30,
          allowManualPriceOverride: false,
          approvalThreshold: '10000',
          requireEvidenceForInvoice: true,
          marginFloors: { budget: 15, standard: 25, premium: 35 },
        },
      ],
      [
        {
          orgId: 'org-4',
          depositRequired: true,
          defaultDepositPercent: '30',
          depositRequiredBeforeProduction: true,
          allowPartialPayments: true,
          defaultPaymentTerms: 'Net 30',
          defaultPaymentTermsDays: 30,
          defaultLeadTimeDays: 14,
          paymentInstructions: 'Pay online',
        },
      ],
      [
        {
          orgId: 'org-4',
          preferredSupplierIds: [],
          supplierSelectionStrategy: 'BALANCED',
          qualityWeight: '0.3',
          leadTimeWeight: '0.3',
          costWeight: '0.4',
        },
      ],
      [
        {
          orgId: 'org-4',
          enableInternalSkuMapping: false,
          defaultMarkupStrategy: 'FIXED_PERCENT',
          defaultFixedMarkupPercent: '40',
          defaultDecorationRule: 'standard',
          categoryMappings: {},
        },
      ],
      [
        {
          orgId: 'org-4',
          companyName: 'ShopMoiCa',
          companyLegalName: 'Nzila Ventures SENC',
          displayName: 'ShopMoiCa',
          logoUrl: null,
          logoInitials: 'SM',
          primaryColor: '#7c3aed',
          secondaryColor: '#e5e7eb',
          quoteFooterText: 'Thank you',
          supportEmail: null,
          customerPortalLabel: 'Quote Portal',
          address: 'Montreal',
          hashSalt: '_salt',
        },
      ],
      [
        {
          orgId: 'org-4',
          templates: SHOPMOICA_COMMUNICATION_TEMPLATES.templates,
        },
      ],
    )

    const config = await getOrgCommerceConfig('org-4')
    expect(config.settings.currency).toBe('CAD')
    expect(config.quotePolicy.approvalThreshold).toBe(10000)
    expect(config.communicationTemplates.templates.paymentConfirmation.subject).toContain('{{ref}}')
  })

  it('exposes service functions through barrel exports', () => {
    expect(typeof platformCommerceOrg.getOrgSettings).toBe('function')
    expect(typeof platformCommerceOrg.getOrgCommerceConfig).toBe('function')
  })
})
