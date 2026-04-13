import { describe, it, expect } from 'vitest'
import {
  createPublicRouteMatcher,
  COMMON_PUBLIC_ROUTES,
  resolveOrgFromHeader,
  resolveCorrelationId,
  createPlatformHeaders,
} from './middleware'

describe('createPublicRouteMatcher', () => {
  it('matches an exact string pattern', () => {
    const isPublic = createPublicRouteMatcher(['/api/health'])
    expect(isPublic('/api/health')).toBe(true)
    expect(isPublic('/api/secret')).toBe(false)
  })

  it('matches simple glob wildcard with *', () => {
    const isPublic = createPublicRouteMatcher(['/api/*'])
    expect(isPublic('/api/health')).toBe(true)
    expect(isPublic('/api/users/me')).toBe(true)
    expect(isPublic('/dashboard')).toBe(false)
  })

  it('matches RegExp patterns', () => {
    const isPublic = createPublicRouteMatcher([/^\/public\//])
    expect(isPublic('/public/image.png')).toBe(true)
    expect(isPublic('/private/doc.pdf')).toBe(false)
  })

  it('matches any of multiple patterns', () => {
    const isPublic = createPublicRouteMatcher(['/api/*', '/api/health'])
    expect(isPublic('/api/health')).toBe(true)
    expect(isPublic('/api/users')).toBe(true)
    expect(isPublic('/dashboard')).toBe(false)
  })

  it('COMMON_PUBLIC_ROUTES includes /api/health and /favicon.ico', () => {
    const isPublic = createPublicRouteMatcher(COMMON_PUBLIC_ROUTES)
    expect(isPublic('/api/health')).toBe(true)
    expect(isPublic('/favicon.ico')).toBe(true)
    expect(isPublic('/dashboard')).toBe(false)
  })
})

describe('resolveOrgFromHeader', () => {
  it('returns org ID from x-org-id header', () => {
    const headers = new Headers({ 'x-org-id': 'org-123' })
    expect(resolveOrgFromHeader(headers)).toBe('org-123')
  })

  it('returns undefined when header is missing', () => {
    const headers = new Headers()
    expect(resolveOrgFromHeader(headers)).toBeUndefined()
  })
})

describe('resolveCorrelationId', () => {
  it('returns x-correlation-id when present', () => {
    const headers = new Headers({ 'x-correlation-id': 'corr-abc' })
    expect(resolveCorrelationId(headers)).toBe('corr-abc')
  })

  it('falls back to x-request-id', () => {
    const headers = new Headers({ 'x-request-id': 'req-xyz' })
    expect(resolveCorrelationId(headers)).toBe('req-xyz')
  })

  it('generates a UUID when no header is set', () => {
    const headers = new Headers()
    const id = resolveCorrelationId(headers)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})

describe('createPlatformHeaders', () => {
  it('includes orgId when provided', () => {
    const headers = createPlatformHeaders({ orgId: 'org-1' })
    expect(headers['x-org-id']).toBe('org-1')
  })

  it('includes correlationId when provided', () => {
    const headers = createPlatformHeaders({ correlationId: 'corr-1' })
    expect(headers['x-correlation-id']).toBe('corr-1')
  })

  it('includes moduleId and actorId when provided', () => {
    const headers = createPlatformHeaders({ moduleId: 'flow', actorId: 'user-1' })
    expect(headers['x-module-id']).toBe('flow')
    expect(headers['x-actor-id']).toBe('user-1')
  })

  it('omits keys not provided', () => {
    const headers = createPlatformHeaders({})
    expect(Object.keys(headers)).toHaveLength(0)
  })

  it('returns all headers when all keys provided', () => {
    const headers = createPlatformHeaders({
      orgId: 'org-1',
      correlationId: 'corr-1',
      moduleId: 'flow',
      actorId: 'user-1',
    })
    expect(Object.keys(headers)).toHaveLength(4)
  })
})
