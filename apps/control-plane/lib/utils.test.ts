import { describe, it, expect } from 'vitest'
import { cn, formatRelativeTime, formatDateTime } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('merges tailwind conflicts', () => {
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })
})

describe('formatRelativeTime', () => {
  it('returns minutes ago for < 60 min', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours ago for < 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago for >= 24 hours', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })
})

describe('formatDateTime', () => {
  it('formats an ISO date string in human-readable form', () => {
    const iso = '2024-01-15T14:30:00.000Z'
    const result = formatDateTime(iso)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
