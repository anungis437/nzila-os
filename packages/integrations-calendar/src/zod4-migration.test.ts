import { describe, expect, it } from 'vitest'
import { googleCalendarSchema, googleEventSchema } from './google'
import { graphEventSchema } from './outlook'

describe('Zod 4 calendar boundary compatibility', () => {
  it('retains defaults for Google events and optional fields', () => {
    const parsed = googleEventSchema.parse({ id: 'evt', start: { date: '2026-11-02' }, end: { date: '2026-11-03' } })
    expect(parsed.summary).toBe('(No Title)')
    expect(parsed.attendees).toBeUndefined()
    expect(googleCalendarSchema.safeParse({ id: 'cal', summary: 'Shared' }).success).toBe(true)
  })

  it('rejects malformed nested event payloads', () => {
    expect(googleEventSchema.safeParse({ id: 'evt', start: { date: 42 }, end: {} }).success).toBe(false)
    expect(googleEventSchema.safeParse({ id: 'evt', start: {}, end: {}, attendees: [{ email: 12, responseStatus: 'accepted' }] }).success).toBe(false)
    expect(graphEventSchema.safeParse({ id: 'evt', start: null }).success).toBe(false)
  })
})
