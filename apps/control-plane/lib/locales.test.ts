import { describe, it, expect } from 'vitest'
import { locales, defaultLocale, routing } from './locales'

describe('locales', () => {
  it('contains en-CA and fr-CA', () => {
    expect(locales).toContain('en-CA')
    expect(locales).toContain('fr-CA')
  })

  it('defaultLocale is en-CA', () => {
    expect(defaultLocale).toBe('en-CA')
  })

  it('routing has locales and defaultLocale', () => {
    expect(routing.locales).toBe(locales)
    expect(routing.defaultLocale).toBe(defaultLocale)
  })
})
