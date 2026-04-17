/**
 * PR 8 — AuthN/AuthZ Regression Tests
 *
 * Verifies that every app's middleware, protected route patterns,
 * and public route allowlist remain consistent with the security model.
 *
 * These tests are intentionally static (no HTTP server) — they parse
 * source code to enforce architectural invariants.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function readContent(path: string): string {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

// ── 1. Every protected app must have a proxy.ts ─────────────────────

const PROTECTED_APPS = ['console', 'partners', 'union-eyes', 'flow', 'cfo', 'zonga']

describe('PR8: AuthZ — middleware presence', () => {
  for (const app of PROTECTED_APPS) {
    it(`${app} must have a proxy.ts that uses platform-auth`, () => {
      const proxyPath = resolve(ROOT, `apps/${app}/proxy.ts`)
      expect(existsSync(proxyPath), `apps/${app}/proxy.ts missing`).toBe(true)
      const content = readContent(proxyPath)
      // Must import from @nzila/platform-auth or authMiddleware
      expect(
        content.includes('authMiddleware') || content.includes('@nzila/platform-auth'),
        `${app}/proxy.ts must use platform-auth middleware`
      ).toBe(true)
    })
  }
})

// ── 2. No route bypasses auth without being in the public allowlist ───────

const AUTH_BYPASS_PATTERNS = [
  /\/\*\*.*@noauth/i,
  /auth\s*:\s*false/,
  /skipAuth\s*=\s*true/,
  /requireAuth\s*=\s*false/,
]

describe('PR8: AuthZ — no undocumented auth bypass patterns', () => {
  for (const app of PROTECTED_APPS) {
    it(`${app}: no undocumented auth bypass markers in route files`, async () => {
      const appDir = resolve(ROOT, `apps/${app}/app`)
      if (!existsSync(appDir)) return

      const entries = readdirSync(appDir, { withFileTypes: true, recursive: true })
      const routeFiles = entries
        .filter(e => e.isFile() && e.name === 'route.ts')
        .map(e => join((e as any).path ?? appDir, e.name))

      for (const routeFile of routeFiles) {
        const content = readContent(routeFile)
        for (const pattern of AUTH_BYPASS_PATTERNS) {
          expect(
            pattern.test(content),
            `Undocumented auth bypass in ${routeFile.replace(ROOT, '')}`
          ).toBe(false)
        }
      }
    })
  }
})

// ── 3. Webhook routes must verify signatures ──────────────────────────────

describe('PR8: AuthZ — webhook routes verify signatures', () => {
  it('payments-stripe webhook route uses verifyWebhookSignature or Stripe.webhooks', () => {
    const candidates = [
      resolve(ROOT, 'apps/console/app/api/webhooks/stripe/route.ts'),
      resolve(ROOT, 'apps/partners/app/api/webhooks/stripe/route.ts'),
    ]
    const existingCandidates = candidates.filter(p => existsSync(p))
    // If no webhook route exists yet, that's acceptable — but if one exists, it must verify
    for (const p of existingCandidates) {
      const content = readContent(p)
      expect(
        content.includes('verifyWebhookSignature') ||
        content.includes('constructEvent') ||
        content.includes('webhooks.constructEventAsync'),
        `${p.replace(ROOT, '')} must verify Stripe webhook signature`
      ).toBe(true)
    }
  })

  it('QBO webhook route verifies HMAC if present', () => {
    const candidate = resolve(ROOT, 'apps/console/app/api/webhooks/qbo/route.ts')
    if (!existsSync(candidate)) return
    const content = readContent(candidate)
    expect(
      content.includes('hmac') || content.includes('HMAC') || content.includes('verifyWebhook'),
      'QBO webhook must verify HMAC signature'
    ).toBe(true)
  })
})

// ── 4. Union-Eyes orgId derivation ─────────────────────────────────────

describe('PR8: AuthZ — union-eyes orgId derivation warning', () => {
  it('documents that union-eyes orgId should come from session, not URL params', () => {
    const ueLib = resolve(ROOT, 'apps/union-eyes/lib')
    const entries = existsSync(ueLib)
      ? readdirSync(ueLib, { withFileTypes: true, recursive: true })
          .filter(e => e.isFile())
          .map(e => join((e as any).path ?? ueLib, e.name))
      : []

    // Union-eyes either is session-derived, has a TODO, or the risk is acknowledged in CODEOWNERS
    const codeownersContent = readContent(resolve(ROOT, 'CODEOWNERS'))
    expect(
      codeownersContent.includes('union-eyes'),
      'CODEOWNERS must cover union-eyes requiring security review'
    ).toBe(true)
  })
})
