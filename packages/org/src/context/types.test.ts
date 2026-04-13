import { describe, it, expect } from 'vitest'
import {
  isOrgContext,
  isDbContext,
  toDbContext,
} from './types'
import {
  extractOrgIdFromLegacy,
  normalizeLegacyOrgId,
  detectLegacyFields,
} from './legacy'
import {
  parseOrgContext,
  safeParseOrgContext,
  parseDbContext,
} from './schemas'

describe('isOrgContext', () => {
  it('returns true for a valid OrgContext', () => {
    const ctx = {
      orgId: 'org-1',
      actorId: 'user-1',
      appId: 'web',
      role: 'admin',
      permissions: ['read', 'write'],
      requestId: 'req-1',
    }
    expect(isOrgContext(ctx)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isOrgContext(null)).toBe(false)
  })

  it('returns false for object missing required fields', () => {
    expect(isOrgContext({ orgId: 'org-1' })).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isOrgContext('not-an-object')).toBe(false)
  })
})

describe('isDbContext', () => {
  it('returns true for a valid DbContext', () => {
    const ctx = {
      orgId: 'org-1',
      actorId: 'user-1',
    }
    expect(isDbContext(ctx)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isDbContext(null)).toBe(false)
  })

  it('returns false for missing actorId', () => {
    expect(isDbContext({ orgId: 'org-1' })).toBe(false)
  })
})

describe('toDbContext', () => {
  it('extracts DbContext from OrgContext', () => {
    const ctx = {
      orgId: 'org-1',
      actorId: 'user-1',
      appId: 'web',
      role: 'admin',
      permissions: ['read'],
      requestId: 'req-1',
      correlationId: 'corr-1',
    }

    const db = toDbContext(ctx)

    expect(db.orgId).toBe('org-1')
    expect(db.actorId).toBe('user-1')
    expect(db.correlationId).toBe('corr-1')
    expect((db as unknown as Record<string, unknown>).appId).toBeUndefined()
    expect((db as unknown as Record<string, unknown>).permissions).toBeUndefined()
  })
})

describe('legacy adapters', () => {
  it('extractOrgIdFromLegacy prefers canonical orgId first', () => {
    const orgId = extractOrgIdFromLegacy({
      orgId: 'org-primary',
      organizationId: 'org-secondary',
      tenantId: 'tenant-fallback',
    })

    expect(orgId).toBe('org-primary')
  })

  it('extractOrgIdFromLegacy returns undefined when no identifiers exist', () => {
    expect(extractOrgIdFromLegacy({})).toBeUndefined()
  })

  it('normalizeLegacyOrgId throws when no legacy field is present', () => {
    expect(() => normalizeLegacyOrgId({})).toThrow('Cannot resolve orgId from legacy context')
  })

  it('detectLegacyFields returns only populated legacy fields', () => {
    const detected = detectLegacyFields({
      org_id: 'org-1',
      organizationId: 'org-1',
      tenantId: 'tenant-1',
      workspace_id: 'workspace-1',
      workspaceId: '',
    })

    expect(detected).toEqual(['org_id', 'organizationId', 'tenantId', 'workspace_id'])
  })
})

describe('schema helpers', () => {
  it('parseOrgContext parses valid values', () => {
    const parsed = parseOrgContext({
      orgId: 'org-1',
      actorId: 'user-1',
      role: 'org_admin',
      permissions: ['read'],
      requestId: 'req-1',
    })

    expect(parsed.orgId).toBe('org-1')
  })

  it('safeParseOrgContext returns failure for invalid values', () => {
    const parsed = safeParseOrgContext({
      orgId: '',
      actorId: 'user-1',
      role: 'org_admin',
      permissions: ['read'],
      requestId: 'req-1',
    })

    expect(parsed.success).toBe(false)
  })

  it('parseDbContext parses valid values', () => {
    const parsed = parseDbContext({ orgId: 'org-1', actorId: 'user-1' })
    expect(parsed.actorId).toBe('user-1')
  })

  it('parseDbContext throws for invalid values', () => {
    expect(() => parseDbContext({ orgId: 'org-1' })).toThrow()
  })
})
