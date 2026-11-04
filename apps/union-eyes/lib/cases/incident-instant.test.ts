import { describe, expect, it } from 'vitest'
import { incidentInstant } from './incident-instant'

/** The calendar day a reader in a time zone is shown for an instant. */
const dayIn = (instant: Date, timeZone: string): string => new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(instant)

describe('the instant an incident date is stored as', () => {
  it('shows the day that was typed in every time zone a Canadian reader, or one abroad, is in', () => {
    const stored = incidentInstant('2026-01-15')
    for (const zone of ['America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'Pacific/Honolulu', 'Europe/Paris', 'Asia/Tokyo']) {
      expect(dayIn(stored, zone), zone).toBe('2026-01-15')
    }
  })

  it('is what a plain Date of the day is not: midnight UTC is the evening before west of Greenwich', () => {
    expect(dayIn(new Date('2026-01-15'), 'America/Toronto')).toBe('2026-01-14')
    expect(dayIn(incidentInstant('2026-01-15'), 'America/Toronto')).toBe('2026-01-15')
  })

  it('keeps a value that carries a time as the instant it states', () => {
    expect(incidentInstant('2026-01-15T22:30:00-05:00').toISOString()).toBe('2026-01-16T03:30:00.000Z')
    expect(incidentInstant('2026-01-15T14:00:00.000Z').toISOString()).toBe('2026-01-15T14:00:00.000Z')
  })

  it('stays invalid for what is not a date, so a validator can still refuse it', () => {
    expect(Number.isNaN(incidentInstant('not a date').getTime())).toBe(true)
  })
})
