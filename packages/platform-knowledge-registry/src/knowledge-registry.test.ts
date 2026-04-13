/**
 * @nzila/platform-knowledge-registry — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest'
import {
  KnowledgeTypes,
  KnowledgeStatuses,
  createInMemoryKnowledgeStore,
  registerKnowledgeAsset,
  searchKnowledgeAssets,
  getKnowledgeAssetVersion,
  resolveApplicableKnowledge,
  knowledgeAssets,
  knowledgeVersions,
} from './index'

function runDrizzleExtraConfig(table: Record<PropertyKey, unknown>): unknown[] {
  const symbols = Object.getOwnPropertySymbols(table)
  const builder = symbols.find((s) => s.toString() === 'Symbol(drizzle:ExtraConfigBuilder)')
  const cols = symbols.find((s) => s.toString() === 'Symbol(drizzle:ExtraConfigColumns)')

  expect(builder).toBeDefined()
  expect(cols).toBeDefined()

  return (table as Record<PropertyKey, (arg: unknown) => unknown[]>)[builder!](
    (table as Record<PropertyKey, unknown>)[cols!],
  )
}

const TENANT = 'tenant-1'
const NOW = new Date().toISOString()

describe('platform-knowledge-registry', () => {
  it('registers and retrieves a knowledge asset', async () => {
    const store = createInMemoryKnowledgeStore()

    const asset = await registerKnowledgeAsset(store, {
      tenantScope: TENANT,
      domainScope: 'mobility',
      title: 'Asylum Eligibility Rules',
      knowledgeType: KnowledgeTypes.RULE,
      source: 'legal-team',
      effectiveDate: NOW,
      tags: ['asylum', 'eligibility'],
      textPayload: 'Applicant must demonstrate credible fear...',
    })

    expect(asset.id).toBeDefined()
    expect(asset.version).toBe(1)
    expect(asset.status).toBe('active')

    const found = await store.get(asset.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Asylum Eligibility Rules')
  })

  it('searches knowledge by domain and tags', async () => {
    const store = createInMemoryKnowledgeStore()

    await registerKnowledgeAsset(store, {
      tenantScope: TENANT,
      domainScope: 'mobility',
      title: 'H-1B Requirements',
      knowledgeType: KnowledgeTypes.PROGRAM_REQUIREMENT,
      source: 'uscis',
      effectiveDate: NOW,
      tags: ['h1b', 'visa'],
    })

    await registerKnowledgeAsset(store, {
      tenantScope: TENANT,
      domainScope: 'agri',
      title: 'Subsidy Threshold Table',
      knowledgeType: KnowledgeTypes.THRESHOLD_TABLE,
      source: 'ministry-of-agriculture',
      effectiveDate: NOW,
      tags: ['subsidy'],
    })

    const mobilityAssets = await searchKnowledgeAssets(store, {
      domainScope: 'mobility',
    })
    expect(mobilityAssets).toHaveLength(1)
    expect(mobilityAssets[0].title).toBe('H-1B Requirements')

    const tagSearch = await searchKnowledgeAssets(store, {
      tags: ['subsidy'],
    })
    expect(tagSearch).toHaveLength(1)
  })

  it('supports versioning', async () => {
    const store = createInMemoryKnowledgeStore()

    const asset = await registerKnowledgeAsset(store, {
      tenantScope: TENANT,
      domainScope: 'compliance',
      title: 'KYC Policy v1',
      knowledgeType: KnowledgeTypes.POLICY,
      source: 'compliance-team',
      effectiveDate: NOW,
    })

    await store.update(asset.id, {
      title: 'KYC Policy v2',
      textPayload: 'Updated KYC requirements...',
      changedBy: 'admin',
      changeReason: 'regulatory update',
    })

    const versions = await store.listVersions(asset.id)
    expect(versions).toHaveLength(2)

    const v1 = await getKnowledgeAssetVersion(store, asset.id, 1)
    expect(v1).toBeDefined()
    expect(v1!.version).toBe(1)
  })

  it('resolves applicable knowledge for a domain', async () => {
    const store = createInMemoryKnowledgeStore()

    await registerKnowledgeAsset(store, {
      tenantScope: TENANT,
      domainScope: 'mobility',
      title: 'Active Rule',
      knowledgeType: KnowledgeTypes.RULE,
      source: 'system',
      effectiveDate: NOW,
      tags: ['eligibility'],
    })

    const applicable = await resolveApplicableKnowledge(
      store, TENANT, 'mobility', ['eligibility'],
    )
    expect(applicable).toHaveLength(1)
  })

  it('filters by status, tenant, query text, and missing tags', async () => {
    const store = createInMemoryKnowledgeStore()

    const asset = await registerKnowledgeAsset(store, {
      tenantScope: TENANT,
      domainScope: 'mobility',
      title: 'Mobility Handbook',
      knowledgeType: KnowledgeTypes.POLICY,
      source: 'ops',
      effectiveDate: NOW,
      textPayload: 'Work permit obligations and deadlines.',
      tags: ['permit'],
    })

    await store.update(asset.id, {
      status: KnowledgeStatuses.DRAFT,
      changedBy: 'editor',
      changeReason: 'review',
    })

    expect(await searchKnowledgeAssets(store, { tenantScope: 'other-tenant' })).toHaveLength(0)
    expect(await searchKnowledgeAssets(store, { status: KnowledgeStatuses.ACTIVE })).toHaveLength(0)
    expect(await searchKnowledgeAssets(store, { query: 'deadlines' })).toHaveLength(1)
    expect(await searchKnowledgeAssets(store, { tags: ['not-present'] })).toHaveLength(0)
  })

  it('returns undefined when update/getVersion target does not exist', async () => {
    const store = createInMemoryKnowledgeStore()

    const updated = await store.update('missing-id', {
      title: 'No-op',
      changedBy: 'system',
      changeReason: 'test',
    })
    expect(updated).toBeUndefined()

    const missingVersion = await getKnowledgeAssetVersion(store, 'missing-id', 99)
    expect(missingVersion).toBeUndefined()
  })

  it('uses deterministic fallback id when crypto.randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto
    vi.stubGlobal('crypto', {})

    try {
      const store = createInMemoryKnowledgeStore()
      const asset = await registerKnowledgeAsset(store, {
        tenantScope: TENANT,
        domainScope: 'mobility',
        title: 'Fallback ID test',
        knowledgeType: KnowledgeTypes.RULE,
        source: 'test',
        effectiveDate: NOW,
      })

      expect(asset.id).toMatch(/^00000000-0000-0000-0000-\d{12}$/)
    } finally {
      vi.stubGlobal('crypto', originalCrypto)
    }
  })

  it('exercises drizzle schema extra config builders', () => {
    const assetsConfig = runDrizzleExtraConfig(knowledgeAssets as unknown as Record<PropertyKey, unknown>)
    expect(assetsConfig).toHaveLength(5)

    const versionsConfig = runDrizzleExtraConfig(knowledgeVersions as unknown as Record<PropertyKey, unknown>)
    expect(versionsConfig).toHaveLength(2)
  })
})
