import { describe, expect, it } from 'vitest'
import { createTime } from '../src/core/time'
import { getProfileTargets } from '../src/core/profiles'

const PINNED_NOW = new Date('2026-04-23T14:32:11.000Z')

describe('createTime', () => {
  const targets = getProfileTargets('demo-standard')

  it('today() returns UTC midnight of the pinned now', () => {
    const t = createTime(targets, PINNED_NOW)
    expect(t.today().toISOString()).toBe('2026-04-23T00:00:00.000Z')
  })

  it('daysAgo and daysAhead are symmetric around today', () => {
    const t = createTime(targets, PINNED_NOW)
    const ago = t.daysAgo(7)
    const ahead = t.daysAhead(7)
    expect(ago.toISOString()).toBe('2026-04-16T00:00:00.000Z')
    expect(ahead.toISOString()).toBe('2026-04-30T00:00:00.000Z')
  })

  it('historyWindow spans historyMonths * 30 days', () => {
    const t = createTime(targets, PINNED_NOW)
    const w = t.historyWindow()
    const days = (w.end.getTime() - w.start.getTime()) / 86_400_000
    expect(days).toBe(targets.historyMonths * 30)
  })

  it('futureWindow spans futureWindowDays', () => {
    const t = createTime(targets, PINNED_NOW)
    const w = t.futureWindow()
    const days = (w.end.getTime() - w.start.getTime()) / 86_400_000
    expect(days).toBe(targets.futureWindowDays)
  })

  it('rejects negative day offsets', () => {
    const t = createTime(targets, PINNED_NOW)
    expect(() => t.daysAgo(-1)).toThrow()
    expect(() => t.daysAhead(-1)).toThrow()
  })
})
