import { describe, expect, it } from 'vitest'
import { resolveIcraEmailOrigin } from '../email-results-origin'

describe('ICRA capability email canonical origin', () => {
  it('requires a configured origin in production instead of trusting Host', () => {
    expect(resolveIcraEmailOrigin(undefined, 'https://attacker.example', true)).toBeNull()
    expect(resolveIcraEmailOrigin('', 'https://attacker.example', true)).toBeNull()
  })

  it('uses the configured HTTPS origin rather than the attacker-controlled request host', () => {
    expect(resolveIcraEmailOrigin('https://union-eyes.example/', 'https://attacker.example', true))
      .toBe('https://union-eyes.example')
  })

  it.each([
    'http://union-eyes.example',
    'https://user:password@union-eyes.example',
    'https://union-eyes.example/redirect',
    'https://union-eyes.example/?next=https://attacker.example',
    'https://union-eyes.example/#fragment',
    'javascript:alert(1)',
    'not a URL',
  ])('refuses an unsafe production configuration: %s', (configured) => {
    expect(resolveIcraEmailOrigin(configured, 'https://attacker.example', true)).toBeNull()
  })

  it('allows local development without leaking a bearer capability to a non-loopback Host', () => {
    expect(resolveIcraEmailOrigin(undefined, 'http://localhost:3000', false)).toBe('http://localhost:3000')
    expect(resolveIcraEmailOrigin(undefined, 'http://127.0.0.1:3000', false)).toBe('http://127.0.0.1:3000')
    expect(resolveIcraEmailOrigin(undefined, 'https://attacker.example', false)).toBeNull()
  })

  it('refuses an external HTTP origin even outside production', () => {
    expect(resolveIcraEmailOrigin('http://attacker.example', 'http://localhost', false)).toBeNull()
  })
})
