import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock DB to avoid requiring DATABASE_URL at import time
vi.mock('@nzila/db', () => ({ db: {} }))
vi.mock('@nzila/db/schema', () => ({ auditEvents: {} }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), desc: vi.fn(), sql: vi.fn(), asc: vi.fn(),
}))

import { auditLog } from '../audit'

describe('auditLog', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  afterEach(() => {
    logSpy.mockClear()
  })

  it('logs an audit event with [AUDIT] prefix', () => {
    auditLog({
      userId: 'user-1',
      action: 'login',
      resource: '/dashboard',
    })

    expect(logSpy).toHaveBeenCalledOnce()
    expect(logSpy).toHaveBeenCalledWith(
      '[AUDIT][LEGACY]',
      expect.stringContaining('"userId":"user-1"'),
    )
  })

  it('includes all required fields in the log entry', () => {
    auditLog({
      userId: 'user-2',
      action: 'update',
      resource: '/settings',
    })

    const loggedJson = logSpy.mock.calls[0][1]
    const entry = JSON.parse(loggedJson)

    expect(entry.userId).toBe('user-2')
    expect(entry.action).toBe('update')
    expect(entry.resource).toBe('/settings')
    expect(entry.timestamp).toBeDefined()
  })

  it('uses provided timestamp when given', () => {
    const fixedTimestamp = '2025-01-01T00:00:00.000Z'
    auditLog({
      userId: 'user-3',
      action: 'read',
      resource: '/docs',
      timestamp: fixedTimestamp,
    })

    const loggedJson = logSpy.mock.calls[0][1]
    const entry = JSON.parse(loggedJson)

    expect(entry.timestamp).toBe(fixedTimestamp)
  })

  it('generates timestamp when not provided', () => {
    auditLog({
      userId: 'user-4',
      action: 'create',
      resource: '/projects',
    })

    const loggedJson = logSpy.mock.calls[0][1]
    const entry = JSON.parse(loggedJson)

    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('includes optional metadata', () => {
    auditLog({
      userId: 'user-5',
      action: 'delete',
      resource: '/projects/abc',
      metadata: { projectId: 'abc', reason: 'cleanup' },
    })

    const loggedJson = logSpy.mock.calls[0][1]
    const entry = JSON.parse(loggedJson)

    expect(entry.metadata).toEqual({ projectId: 'abc', reason: 'cleanup' })
  })

  it('handles null userId', () => {
    auditLog({
      userId: null,
      action: 'anonymous-view',
      resource: '/public',
    })

    const loggedJson = logSpy.mock.calls[0][1]
    const entry = JSON.parse(loggedJson)

    expect(entry.userId).toBeNull()
  })
})
