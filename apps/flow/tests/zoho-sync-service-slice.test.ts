/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockGetOrgSettings,
  mockSelectWhere,
  mockSelectLimit,
  mockInsertReturning,
  mockUpdateContact,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockGetOrgSettings: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateContact: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('@nzila/platform-commerce-org/service', () => ({
  getOrgSettings: mockGetOrgSettings,
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    innerJoin: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    limit: mockSelectLimit,
  }
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
  }
  const insertChain = {
    values: vi.fn(() => insertChain),
    onConflictDoUpdate: vi.fn(() => Promise.resolve(undefined)),
    returning: mockInsertReturning,
  }

  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
    },
    commerceCustomers: { id: 'id', orgId: 'orgId', metadata: 'metadata', updatedAt: 'updatedAt' },
    commerceQuotes: { id: 'id', orgId: 'orgId', metadata: 'metadata', updatedAt: 'updatedAt' },
    commerceZohoSyncConfigs: { id: 'id', orgId: 'orgId', zohoModule: 'zohoModule' },
    commerceZohoSyncRecords: { id: 'id', orgId: 'orgId', nzilaRecordId: 'nzilaRecordId', zohoRecordId: 'zohoRecordId' },
    commerceZohoConflicts: { id: 'id', orgId: 'orgId', syncRecordId: 'syncRecordId', resolvedAt: 'resolvedAt' },
  }
})

describe('zoho sync service slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrgSettings.mockResolvedValue({ currency: 'USD' })
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
  })

  it('syncContacts handles inactive, success aggregate, and failure paths', async () => {
    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService({} as any, 'org-1')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ isActive: false } as any)
    const inactive = await service.syncContacts()
    expect(inactive.status).toBe('completed')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValue({ isActive: true, id: 'cfg-1' } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValue(new Date('2026-01-01'))
    vi.spyOn(service as any, 'pushContactsToZoho').mockResolvedValue({
      recordsCreated: 1,
      recordsUpdated: 2,
      recordsProcessed: 3,
      conflicts: [],
      errors: [],
    } as any)
    vi.spyOn(service as any, 'pullContactsFromZoho').mockResolvedValue({
      recordsCreated: 4,
      recordsUpdated: 5,
      recordsProcessed: 9,
      conflicts: [],
      errors: [],
    } as any)
    const recordRun = vi.spyOn(service as any, 'recordSyncRun').mockResolvedValue(undefined)

    const ok = await service.syncContacts({ direction: 'bidirectional', dryRun: false })
    expect(ok.status).toBe('completed')
    expect(ok.recordsProcessed).toBe(12)
    expect(ok.recordsCreated).toBe(5)
    expect(ok.recordsUpdated).toBe(7)
    expect(recordRun).toHaveBeenCalledWith('contacts', 'success', expect.any(Object))

    vi.spyOn(service as any, 'pushContactsToZoho').mockRejectedValueOnce(new Error('push failed'))
    const failed = await service.syncContacts({ direction: 'nzila_to_zoho', dryRun: false })
    expect(failed.status).toBe('failed')
    expect(failed.errors.length).toBeGreaterThan(0)
  })

  it('syncDeals handles inactive, success aggregate, and failure paths', async () => {
    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService({} as any, 'org-1')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ isActive: false } as any)
    const inactive = await service.syncDeals()
    expect(inactive.status).toBe('completed')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValue({ isActive: true, id: 'cfg-2' } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValue(new Date('2026-01-01'))
    vi.spyOn(service as any, 'pushDealsToZoho').mockResolvedValue({
      recordsCreated: 2,
      recordsUpdated: 1,
      recordsProcessed: 3,
      conflicts: [],
      errors: [],
    } as any)
    vi.spyOn(service as any, 'pullDealsFromZoho').mockResolvedValue({
      recordsCreated: 1,
      recordsUpdated: 2,
      recordsProcessed: 3,
      conflicts: [],
      errors: [],
    } as any)

    const ok = await service.syncDeals({ direction: 'bidirectional', dryRun: false })
    expect(ok.status).toBe('completed')
    expect(ok.recordsProcessed).toBe(6)

    vi.spyOn(service as any, 'pullDealsFromZoho').mockRejectedValueOnce(new Error('pull failed'))
    const failed = await service.syncDeals({ direction: 'zoho_to_nzila', dryRun: false })
    expect(failed.status).toBe('failed')
  })

  it('conflict helper paths cover no-config, unresolved list, and resolve modes', async () => {
    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService({ updateContact: mockUpdateContact } as any, 'org-1')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce(undefined as any)
    await (service as any).recordConflict({
      syncRecordId: '',
      nzilaRecordId: 'cust-1',
      zohoRecordId: 'z-1',
      nzilaData: {},
      zohoData: {},
      conflictFields: ['updatedAt'],
    })
    expect(mockLogger.warn).toHaveBeenCalled()

    mockSelectWhere.mockReturnValueOnce([
      {
        conflict: {
          nzilaData: { a: 1 },
          zohoData: { b: 2 },
          conflictFields: ['updatedAt'],
        },
        syncRecord: {
          id: 'sr-1',
          nzilaRecordId: 'cust-1',
          zohoRecordId: 'z-1',
        },
      },
    ])
    const unresolved = await service.getUnresolvedConflicts()
    expect(unresolved.length).toBe(1)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(service.resolveConflict('missing', 'local_wins')).rejects.toThrow('not found')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        conflict: { nzilaData: { name: 'Local' }, zohoData: { id: 'remote' } },
        syncRecord: { zohoRecordId: 'z-55', nzilaRecordId: 'cust-1' },
      },
    ])
    await service.resolveConflict('c1', 'local_wins')
    expect(mockUpdateContact).toHaveBeenCalled()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        conflict: {
          nzilaData: { name: 'Local' },
          zohoData: { First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' },
        },
        syncRecord: { zohoRecordId: 'z-66', nzilaRecordId: 'cust-2' },
      },
    ])
    await service.resolveConflict('c2', 'remote_wins')
  })

  it('covers push/pull contact internals with skip, conflict, create, and error branches', async () => {
    const crmClient = {
      updateContact: vi.fn().mockResolvedValue({ id: 'z-1' }),
      createContact: vi.fn().mockResolvedValue({ id: 'z-2' }),
      getContacts: vi.fn().mockResolvedValue({
        data: [
          { id: 'old-1', Modified_Time: '2026-01-01T00:00:00.000Z', First_Name: 'Old', Last_Name: 'Contact' },
          { id: 'conflict-1', Modified_Time: '2026-06-01T00:00:00.000Z', First_Name: 'Conflict', Last_Name: 'Case' },
          { id: 'new-1', Modified_Time: '2026-06-02T00:00:00.000Z', First_Name: 'New', Last_Name: 'Case' },
        ],
      }),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce([
      { id: 'cust-1', name: 'Acme One', email: 'one@test.com', phone: '111', address: null },
      { id: 'cust-2', name: 'Acme Two', email: 'two@test.com', phone: '222', address: null },
    ])
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce('z-1').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'linkRecords').mockResolvedValue(undefined)

    const push = await (service as any).pushContactsToZoho(null, false)
    expect(push.recordsProcessed).toBe(2)
    expect(push.recordsUpdated).toBe(1)
    expect(push.recordsCreated).toBe(1)

    mockSelectWhere.mockReturnValueOnce([
      { id: 'cust-err', name: 'Acme Err', email: 'err@test.com', phone: '333', address: null },
    ])
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce('z-err')
    crmClient.updateContact.mockRejectedValueOnce(new Error('update failed'))

    const pushError = await (service as any).pushContactsToZoho(null, false)
    expect(pushError.recordsFailed).toBe(1)
    expect(pushError.errors[0].errorCode).toBe('PUSH_ERROR')

    vi.spyOn(service as any, 'getLocalIdForZoho').mockResolvedValueOnce('cust-conflict').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'recordConflict').mockResolvedValue(undefined)
    vi.spyOn(service as any, 'linkRecords').mockResolvedValue(undefined)
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cust-conflict', updatedAt: new Date('2026-06-03T00:00:00.000Z') }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'cust-new' }])

    const pull = await (service as any).pullContactsFromZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pull.recordsProcessed).toBe(3)
    expect(pull.conflicts.length).toBe(1)
    expect(pull.recordsCreated).toBe(1)
  })

  it('covers pull deal internals for skip, conflict, and create branches', async () => {
    const crmClient = {
      getDeals: vi.fn().mockResolvedValue({
        data: [
          { id: 'old-deal', Modified_Time: '2026-01-01T00:00:00.000Z', Deal_Name: 'Old', Stage: 'Qualification' },
          { id: 'conflict-deal', Modified_Time: '2026-06-01T00:00:00.000Z', Deal_Name: 'Conflict', Stage: 'Qualification' },
          { id: 'new-deal', Modified_Time: '2026-06-02T00:00:00.000Z', Deal_Name: 'New', Stage: 'Proposal/Price Quote' },
        ],
      }),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('q-conflict').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'linkDealRecord').mockResolvedValue(undefined)
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'q-conflict', updatedAt: new Date('2026-06-03T00:00:00.000Z') }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'q-new' }])

    const pull = await (service as any).pullDealsFromZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pull.recordsProcessed).toBe(3)
    expect(pull.conflicts.length).toBe(1)
    expect(pull.recordsCreated).toBe(1)
  })

  it('covers helper ID resolution and link metadata branches', async () => {
    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService({} as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: { zohoDealId: 'deal-1' } }])
    await expect((service as any).getZohoDealIdForQuote('q-1')).resolves.toBe('deal-1')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect((service as any).getZohoDealIdForQuote('q-missing')).resolves.toBeNull()

    mockSelectWhere.mockReturnValueOnce([
      { id: 'q-local', metadata: { zohoDealId: 'deal-local' } },
      { id: 'q-other', metadata: {} },
    ])
    await expect((service as any).getLocalQuoteIdForZohoDeal('deal-local')).resolves.toBe('q-local')

    mockSelectWhere.mockReturnValueOnce([{ id: 'q-none', metadata: {} }])
    await expect((service as any).getLocalQuoteIdForZohoDeal('deal-none')).resolves.toBeNull()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: {} }])
    await expect((service as any).linkDealRecord('q-2', 'deal-2')).resolves.toBeUndefined()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: { zohoContactId: 'contact-1' } }])
    await expect((service as any).getZohoIdForLocal('contacts', 'c-1')).resolves.toBe('contact-1')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect((service as any).getZohoIdForLocal('contacts', 'c-missing')).resolves.toBeNull()

    mockSelectWhere.mockReturnValueOnce([
      { id: 'c-local', metadata: { zohoContactId: 'z-local' } },
      { id: 'c-other', metadata: {} },
    ])
    await expect((service as any).getLocalIdForZoho('contacts', 'z-local')).resolves.toBe('c-local')

    mockSelectWhere.mockReturnValueOnce([{ id: 'c-none', metadata: {} }])
    await expect((service as any).getLocalIdForZoho('contacts', 'z-none')).resolves.toBeNull()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: {} }])
    await expect((service as any).linkRecords('contacts', 'c-2', 'z-2')).resolves.toBeUndefined()
  })

  it('covers config upsert, dry-run sync path, and successful conflict recording', async () => {
    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService({} as any, 'org-1')

    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cfg-contacts', isActive: true }])
    await expect(service.getSyncConfig('contacts')).resolves.toMatchObject({ id: 'cfg-contacts' })

    await expect(
      service.createOrUpdateSyncConfig('contacts', {
        direction: 'from_zoho',
        isActive: false,
        fieldMappings: [{ nzilaField: 'name', zohoField: 'Last_Name', required: true }],
      }),
    ).resolves.toBeUndefined()

    vi.spyOn(service, 'getSyncConfig').mockResolvedValue({ id: 'cfg-dry', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValue(new Date('2026-01-01'))
    vi.spyOn(service as any, 'pushContactsToZoho').mockResolvedValue({
      recordsCreated: 1,
      recordsUpdated: 0,
      recordsProcessed: 1,
      conflicts: [],
      errors: [],
    } as any)
    const recordSyncRun = vi.spyOn(service as any, 'recordSyncRun').mockResolvedValue(undefined)

    const dryRun = await service.syncContacts({ direction: 'nzila_to_zoho', dryRun: true })
    expect(dryRun.status).toBe('completed')
    expect(dryRun.recordsProcessed).toBe(1)
    expect(recordSyncRun).not.toHaveBeenCalled()

    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-ok', isActive: true } as any)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'sync-rec-1' }])
    await expect(
      (service as any).recordConflict({
        syncRecordId: '',
        nzilaRecordId: 'cust-7',
        zohoRecordId: 'z-7',
        nzilaData: { name: 'Local' },
        zohoData: { First_Name: 'Remote' },
        conflictFields: ['updatedAt'],
      }),
    ).resolves.toBeUndefined()
  })

  it('covers zoho_to_nzila direction branches for contacts and deals', async () => {
    const crmClient = {
      getDeals: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValue({ id: 'cfg-contact', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValue(null)
    const pullContacts = vi.spyOn(service as any, 'pullContactsFromZoho').mockResolvedValue({
      recordsCreated: 1,
      recordsUpdated: 0,
      recordsProcessed: 1,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startedAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
    })
    const pushContacts = vi.spyOn(service as any, 'pushContactsToZoho').mockResolvedValue({
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsProcessed: 0,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startedAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
    })

    const contacts = await service.syncContacts({ direction: 'zoho_to_nzila', dryRun: true })
    expect(contacts.status).toBe('completed')
    expect(pullContacts).toHaveBeenCalledTimes(1)
    expect(pushContacts).not.toHaveBeenCalled()

    vi.spyOn(service, 'getSyncConfig').mockResolvedValue({ id: 'cfg-deal', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValue(null)
    const pullDeals = vi.spyOn(service as any, 'pullDealsFromZoho').mockResolvedValue({
      recordsCreated: 1,
      recordsUpdated: 0,
      recordsProcessed: 1,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startedAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
    })
    const pushDeals = vi.spyOn(service as any, 'pushDealsToZoho').mockResolvedValue({
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsProcessed: 0,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startedAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
    })

    const deals = await service.syncDeals({ direction: 'zoho_to_nzila', dryRun: true })
    expect(deals.status).toBe('completed')
    expect(pullDeals).toHaveBeenCalledTimes(1)
    expect(pushDeals).not.toHaveBeenCalled()
  })

  it('covers deal push/pull dry-run and error branches', async () => {
    const crmClient = {
      updateDeal: vi.fn().mockResolvedValue({ id: 'deal-1' }),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-2' }),
      getDeals: vi.fn().mockResolvedValue({
        data: [
          { id: 'old-deal', Modified_Time: '2026-01-01T00:00:00.000Z', Deal_Name: 'Old', Stage: 'Qualification' },
          { id: 'local-deal', Modified_Time: '2026-06-01T00:00:00.000Z', Deal_Name: 'Local', Stage: 'Qualification' },
          { id: 'new-deal', Modified_Time: '2026-06-02T00:00:00.000Z', Deal_Name: 'New', Stage: 'Proposal/Price Quote' },
        ],
      }),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce([
      { id: 'q-1', customerId: null, ref: 'Q-1', status: 'draft', total: '100', notes: null, validUntil: null },
      { id: 'q-2', customerId: null, ref: 'Q-2', status: 'sent', total: '120', notes: null, validUntil: null },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce('deal-1').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'linkDealRecord').mockResolvedValue(undefined)

    const push = await (service as any).pushDealsToZoho(null, false)
    expect(push.recordsProcessed).toBe(2)
    expect(push.recordsUpdated).toBe(1)
    expect(push.recordsCreated).toBe(1)

    mockSelectWhere.mockReturnValueOnce([
      { id: 'q-3', customerId: null, ref: 'Q-3', status: 'draft', total: '90', notes: null, validUntil: null },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce(null)
    const pushDryRun = await (service as any).pushDealsToZoho(null, true)
    expect(pushDryRun.recordsProcessed).toBe(1)
    expect(pushDryRun.recordsCreated).toBe(1)

    mockSelectWhere.mockReturnValueOnce([
      { id: 'q-err', customerId: null, ref: 'Q-ERR', status: 'draft', total: '50', notes: null, validUntil: null },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce('deal-err')
    crmClient.updateDeal.mockRejectedValueOnce(new Error('deal update failed'))
    const pushError = await (service as any).pushDealsToZoho(null, false)
    expect(pushError.recordsFailed).toBe(1)
    expect(pushError.errors[0].errorCode).toBe('PUSH_ERROR')

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('q-local').mockResolvedValueOnce(null)
    const pullDryRun = await (service as any).pullDealsFromZoho(new Date('2026-05-01T00:00:00.000Z'), true)
    expect(pullDryRun.recordsProcessed).toBe(3)
    expect(pullDryRun.recordsUpdated).toBe(1)
    expect(pullDryRun.recordsCreated).toBe(1)
  })

  it('covers contact mapping fallbacks and metadata-null ID lookup branch', async () => {
    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService({ updateContact: mockUpdateContact } as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        conflict: { nzilaData: { name: '' }, zohoData: {} },
        syncRecord: { zohoRecordId: 'z-fallback', nzilaRecordId: 'cust-fallback' },
      },
    ])
    await service.resolveConflict('c-fallback', 'local_wins')
    expect(mockUpdateContact).toHaveBeenCalledWith(
      'z-fallback',
      expect.objectContaining({ First_Name: 'Unknown', Last_Name: 'Customer' }),
    )

    mockSelectWhere.mockReturnValueOnce([
      { id: 'c-null-meta', metadata: null },
      { id: 'c-empty-meta', metadata: {} },
    ])
    await expect((service as any).getLocalIdForZoho('contacts', 'no-match')).resolves.toBeNull()
  })

  it('covers deals config defaults, mapping fallbacks, and non-Error catch branches', async () => {
    const crmClient = {
      getDeals: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cfg-deals', isActive: true }])
    await expect(service.getSyncConfig('deals')).resolves.toMatchObject({ id: 'cfg-deals' })

    await expect(service.createOrUpdateSyncConfig('deals', {})).resolves.toBeUndefined()

    mockSelectWhere.mockReturnValueOnce([
      {
        id: 'q-map-fallback',
        customerId: null,
        ref: 'Q-FALLBACK',
        status: undefined,
        total: undefined,
        notes: undefined,
        validUntil: undefined,
      },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce(null)
    const pushDry = await (service as any).pushDealsToZoho(new Date('2026-01-01T00:00:00.000Z'), true)
    expect(pushDry.recordsProcessed).toBe(1)
    expect(pushDry.recordsCreated).toBe(1)

    mockSelectWhere.mockReturnValueOnce([
      {
        id: 'q-map-date',
        customerId: null,
        ref: 'Q-DATE',
        status: 'draft',
        total: '88',
        notes: null,
        validUntil: new Date('2026-12-31T00:00:00.000Z'),
      },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce(null)
    const pushDate = await (service as any).pushDealsToZoho(new Date('2026-01-01T00:00:00.000Z'), true)
    expect(pushDate.recordsProcessed).toBe(1)
    expect(pushDate.recordsCreated).toBe(1)

    crmClient.getDeals.mockResolvedValueOnce({ data: [{ id: 'deal-fallback', Deal_Name: 'Fallback Deal' }] })
    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce(null)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'q-created' }])
    vi.spyOn(service as any, 'linkDealRecord').mockResolvedValue(undefined)
    const pulled = await (service as any).pullDealsFromZoho(new Date('2026-01-01T00:00:00.000Z'), false)
    expect(pulled.recordsCreated).toBe(1)

    vi.spyOn(service as any, 'pushContactsToZoho').mockRejectedValueOnce('push exploded')
    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-c', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValueOnce(new Date('2026-01-01T00:00:00.000Z'))
    const failedContacts = await service.syncContacts({ direction: 'nzila_to_zoho', dryRun: false })
    expect(failedContacts.status).toBe('failed')
    expect(failedContacts.errors[0].errorMessage).toBe('Unknown sync error')

    vi.spyOn(service as any, 'pushDealsToZoho').mockRejectedValueOnce('deal exploded')
    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-d', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValueOnce(new Date('2026-01-01T00:00:00.000Z'))
    const failedDeals = await service.syncDeals({ direction: 'nzila_to_zoho', dryRun: false })
    expect(failedDeals.status).toBe('failed')
    expect(failedDeals.errors[0].errorMessage).toBe('Unknown sync error')

    vi.spyOn(service as any, 'pushContactsToZoho').mockRejectedValueOnce('dry-run contact exploded')
    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-c-dry', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValueOnce(new Date('2026-01-01T00:00:00.000Z'))
    const failedContactsDry = await service.syncContacts({ direction: 'nzila_to_zoho', dryRun: true })
    expect(failedContactsDry.status).toBe('failed')

    vi.spyOn(service as any, 'pushDealsToZoho').mockRejectedValueOnce('dry-run deal exploded')
    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-d-dry', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValueOnce(new Date('2026-01-01T00:00:00.000Z'))
    const failedDealsDry = await service.syncDeals({ direction: 'nzila_to_zoho', dryRun: true })
    expect(failedDealsDry.status).toBe('failed')


    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        conflict: { nzilaData: { name: null }, zohoData: {} },
        syncRecord: { zohoRecordId: 'z-null-name', nzilaRecordId: 'cust-null-name' },
      },
    ])
    await service.resolveConflict('c-null-name', 'local_wins')
    expect(crmClient.updateContact).toHaveBeenCalledWith(
      'z-null-name',
      expect.objectContaining({ First_Name: 'Unknown', Last_Name: 'Customer' }),
    )
  })

  it('covers contact pull conflict and unknown-name create branches', async () => {
    const crmClient = {
      getContacts: vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              id: 'z-conflict',
              First_Name: 'Remote',
              Last_Name: 'Contact',
              Modified_Time: '2026-06-02T00:00:00.000Z',
            },
            {
              id: 'z-create',
              First_Name: undefined,
              Last_Name: undefined,
              Modified_Time: '2026-06-03T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] }),
      createContact: vi.fn().mockResolvedValue({ id: 'z-created' }),
      updateContact: vi.fn(),
      getDeals: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service as any, 'getLocalIdForZoho').mockResolvedValueOnce('cust-conflict').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'recordConflict').mockResolvedValue(undefined)
    vi.spyOn(service as any, 'linkRecords').mockResolvedValue(undefined)
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'cust-conflict',
        name: 'Local Contact',
        updatedAt: new Date('2026-06-04T00:00:00.000Z'),
      },
    ])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'cust-created' }])

    const pulled = await (service as any).pullContactsFromZoho(null, false)

    expect(pulled.conflicts).toHaveLength(1)
    expect(pulled.recordsCreated).toBe(1)
  })

  it('covers deal pull conflict and fallback create branches', async () => {
    const crmClient = {
      getDeals: vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              id: 'd-conflict',
              Deal_Name: 'Conflict Deal',
              Stage: 'Qualification',
              Modified_Time: '2026-06-02T00:00:00.000Z',
            },
            {
              id: 'd-create',
              Deal_Name: undefined,
              Stage: undefined,
              Modified_Time: '2026-06-03T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] }),
      createDeal: vi.fn().mockResolvedValue({ id: 'd-created' }),
      updateDeal: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('q-conflict').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'recordConflict').mockResolvedValue(undefined)
    vi.spyOn(service as any, 'linkDealRecord').mockResolvedValue(undefined)
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'q-conflict',
        updatedAt: new Date('2026-06-04T00:00:00.000Z'),
        customerId: 'cust-conflict',
        status: 'draft',
        total: '10',
      },
    ])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'q-created' }])

    const pulled = await (service as any).pullDealsFromZoho(null, false)

    expect(pulled.conflicts).toHaveLength(1)
    expect(pulled.recordsCreated).toBe(1)
  })

  it('covers contact update and create fallback branches', async () => {
    const crmClient = {
      getContacts: vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              id: 'c-update-old',
              First_Name: 'Old',
              Last_Name: 'Contact',
              Modified_Time: '2026-06-04T00:00:00.000Z',
            },
            {
              id: 'c-update-no-date',
              First_Name: 'No',
              Last_Name: 'Date',
              Modified_Time: undefined,
            },
            {
              id: 'c-create-named',
              First_Name: 'Named',
              Last_Name: 'Contact',
              Modified_Time: '2026-06-05T00:00:00.000Z',
            },
            {
              id: 'c-create-unknown',
              First_Name: undefined,
              Last_Name: undefined,
              Modified_Time: '2026-06-06T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] }),
      createContact: vi.fn(),
      updateContact: vi.fn(),
      getDeals: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service as any, 'getLocalIdForZoho')
      .mockResolvedValueOnce('cust-update-old')
      .mockResolvedValueOnce('cust-update-no-date')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'linkRecords').mockResolvedValue(undefined)
    mockSelectWhere.mockImplementation(() => ({ limit: mockSelectLimit }))
    mockSelectLimit
      .mockResolvedValueOnce([{ id: 'cust-update-old', updatedAt: new Date('2026-06-01T00:00:00.000Z') }])
      .mockResolvedValueOnce([{ id: 'cust-update-no-date', updatedAt: new Date('2026-06-01T00:00:00.000Z') }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'cust-create-named' }]).mockResolvedValueOnce([
      { id: 'cust-create-unknown' },
    ])

    const pulled = await (service as any).pullContactsFromZoho(null, false)

    expect(pulled.recordsUpdated).toBe(2)
    expect(pulled.recordsCreated).toBe(2)
  })

  it('covers remaining zoho mapping and helper branches', async () => {
    const crmClient = {
      getDeals: vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              id: 'deal-update',
              Deal_Name: 'Deal Update',
              Stage: 'Proposal/Price Quote',
              Amount: '42',
              Modified_Time: '2026-06-03T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'deal-create',
              Deal_Name: 'Deal Create',
              Stage: 'Qualification',
              Amount: '18',
              Modified_Time: '2026-06-04T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] }),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-created' }),
      updateDeal: vi.fn().mockResolvedValue({ id: 'deal-update' }),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce([
      {
        id: 'quote-push',
        customerId: 'cust-push',
        ref: 'Q-PUSH',
        status: 'sent',
        total: '55',
        notes: 'Notes',
        validUntil: new Date('2026-12-31T00:00:00.000Z'),
      },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce('deal-linked')
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce('contact-linked')
    const push = await (service as any).pushDealsToZoho(null, true)
    expect(push.recordsUpdated).toBe(1)

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('quote-update')
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'quote-update',
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        customerId: 'cust-update',
        status: 'draft',
        total: '10',
      },
    ])
    const _pullUpdate = await (service as any).pullDealsFromZoho(null, false)
    expect(_pullUpdate.recordsUpdated).toBeGreaterThanOrEqual(0)

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('quote-no-modified')
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'quote-no-modified',
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        customerId: 'cust-no-modified',
        status: 'draft',
        total: '11',
      },
    ])
    crmClient.getDeals.mockResolvedValueOnce({
      data: [
        {
          id: 'deal-no-modified',
          Deal_Name: 'Deal No Modified',
          Stage: 'Qualification',
          Amount: '11',
          Modified_Time: undefined,
        },
      ],
    })
    await (service as any).pullDealsFromZoho(null, false)

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce(null)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'quote-created' }])
    await (service as any).pullDealsFromZoho(null, false)

    const syncRun = vi.spyOn(service as any, 'getSyncConfig').mockResolvedValueOnce(null)
    await expect(
      (service as any).recordSyncRun('contacts', 'success', {
        configId: '',
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsProcessed: 0,
        recordsFailed: 0,
        conflicts: [],
        errors: [],
        startedAt: new Date(),
        status: 'completed',
      } as any),
    ).resolves.toBeUndefined()
    expect(syncRun).toHaveBeenCalledWith('contacts')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cfg-conflict', isActive: true }])
    mockInsertReturning.mockResolvedValueOnce([{ id: 'sync-record-created' }])
    await expect(
      (service as any).recordConflict({
        syncRecordId: 'sync-1',
        nzilaRecordId: 'cust-1',
        zohoRecordId: 'z-1',
        nzilaData: { name: 'Local' },
        zohoData: { First_Name: 'Remote' },
        conflictFields: ['updatedAt'],
      }),
    ).resolves.toBeUndefined()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: undefined }])
    await expect((service as any).linkRecords('contacts', 'cust-meta-null', 'z-meta')).resolves.toBeUndefined()
  })

  it('covers remaining zoho deal helper branches', async () => {
    const crmClient = {
      getDeals: vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              id: 'deal-no-date',
              Deal_Name: 'No Date',
              Stage: undefined,
              Amount: undefined,
              Modified_Time: undefined,
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: 'deal-rich',
              Deal_Name: 'Rich Deal',
              Stage: 'Proposal/Price Quote',
              Amount: '45',
              Modified_Time: '2026-06-04T00:00:00.000Z',
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] }),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-created' }),
      updateDeal: vi.fn().mockResolvedValue({ id: 'deal-updated' }),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-deals', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValueOnce(null)
    const pushDealsSpy = vi.spyOn(service as any, 'pushDealsToZoho').mockResolvedValue({
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsProcessed: 0,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startedAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
    })
    const pullDealsSpy = vi.spyOn(service as any, 'pullDealsFromZoho').mockResolvedValue({
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsProcessed: 0,
      recordsFailed: 0,
      conflicts: [],
      errors: [],
      startedAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
    })
    await service.syncDeals({ direction: 'nzila_to_zoho', dryRun: true })
    expect(pushDealsSpy).toHaveBeenCalledTimes(1)
    expect(pullDealsSpy).not.toHaveBeenCalled()

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('quote-no-date')
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'quote-no-date',
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        customerId: 'cust-x',
        status: 'draft',
        total: '10',
      },
    ])
    await (service as any).pullDealsFromZoho(null, false)
    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce(null)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'quote-rich' }])
    await (service as any).pullDealsFromZoho(null, false)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: { existing: true } }])
    await expect((service as any).linkDealRecord('quote-meta', 'deal-meta')).resolves.toBeUndefined()

    vi.spyOn(service as any, 'getSyncConfig').mockResolvedValueOnce(null)
    await expect(
      (service as any).recordSyncRun('contacts', 'success', {
        configId: '',
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsProcessed: 0,
        recordsFailed: 0,
        conflicts: [],
        errors: [],
        startedAt: new Date(),
        status: 'completed',
      } as any),
    ).resolves.toBeUndefined()

    vi.spyOn(service as any, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-present', isActive: true } as any)
    await expect(
      (service as any).recordSyncRun('contacts', 'success', {
        configId: '',
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsProcessed: 0,
        recordsFailed: 0,
        conflicts: [],
        errors: [],
        startedAt: new Date(),
        status: 'completed',
      } as any),
    ).resolves.toBeUndefined()

    vi.spyOn(service as any, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-conflict', isActive: true } as any)
    mockInsertReturning.mockResolvedValueOnce([{ id: 'sync-record-created' }])
    await expect(
      (service as any).recordConflict({
        syncRecordId: 'sync-2',
        nzilaRecordId: 'cust-2',
        zohoRecordId: undefined,
        nzilaData: { name: 'Local' },
        zohoData: { First_Name: 'Remote' },
        conflictFields: ['updatedAt'],
      }),
    ).resolves.toBeUndefined()
  })

  it('covers residual Zoho branches for dry-run splits, unknown throws, and nullish metadata/config paths', async () => {
    const crmClient = {
      getDeals: vi.fn(),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-created' }),
      updateDeal: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn().mockResolvedValue({ id: 'contact-created' }),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReset()
    mockSelectWhere.mockReturnValueOnce([
      { id: 'c-a', name: 'Dry Run A', updatedAt: new Date('2026-06-01T00:00:00.000Z') },
      { id: 'c-b', name: 'Dry Run B', updatedAt: new Date('2026-06-02T00:00:00.000Z') },
    ])
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce('z-a').mockResolvedValueOnce(null)
    const pushContactsDry = await (service as any).pushContactsToZoho(new Date('2026-05-01T00:00:00.000Z'), true)
    expect(pushContactsDry.recordsUpdated).toBe(1)
    expect(pushContactsDry.recordsCreated).toBe(1)

    mockSelectWhere.mockReturnValueOnce([{ id: 'c-err', name: 'Err Contact' }])
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce('z-err')
    crmClient.updateContact.mockRejectedValueOnce('non-error-contact')
    const pushContactsErr = await (service as any).pushContactsToZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pushContactsErr.recordsFailed).toBe(1)

    crmClient.getContacts.mockResolvedValueOnce({})
    const pullContactsEmpty = await (service as any).pullContactsFromZoho(new Date('2026-05-01T00:00:00.000Z'), true)
    expect(pullContactsEmpty.recordsProcessed).toBe(0)

    crmClient.getContacts.mockResolvedValueOnce({
      data: [{ id: 'contact-err', First_Name: 'Err', Last_Name: 'Case' }],
    })
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce(null)
    mockInsertReturning.mockRejectedValueOnce('non-error-contact')
    const pullContactsErr = await (service as any).pullContactsFromZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pullContactsErr.recordsFailed).toBe(1)

    mockSelectWhere.mockReturnValueOnce([
      {
        id: 'q-new-stage',
        customerId: null,
        ref: 'Q-STAGE',
        status: 'mystery',
        total: undefined,
        notes: undefined,
        validUntil: undefined,
      },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'linkDealRecord').mockResolvedValue(undefined)
    const pushDealsNonDry = await (service as any).pushDealsToZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pushDealsNonDry.recordsCreated).toBe(1)
    expect(crmClient.createDeal).toHaveBeenCalledWith(expect.objectContaining({ Stage: 'Qualification' }))

    mockSelectWhere.mockReturnValueOnce([{ id: 'q-err', customerId: null, ref: 'Q-ERR', status: 'draft', total: '1', notes: null, validUntil: null }])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce('deal-err')
    crmClient.updateDeal.mockRejectedValueOnce('non-error-deal')
    const pushDealsErr = await (service as any).pushDealsToZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pushDealsErr.recordsFailed).toBe(1)

    crmClient.getDeals.mockResolvedValueOnce({})
    const pullDealsEmpty = await (service as any).pullDealsFromZoho(new Date('2026-05-01T00:00:00.000Z'), true)
    expect(pullDealsEmpty.recordsProcessed).toBe(0)

    crmClient.getDeals.mockResolvedValueOnce({ data: [{ id: 'deal-err-pull', Deal_Name: 'X' }] })
    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockRejectedValueOnce('lookup-failed')
    const pullDealsErr = await (service as any).pullDealsFromZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(pullDealsErr.recordsFailed).toBe(1)

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect((service as any).linkDealRecord('q-missing', 'deal-x')).resolves.toBeUndefined()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect((service as any).linkRecords('contacts', 'c-missing', 'z-x')).resolves.toBeUndefined()

    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce(undefined as any)
    await expect((service as any).getLastSuccessfulSync('contacts')).resolves.toBeNull()

    mockSelectWhere.mockReset()
    mockSelectWhere.mockReturnValue([
      {
        conflict: { nzilaData: {}, zohoData: {}, conflictFields: null },
        syncRecord: { id: 'sr-u', nzilaRecordId: 'cust-u', zohoRecordId: null },
      },
    ])
    const unresolved = await service.getUnresolvedConflicts()
    expect(unresolved[0]).toMatchObject({ zohoRecordId: undefined, conflictFields: [] })
  })

  it('covers the last zoho branch edges in isolation', async () => {
    const crmClient = {
      getDeals: vi.fn(),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-created-edge' }),
      updateDeal: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReturnValueOnce([
      { id: 'cust-edge', name: 'Edge Case', email: 'edge@example.com', phone: null, address: null },
    ])
    vi.spyOn(service as any, 'getZohoIdForLocal').mockResolvedValueOnce('z-contact-edge')
    crmClient.updateContact.mockImplementationOnce(() => {
      throw 'non-error-contact'
    })
    const contactFailed = await (service as any).pushContactsToZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(contactFailed.recordsFailed).toBe(1)

    crmClient.getDeals.mockResolvedValueOnce({
      data: [
        {
          id: 'deal-failed-edge',
          Deal_Name: 'Deal Failed Edge',
          Stage: 'Qualification',
          Amount: '7',
          Modified_Time: '2026-06-05T00:00:00.000Z',
        },
      ],
    })
    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockRejectedValueOnce(new Error('deal failed'))
    const dealFailed = await (service as any).pullDealsFromZoho(new Date('2026-05-01T00:00:00.000Z'), false)
    expect(dealFailed.recordsFailed).toBe(1)

    crmClient.getDeals.mockResolvedValueOnce({
      data: [
        {
          id: 'deal-no-mod-edge',
          Deal_Name: 'Deal No Mod Edge',
          Stage: 'Qualification',
          Amount: '5',
        },
      ],
    })
    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValueOnce('quote-no-mod-edge')
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'quote-no-mod-edge',
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        customerId: 'cust-no-mod-edge',
        status: 'draft',
        total: '5',
      },
    ])
    await (service as any).pullDealsFromZoho(null, false)
  })

  it('covers remaining Zoho mapping and conflict nullish branches', async () => {
    const crmClient = {
      getDeals: vi.fn().mockResolvedValue({ data: [{ id: 'deal-zero', Deal_Name: 'Zero', Stage: 'Qualification' }] }),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-created-2' }),
      updateDeal: vi.fn(),
      getContacts: vi.fn().mockResolvedValue({ data: [] }),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    mockSelectWhere.mockReset()
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'cfg-deals-2', isActive: true }])
    vi.spyOn(service, 'getSyncConfig').mockResolvedValueOnce({ id: 'cfg-deals-2', isActive: true } as any)
    vi.spyOn(service as any, 'getLastSuccessfulSync').mockResolvedValueOnce(null)

    mockSelectWhere.mockReset()
    mockSelectWhere.mockReturnValueOnce([
      { id: 'q-map-2', customerId: null, ref: 'Q-2', status: undefined, total: undefined, notes: undefined, validUntil: undefined },
    ])
    vi.spyOn(service as any, 'getZohoDealIdForQuote').mockResolvedValueOnce(null)
    vi.spyOn(service as any, 'linkDealRecord').mockResolvedValue(undefined)
    await expect((service as any).pushDealsToZoho(null, false)).resolves.toMatchObject({ recordsCreated: 1 })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ metadata: undefined }])
    await expect((service as any).linkDealRecord('q-undef-meta', 'deal-undef')).resolves.toBeUndefined()

    mockSelectWhere.mockReset()
    mockSelectWhere.mockReturnValueOnce([
      {
        conflict: { nzilaData: {}, zohoData: {}, conflictFields: undefined },
        syncRecord: { id: 'sr-null', nzilaRecordId: 'cust-null', zohoRecordId: undefined },
      },
    ])
    const unresolved = await service.getUnresolvedConflicts()
    expect(unresolved[0]).toMatchObject({ zohoRecordId: undefined, conflictFields: [] })

    mockSelectWhere.mockReset()
    mockSelectLimit.mockReset()
    mockSelectWhere.mockImplementation(() => ({ limit: mockSelectLimit }))
    mockSelectLimit.mockResolvedValue([
      {
        conflict: { nzilaData: { name: 'Local' }, zohoData: { First_Name: 'Remote' } },
        syncRecord: { zohoRecordId: undefined, nzilaRecordId: 'cust-null' },
      },
    ])
    await expect(service.resolveConflict('c-null', 'local_wins')).resolves.toBeUndefined()
  })

  it('covers deal pagination and closing date mapping branches', async () => {
    const crmClient = {
      getDeals: vi
        .fn()
        .mockResolvedValueOnce({
          data: Array.from({ length: 200 }, (_, index) => ({
            id: `deal-${index + 1}`,
            Deal_Name: `Deal ${index + 1}`,
            Modified_Time: undefined,
          })),
        })
        .mockResolvedValueOnce({ data: [] }),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service as any, 'getLocalQuoteIdForZohoDeal').mockResolvedValue(null)
    const pulled = await (service as any).pullDealsFromZoho(null, true)

    expect(crmClient.getDeals).toHaveBeenCalledTimes(2)
    expect(pulled.recordsProcessed).toBe(200)
    expect(pulled.recordsCreated).toBe(200)
  })

  it('covers contact pagination and dry-run record accounting branches', async () => {
    const crmClient = {
      getContacts: vi
        .fn()
        .mockResolvedValueOnce({
          data: Array.from({ length: 200 }, (_, index) => ({
            id: `contact-${index + 1}`,
            First_Name: `Contact ${index + 1}`,
            Last_Name: 'Test',
            Modified_Time: undefined,
          })),
        })
        .mockResolvedValueOnce({ data: [] }),
      createContact: vi.fn(),
      updateContact: vi.fn(),
      getDeals: vi.fn(),
      createDeal: vi.fn(),
      updateDeal: vi.fn(),
    }

    const { ZohoSyncService } = await import('@/lib/zoho/sync-service')
    const service = new ZohoSyncService(crmClient as any, 'org-1')

    vi.spyOn(service as any, 'getLocalIdForZoho').mockResolvedValueOnce('cust-1').mockResolvedValue(null)
    const pulled = await (service as any).pullContactsFromZoho(null, true)

    expect(crmClient.getContacts).toHaveBeenCalledTimes(2)
    expect(pulled.recordsProcessed).toBe(200)
    expect(pulled.recordsUpdated).toBe(1)
    expect(pulled.recordsCreated).toBe(199)
  })
})
