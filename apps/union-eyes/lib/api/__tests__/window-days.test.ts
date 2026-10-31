import { describe, expect, it } from 'vitest'
import { parseWindowDays } from '../window-days'

// DEF-0B5-COGNITION-KPI window parameter: Number('abc') was NaN and reached the date arithmetic and the SQL.
describe('parseWindowDays', () => {
  it('uses the default when no window is given', () => expect(parseWindowDays(null)).toBe(30))
  it.each([['1', 1], ['30', 30], ['365', 365]])('accepts %s', (raw, days) => expect(parseWindowDays(raw)).toBe(days))
  it.each(['abc', '0', '-5', '366', '1.5', '', '1e2', '30days', ' 30'])('refuses %j', (raw) => expect(parseWindowDays(raw)).toBeNull())
})
