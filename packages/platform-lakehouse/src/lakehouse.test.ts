/**
 * @nzila/platform-lakehouse — Tests
 */
import { describe, it, expect } from 'vitest'
import {
  PUBLIC_DATA_SOURCES,
  getSourcesForDomain,
  getSourcesByCategory,
  getIngestableSources,
} from './catalog'
import {
  CANADIAN_FUNDING_PROGRAMS,
  getFundingForDomain,
  getFundingByType,
  getRollingPrograms,
  getFundingByBudget,
} from './funding-radar'
import {
  warehouseProductMetricSchema,
  warehouseDealEntrySchema,
  warehouseFundingApplicationSchema,
  warehousePartnerSchema,
  warehouseDataSourceSyncSchema,
  WAREHOUSE_TABLES,
} from './warehouse-schema'
import { dataSourceDescriptorSchema, fundingProgramSchema } from './types'

// ── Catalog ─────────────────────────────────────────────────────────────────

describe('PUBLIC_DATA_SOURCES catalog', () => {
  it('has at least 10 entries', () => {
    expect(PUBLIC_DATA_SOURCES.length).toBeGreaterThanOrEqual(10)
  })

  it('every entry has a unique id', () => {
    const ids = PUBLIC_DATA_SOURCES.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every entry passes the dataSourceDescriptor schema', () => {
    for (const source of PUBLIC_DATA_SOURCES) {
      const result = dataSourceDescriptorSchema.safeParse(source)
      expect(result.success, `source ${source.id} failed: ${JSON.stringify((result as { error?: unknown }).error)}`).toBe(true)
    }
  })

  it('every entry has at least one relevant domain', () => {
    for (const source of PUBLIC_DATA_SOURCES) {
      expect(source.relevantDomains.length, `source ${source.id} has no domains`).toBeGreaterThan(0)
    }
  })

  it('getSourcesForDomain returns union-eyes sources', () => {
    const sources = getSourcesForDomain('union-eyes')
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every((s) => s.relevantDomains.includes('union-eyes'))).toBe(true)
  })

  it('getSourcesForDomain returns zonga sources', () => {
    const sources = getSourcesForDomain('zonga')
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every((s) => s.relevantDomains.includes('zonga'))).toBe(true)
  })

  it('getSourcesByCategory returns labour sources', () => {
    const sources = getSourcesByCategory('labour')
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every((s) => s.category === 'labour')).toBe(true)
  })

  it('getIngestableSources returns only public no-auth sources', () => {
    const sources = getIngestableSources()
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.every((s) => s.isPublic && !s.requiresAuth)).toBe(true)
  })
})

// ── Funding Radar ────────────────────────────────────────────────────────────

describe('CANADIAN_FUNDING_PROGRAMS radar', () => {
  it('has at least 8 programs', () => {
    expect(CANADIAN_FUNDING_PROGRAMS.length).toBeGreaterThanOrEqual(8)
  })

  it('every entry has a unique id', () => {
    const ids = CANADIAN_FUNDING_PROGRAMS.map((p) => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every entry passes the fundingProgram schema', () => {
    for (const program of CANADIAN_FUNDING_PROGRAMS) {
      const result = fundingProgramSchema.safeParse(program)
      expect(result.success, `program ${program.id} failed: ${JSON.stringify((result as { error?: unknown }).error)}`).toBe(true)
    }
  })

  it('SR&ED is present and is a tax_credit', () => {
    const sred = CANADIAN_FUNDING_PROGRAMS.find((p) => p.id === 'sred')
    expect(sred).toBeDefined()
    expect(sred?.fundingType).toBe('tax_credit')
    expect(sred?.isRecurring).toBe(true)
  })

  it('NRC-IRAP is present and is federal', () => {
    const irap = CANADIAN_FUNDING_PROGRAMS.find((p) => p.id === 'nrc-irap')
    expect(irap).toBeDefined()
    expect(irap?.government).toBe('federal')
  })

  it('getFundingForDomain returns programs for zonga', () => {
    const programs = getFundingForDomain('zonga')
    expect(programs.length).toBeGreaterThan(0)
    expect(programs.every((p) => p.relevantDomains.includes('zonga'))).toBe(true)
  })

  it('getFundingByType returns tax credits', () => {
    const credits = getFundingByType('tax_credit')
    expect(credits.length).toBeGreaterThan(0)
    expect(credits.every((p) => p.fundingType === 'tax_credit')).toBe(true)
  })

  it('getRollingPrograms returns NRC-IRAP (not SR&ED which is annual)', () => {
    const rolling = getRollingPrograms()
    const ids = rolling.map((p) => p.id)
    // NRC-IRAP is rolling; SR&ED is annual (filed with tax return) so NOT in rolling
    expect(ids).toContain('nrc-irap')
    expect(ids).not.toContain('sred')
    expect(rolling.every((p) => p.intakeTiming.toLowerCase().startsWith('rolling'))).toBe(true)
  })

  it('getFundingByBudget filters by CAD range', () => {
    const programs = getFundingByBudget(50_000, 500_000)
    expect(programs.length).toBeGreaterThan(0)
    for (const p of programs) {
      const min = p.typicalMinCad ?? 0
      const max = p.typicalMaxCad ?? Infinity
      expect(min <= 500_000 && max >= 50_000).toBe(true)
    }
  })
})

// ── Warehouse Schema ─────────────────────────────────────────────────────────

describe('warehouse schemas', () => {
  it('WAREHOUSE_TABLES has all expected table names', () => {
    expect(WAREHOUSE_TABLES.PRODUCT_METRICS).toBe('lh_product_metrics')
    expect(WAREHOUSE_TABLES.DEAL_PIPELINE).toBe('lh_deal_pipeline')
    expect(WAREHOUSE_TABLES.FUNDING_APPLICATIONS).toBe('lh_funding_applications')
    expect(WAREHOUSE_TABLES.PARTNER_MAP).toBe('lh_partner_map')
    expect(WAREHOUSE_TABLES.DATA_SOURCE_SYNCS).toBe('lh_data_source_syncs')
    expect(WAREHOUSE_TABLES.PUBLIC_DATA_DOCUMENTS).toBe('lh_public_data_documents')
  })

  it('warehouseProductMetricSchema validates a valid metric', () => {
    const result = warehouseProductMetricSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      domain: 'union-eyes',
      orgId: 'org-abc',
      metricName: 'active_members',
      value: 142,
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T23:59:59.000Z',
      periodGranularity: 'monthly',
      computedAt: '2026-05-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('warehouseDealEntrySchema validates a pilot agreement', () => {
    const result = warehouseDealEntrySchema.safeParse({
      id: '00000000-0000-4000-8000-000000000002',
      name: 'CUPE Ontario Pilot',
      sourceSystem: 'manual',
      sourceId: null,
      domain: 'union-eyes',
      agreementType: 'pilot',
      counterpartyName: 'CUPE Ontario',
      counterpartyType: 'union',
      stage: 'proposal',
      estimatedValueCad: 0,
      owner: 'michel@nzilaventures.com',
      probability: 60,
      expectedCloseDate: '2026-06-30T00:00:00.000Z',
      notes: 'Initial contact made at CLC conference.',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('warehouseFundingApplicationSchema validates an application', () => {
    const result = warehouseFundingApplicationSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000003',
      programId: 'nrc-irap',
      programName: 'NRC IRAP',
      agency: 'National Research Council of Canada',
      domains: ['union-eyes', 'platform'],
      status: 'researching',
      requestedAmountCad: 250000,
      awardedAmountCad: null,
      deadline: null,
      submittedAt: null,
      decisionAt: null,
      lead: 'michel@nzilaventures.com',
      notes: 'Contact ITA to initiate.',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('warehousePartnerSchema validates a sponsor entry', () => {
    const result = warehousePartnerSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000004',
      name: 'Sun Life Financial',
      partnerType: 'sponsor',
      primaryDomain: 'union-eyes',
      status: 'prospect',
      annualValueCad: 25000,
      contactName: null,
      contactEmail: null,
      owner: 'michel@nzilaventures.com',
      agreementTypes: ['sponsorship'],
      notes: 'Benefits administrator for several CUPE locals.',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('warehouseDataSourceSyncSchema validates a sync record', () => {
    const result = warehouseDataSourceSyncSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000005',
      sourceId: 'esdc-collective-agreements',
      sourceName: 'ESDC — Collective Agreement Database',
      sourceCategory: 'labour',
      status: 'success',
      recordsIngested: 312,
      bytesIngested: 4_200_000,
      storageDestination: 'azure-blob:nzilacanadastore/lakehouse/labour/',
      startedAt: '2026-04-20T02:00:00.000Z',
      completedAt: '2026-04-20T02:07:42.000Z',
      errorMessage: null,
    })
    expect(result.success).toBe(true)
  })
})
