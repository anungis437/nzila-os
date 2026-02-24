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

import { auditLog } from './audit'

describe('auditLog', () => {
  afterEach(() => {
    mockInfo.mockClear()
  })

  it('logs an audit event with provided fields', () => {
    auditLog({
      userId: 'user-1',
      action: 'create',
      resource: 'document',
    })

    expect(mockInfo).toHaveBeenCalledOnce()
    const args = mockInfo.mock.calls[0]
    expect(args[0]).toBe('[AUDIT][LEGACY]')
    const entry = JSON.parse(args[1].detail)
    expect(entry.userId).toBe('user-1')
    expect(entry.action).toBe('create')
    expect(entry.resource).toBe('document')
    expect(entry.timestamp).toBeDefined()
  })

  it('uses provided timestamp when given', () => {
    const ts = '2024-01-01T00:00:00.000Z'
    auditLog({
      userId: 'user-2',
      action: 'delete',
      resource: 'file',
      timestamp: ts,
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)
    expect(entry.timestamp).toBe(ts)
  })

  it('generates a timestamp when not provided', () => {
    auditLog({
      userId: null,
      action: 'view',
      resource: 'dashboard',
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('includes optional metadata', () => {
    auditLog({
      userId: 'user-3',
      action: 'update',
      resource: 'settings',
      metadata: { key: 'theme', value: 'dark' },
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)
    expect(entry.metadata).toEqual({ key: 'theme', value: 'dark' })
  })

  it('handles null userId', () => {
    auditLog({
      userId: null,
      action: 'anonymous-visit',
      resource: 'homepage',
    })

    const meta = mockInfo.mock.calls[0][1]
    const entry = JSON.parse(meta.detail)
    expect(entry.userId).toBeNull()
  })
})
