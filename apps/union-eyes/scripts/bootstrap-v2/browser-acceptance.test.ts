import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import {
  BROWSER_PROFILES, REQUIRED_BROWSER_CHECKS, browserFailureCode, cookiesForOwnedOrigin, maskedPath, responseClass, accessibilityPassed, ACCESSIBILITY_TAGS, browserFailureKind, browserLaunchFailureKind, browserProofPassed, browserTargetAllowed,
} from './browser-acceptance'

const origin = 'http://127.0.0.1:43219'
function measuredResult() {
  return {
    setup: 'PASS' as const, externalRequestsBlocked: 0, unhandledBrowserErrors: 0, serverErrors: 0,
    cleanup: { browserClosed: true, contextsClosed: true, errors: [] as string[] },
    profiles: BROWSER_PROFILES.map((profile) => ({
      id: profile.id, locale: profile.locale, viewport: { ...profile.viewport }, status: 'PASS' as const,
      checks: REQUIRED_BROWSER_CHECKS.map((name) => ({ name, status: 'PASS' as const })),
    })),
  }
}

describe('owned V2 browser qualification contracts (no application-runtime claim)', () => {
  it('permits only the exact owned origin for HTTP and WebSocket traffic', () => {
    expect(browserTargetAllowed(`${origin}/en-CA/dashboard`, origin)).toBe(true)
    expect(browserTargetAllowed('ws://127.0.0.1:43219/socket', origin)).toBe(true)
    for (const url of [
      'https://unioneyes.app', 'https://example.invalid', 'http://127.0.0.1:43220/api/auth/me',
      'http://169.254.169.254', 'http://127.0.0.1.evil.invalid:43219',
      'http://user:password@127.0.0.1:43219', 'file:///etc/passwd', 'not-a-url',
    ]) expect(browserTargetAllowed(url, origin)).toBe(false)
    expect(() => browserTargetAllowed(origin, 'https://production.example.invalid')).toThrow()
  })

  it('requires all four actual locale/viewport profiles and every named action check', () => {
    expect(browserProofPassed(measuredResult())).toBe(true)
    const missing = measuredResult()
    missing.profiles.pop()
    expect(browserProofPassed(missing)).toBe(false)
    const duplicate = measuredResult()
    duplicate.profiles[1] = duplicate.profiles[0]
    expect(browserProofPassed(duplicate)).toBe(false)
    const wrongViewport = measuredResult()
    wrongViewport.profiles[2].viewport.width = 1440
    expect(browserProofPassed(wrongViewport)).toBe(false)
    const missingAction = measuredResult()
    missingAction.profiles[0].checks.pop()
    expect(browserProofPassed(missingAction)).toBe(false)
  })

  it('does not convert unexecuted or failed checks into browser qualification', () => {
    const pending = measuredResult()
    const unexecuted = { ...pending, profiles: pending.profiles.map((profile, index) => index === 0
      ? { ...profile, checks: profile.checks.map((check, checkIndex) => checkIndex === 0 ? { ...check, status: 'UNEXECUTED' as const } : check) }
      : profile) }
    expect(browserProofPassed(unexecuted)).toBe(false)
    expect(browserProofPassed({ ...pending, setup: 'FAIL' })).toBe(false)
    expect(browserProofPassed({ ...pending, profiles: pending.profiles.map((profile) => ({ ...profile, status: 'FAIL' })) })).toBe(false)
  })

  it('fails closed on denied external requests, browser exceptions, server errors or incomplete cleanup', () => {
    const valid = measuredResult()
    expect(browserProofPassed({ ...valid, externalRequestsBlocked: 1 })).toBe(false)
    expect(browserProofPassed({ ...valid, unhandledBrowserErrors: 1 })).toBe(false)
    expect(browserProofPassed({ ...valid, serverErrors: 1 })).toBe(false)
    expect(browserProofPassed({ ...valid, cleanup: { ...valid.cleanup, browserClosed: false } })).toBe(false)
    expect(browserProofPassed({ ...valid, cleanup: { ...valid.cleanup, contextsClosed: false } })).toBe(false)
    expect(browserProofPassed({ ...valid, cleanup: { ...valid.cleanup, errors: ['CONTEXT_CLOSE_FAILED'] } })).toBe(false)
  })

  it('never serializes exception text containing credentials, cookies, tokens or DOM content', () => {
    const secret = 'private-synthetic-password-and-session-value'
    const result = browserFailureKind(new Error(`Typed value: ${secret}`))
    expect(result).toBe('BROWSER_OR_RUNTIME_CHECK_FAILED')
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(browserFailureKind(new assert.AssertionError({ message: secret }))).toBe('ASSERTION_FAILED')
  })

  it('reads the owned origin\'s Secure session cookie over http://127.0.0.1 and nothing from another host', () => {
    const jar = [
      { name: 'nzila_session', domain: '127.0.0.1', path: '/', secure: true, httpOnly: true },
      { name: 'other', domain: 'example.com', path: '/', secure: false, httpOnly: false },
      { name: 'scoped', domain: '127.0.0.1', path: '/admin', secure: false, httpOnly: false },
    ]
    expect(cookiesForOwnedOrigin(jar, 'http://127.0.0.1:41449').map((cookie) => cookie.name)).toEqual(['nzila_session'])
  })

  it('classifies an intake response by class only', () => {
    expect([null, 201, 302, 409, 503].map(responseClass)).toEqual(['NONE', '2XX', '3XX', '4XX', '5XX'])
  })

  it('blocks on critical or serious accessibility violations and records moderate and minor ones', () => {
    expect(ACCESSIBILITY_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    expect(accessibilityPassed([])).toBe(true)
    expect(accessibilityPassed([{ id: 'region', impact: 'moderate', nodes: 2, targets: [] }, { id: 'x', impact: 'minor', nodes: 1, targets: [] }])).toBe(true)
    expect(accessibilityPassed([{ id: 'label', impact: 'critical', nodes: 1, targets: ['#x'] }])).toBe(false)
    expect(accessibilityPassed([{ id: 'color-contrast', impact: 'serious', nodes: 3, targets: ['.a'], contrast: { fg: '#999', bg: '#fff', ratio: 2.6 } }])).toBe(false)
  })

  it('keeps only a masked path from a failing response or page', () => {
    expect(maskedPath('http://127.0.0.1:41449/fr-CA/dashboard/claims/0b7c5a3e-1f2d-4c3b-9a8e-123456789abc?token=secret#x'))
      .toBe('/fr-CA/dashboard/claims/:id')
    expect(maskedPath('http://127.0.0.1:41449/api/cases/CLM-2026-00042')).toBe('/api/cases/CLM-:n-:n')
    expect(maskedPath('not a url')).toBeNull()
  })

  it('names the failed proof by its fixed code and never by a generated or typed message', () => {
    const secret = 'private-synthetic-password-and-session-value'
    expect(browserFailureCode(new assert.AssertionError({ message: 'PASSWORD_MUST_REQUIRE_REAL_MFA' }))).toBe('PASSWORD_MUST_REQUIRE_REAL_MFA')
    expect(browserFailureCode(new assert.AssertionError({ message: `Typed value: ${secret}` }))).toBe('UNNAMED_ASSERTION')
    let named: unknown
    try { assert.equal(secret, 'other', 'UI_SESSION_ORGANIZATION_SUBSTITUTION') } catch (error) { named = error }
    expect(browserFailureCode(named)).toBe('UI_SESSION_ORGANIZATION_SUBSTITUTION')
    expect(JSON.stringify(browserFailureCode(named))).not.toContain(secret)
    let generated: unknown
    try { assert.equal(secret, 'other') } catch (error) { generated = error }
    expect(browserFailureCode(generated)).toBe('UNNAMED_ASSERTION')
    const timeout = new Error(`waiting for ${secret}`); timeout.name = 'TimeoutError'
    expect(browserFailureCode(timeout)).toBe('PLAYWRIGHT_TIMEOUT')
    expect(browserFailureCode(new Error(secret))).toBe('UNCLASSIFIED')
  })

  it('classifies a failed Chromium launch into a fixed code and never echoes the launcher message', () => {
    const secret = 'synthetic-secret-value'
    const cases: Array<[string, string]> = [
      [`browserType.launch: Executable doesn't exist at /x ${secret}`, 'CHROMIUM_EXECUTABLE_MISSING'],
      [`browserType.launch: Host system is missing dependencies ${secret}`, 'CHROMIUM_HOST_DEPENDENCIES_MISSING'],
      [`browserType.launch: Timeout 180000ms exceeded ${secret}`, 'CHROMIUM_LAUNCH_TIMEOUT'],
      [`browserType.launch: Target page, context or browser has been closed ${secret}`, 'CHROMIUM_EXITED_AT_LAUNCH'],
      [`Cannot find module 'playwright' ${secret}`, 'PLAYWRIGHT_MODULE_UNRESOLVED'],
      [`something else ${secret}`, 'BROWSER_OR_RUNTIME_CHECK_FAILED'],
    ]
    for (const [message, code] of cases) {
      const kind = browserLaunchFailureKind(new Error(message))
      expect(kind).toBe(code)
      expect(kind).not.toContain(secret)
    }
  })
})
