import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock DB to avoid requiring DATABASE_URL at import time
vi.mock('@nzila/db', () => ({ db: {} }))
vi.mock('@nzila/db/schema', () => ({ auditEvents: {} }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), desc: vi.fn(), sql: vi.fn(), asc: vi.fn(),
}))

// Mock @nzila/os-core logger to capture log calls
const { mockInfo } = vi.hoisted(() => ({ mockInfo: vi.fn() }))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: mockInfo,
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { auditLog } from '../audit'

describe('auditLog', () => {
  afterEach(() => {
    mockInfo.mockClear()
  })

  it('logs an audit event with [AUDIT][LEGACY] prefix', () => {
    auditLog({
      userId: 'user-1',
      action: 'login',
      resource: '/dashboard',
    })

    expect(mockInfo).toHaveBeenCalledOnce()
    expect(mockInfo).toHaveBeenCalledWith(
      '[AUDIT][LEGACY]',
      expect.objectContaining({
        detail: expect.stringContaining('"userId":"user-1"'),
      }),
    )
  })

  it('includes all required fields in the log entry', () => {
    auditLog({
      userId: 'user-2',
      action: 'update',
      resource: '/settings',
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)

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

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)

    expect(entry.timestamp).toBe(fixedTimestamp)
  })

  it('generates timestamp when not provided', () => {
    auditLog({
      userId: 'user-4',
      action: 'create',
      resource: '/projects',
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)

    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('includes optional metadata', () => {
    auditLog({
      userId: 'user-5',
      action: 'delete',
      resource: '/projects/abc',
      metadata: { projectId: 'abc', reason: 'cleanup' },
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)

    expect(entry.metadata).toEqual({ projectId: 'abc', reason: 'cleanup' })
  })

  it('handles null userId', () => {
    auditLog({
      userId: null,
      action: 'anonymous-view',
      resource: '/public',
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)

    expect(entry.userId).toBeNull()
  })
})
