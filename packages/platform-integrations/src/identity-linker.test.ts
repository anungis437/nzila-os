import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IdentityLinker } from './identity-linker'
import type { IdentityLinkStore } from './identity-linker'
import type { IntegrationAuditHooks } from './audit-hooks'
import type { ExternalIdentityLink } from '@nzila/platform-integrations-types'

const MOCK_LINK: ExternalIdentityLink = {
  id: 'link-1',
  orgId: 'org-1',
  connectionId: 'conn-1',
  entityType: 'case',
  internalId: 'int-case-1',
  externalId: 'ext-case-1',
  externalSystem: 'workday',
  metadataJson: {},
  staleAt: null,
  verifiedAt: null,
  createdAt: '2026-07-15T00:00:00Z',
  updatedAt: '2026-07-15T00:00:00Z',
}

function createMocks() {
  const store: IdentityLinkStore = {
    create: vi.fn(async (input) => ({ ...MOCK_LINK, ...input, id: 'link-new' })),
    getById: vi.fn(async () => null),
    resolve: vi.fn(async () => null),
    resolveInternal: vi.fn(async () => []),
    listByConnection: vi.fn(async () => []),
    listByOrg: vi.fn(async () => []),
    markStale: vi.fn(async () => {}),
    delete: vi.fn(async () => true),
    update: vi.fn(async () => {}),
  }
  const auditHooks: IntegrationAuditHooks = {
    recordIntegrationAction: vi.fn(async () => {}),
  }
  return { store, auditHooks }
}

describe('IdentityLinker', () => {
  let linker: IdentityLinker
  let mocks: ReturnType<typeof createMocks>

  beforeEach(() => {
    mocks = createMocks()
    linker = new IdentityLinker(mocks.store, mocks.auditHooks)
  })

  describe('link', () => {
    it('creates a new identity link', async () => {
      const result = await linker.link(
        {
          orgId: 'org-1',
          connectionId: 'conn-1',
          entityType: 'case',
          internalId: 'int-1',
          externalId: 'ext-1',
          externalSystem: 'workday',
        },
        'actor-1',
      )
      expect(mocks.store.create).toHaveBeenCalledOnce()
      expect(result.id).toBe('link-new')
    })

    it('returns existing link instead of creating duplicate', async () => {
      vi.mocked(mocks.store.resolve).mockResolvedValueOnce(MOCK_LINK)
      const result = await linker.link(
        {
          orgId: 'org-1',
          connectionId: 'conn-1',
          entityType: 'case',
          internalId: 'int-1',
          externalId: 'ext-case-1',
          externalSystem: 'workday',
        },
        'actor-1',
      )
      expect(mocks.store.create).not.toHaveBeenCalled()
      expect(result.id).toBe('link-1')
    })

    it('records audit action on new link', async () => {
      await linker.link(
        {
          orgId: 'org-1',
          connectionId: 'conn-1',
          entityType: 'case',
          internalId: 'int-1',
          externalId: 'ext-1',
          externalSystem: 'workday',
        },
        'actor-1',
      )
      expect(mocks.auditHooks.recordIntegrationAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'identity.linked' }),
      )
    })
  })

  describe('resolve', () => {
    it('returns found result for existing link', async () => {
      vi.mocked(mocks.store.resolve).mockResolvedValueOnce(MOCK_LINK)
      const result = await linker.resolve({
        orgId: 'org-1',
        entityType: 'case',
        externalId: 'ext-case-1',
        externalSystem: 'workday',
      })
      expect(result.found).toBe(true)
      expect(result.internalId).toBe('int-case-1')
      expect(result.stale).toBe(false)
    })

    it('returns not-found for missing link', async () => {
      const result = await linker.resolve({
        orgId: 'org-1',
        entityType: 'case',
        externalId: 'nonexistent',
        externalSystem: 'workday',
      })
      expect(result.found).toBe(false)
      expect(result.internalId).toBeNull()
    })

    it('marks stale link as stale in result', async () => {
      vi.mocked(mocks.store.resolve).mockResolvedValueOnce({
        ...MOCK_LINK,
        staleAt: '2026-07-14T00:00:00Z',
      })
      const result = await linker.resolve({
        orgId: 'org-1',
        entityType: 'case',
        externalId: 'ext-case-1',
        externalSystem: 'workday',
      })
      expect(result.stale).toBe(true)
    })
  })

  describe('unlink', () => {
    it('deletes link and records audit', async () => {
      const result = await linker.unlink('link-1', 'org-1', 'actor-1')
      expect(result).toBe(true)
      expect(mocks.store.delete).toHaveBeenCalledWith('link-1')
      expect(mocks.auditHooks.recordIntegrationAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'identity.unlinked' }),
      )
    })
  })

  describe('markStale', () => {
    it('marks link as stale and records audit', async () => {
      await linker.markStale('link-1', 'org-1', 'actor-1')
      expect(mocks.store.markStale).toHaveBeenCalledWith('link-1')
      expect(mocks.auditHooks.recordIntegrationAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'identity.marked_stale' }),
      )
    })
  })
})
