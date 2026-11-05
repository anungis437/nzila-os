import { describe, expect, it } from 'vitest'
import { bind } from './route-adapter'

describe('kernel executor parameter binding', () => {
  it('sends a Date as its ISO instant, which the postgres driver can serialise', () => {
    const when = new Date('2026-10-28T14:00:00.000Z')
    expect(bind(when)).toBe('2026-10-28T14:00:00.000Z')
  })

  it('sends an array as one Postgres array literal', () => {
    expect(bind(['read', 'comment'])).toBe('{"read","comment"}')
    expect(bind([null])).toBe('{NULL}')
  })

  it('leaves scalars untouched', () => {
    expect(bind('text')).toBe('text')
    expect(bind(3)).toBe(3)
    expect(bind(null)).toBeNull()
  })
})
