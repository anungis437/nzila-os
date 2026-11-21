import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import {
  BROWSER_PROFILES, REQUIRED_BROWSER_CHECKS, browserFailureKind, browserLaunchFailureKind, browserProofPassed, browserTargetAllowed,
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
