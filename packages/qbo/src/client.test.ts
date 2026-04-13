import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQboClient, qboAccounts, qboVendors, qboJournalEntries, type QboClient } from './client'
import type { QboTokenSet } from './types'

// Mock env module
vi.mock('./env', () => ({
  getQboEnv: vi.fn(() => ({
    INTUIT_CLIENT_ID: 'client-123',
    INTUIT_CLIENT_SECRET: 'secret-456',
    INTUIT_REDIRECT_URI: 'https://example.com/callback',
    INTUIT_ENVIRONMENT: 'sandbox' as const,
  })),
}))

const tokenSet: QboTokenSet = {
  access_token: 'access-abc',
  refresh_token: 'refresh-xyz',
  token_type: 'bearer',
  expires_in: 3600,
  x_refresh_token_expires_in: 8726400,
  realmId: 'realm-123',
  created_at: Date.now(),
}

describe('createQboClient', () => {
  let client: QboClient

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    client = createQboClient(tokenSet)
  })

  it('has correct realmId', () => {
    expect(client.realmId).toBe('realm-123')
  })

  describe('query', () => {
    it('queries entities with proper URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ QueryResponse: { Account: [{ Id: '1', Name: 'Test' }] } }),
      } as Response)

      const result = await client.query('Account')
      expect(result).toEqual([{ Id: '1', Name: 'Test' }])
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('query?query='),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer access-abc' }),
        }),
      )
    })

    it('returns empty array when entity key is missing in response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ QueryResponse: {} }),
      } as Response)

      const result = await client.query('Account')
      expect(result).toEqual([])
    })

    it('rejects invalid entity names (injection attempt)', async () => {
      await expect(client.query('Account; DROP TABLE')).rejects.toThrow('Invalid QBO entity name')
    })

    it('throws on API fault response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          Fault: {
            Error: [{ code: '100', Message: 'Bad request', Detail: 'Invalid query' }],
            type: 'ValidationFault',
          },
        }),
      } as unknown as Response)

      await expect(client.query('Account')).rejects.toThrow('QBO API error 400')
    })
  })

  describe('get', () => {
    it('fetches a single entity', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Account: { Id: '42', Name: 'Savings' } }),
      } as Response)

      const result = await client.get('Account', '42')
      expect(result).toEqual({ Id: '42', Name: 'Savings' })
    })
  })

  describe('create', () => {
    it('creates an entity via POST', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Bill: { Id: '99', VendorRef: { value: 'v1' } } }),
      } as Response)

      const result = await client.create('Bill', { VendorRef: { value: 'v1' } })
      expect(result).toEqual({ Id: '99', VendorRef: { value: 'v1' } })
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bill?'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('update', () => {
    it('updates an entity via POST with operation=update', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Account: { Id: '1', Name: 'Updated', SyncToken: '2' } }),
      } as Response)

      const result = await client.update('Account', { Id: '1', SyncToken: '1', Name: 'Updated' })
      expect(result).toEqual({ Id: '1', Name: 'Updated', SyncToken: '2' })
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('operation=update'),
        expect.anything(),
      )
    })
  })

  describe('report', () => {
    it('fetches a financial report', async () => {
      const reportData = { Header: {}, Columns: {}, Rows: {} }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => reportData,
      } as Response)

      const result = await client.report('ProfitAndLoss', { start_date: '2025-01-01' })
      expect(result).toEqual(reportData)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('reports/ProfitAndLoss'),
        expect.anything(),
      )
    })
  })

  describe('throwIfFault — non-JSON error body', () => {
    it('throws with stringified body for non-fault errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('not json') },
        text: async () => 'Internal Server Error',
      } as unknown as Response)

      await expect(client.query('Account')).rejects.toThrow('QBO API error 500')
    })
  })
})

describe('convenience wrappers', () => {
  const mockQbo: QboClient = {
    realmId: 'test-realm',
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    report: vi.fn().mockResolvedValue({}),
  }

  it('qboAccounts.list calls query with Account', async () => {
    await qboAccounts.list(mockQbo)
    expect(mockQbo.query).toHaveBeenCalledWith('Account', '')
  })

  it('qboAccounts.get calls get with Account', async () => {
    await qboAccounts.get(mockQbo, '42')
    expect(mockQbo.get).toHaveBeenCalledWith('Account', '42')
  })

  it('qboVendors.list calls query with Vendor', async () => {
    await qboVendors.list(mockQbo, "WHERE Active = true")
    expect(mockQbo.query).toHaveBeenCalledWith('Vendor', "WHERE Active = true")
  })

  it('qboJournalEntries.create calls create with JournalEntry', async () => {
    await qboJournalEntries.create(mockQbo, {} as any)
    expect(mockQbo.create).toHaveBeenCalledWith('JournalEntry', expect.anything())
  })
})
