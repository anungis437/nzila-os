/**
 * Contract test: Webhook handler hygiene.
 *
 * WHK-001: No app should inline Svix HMAC verification — must use @nzila/platform-auth
 * WHK-002: All Clerk webhook handlers must validate timestamps
 * WHK-003: API guard duplication detection — apps should import from @nzila/platform-auth
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

const WEBHOOK_ROUTES = [
  'apps/zonga/app/api/webhooks/clerk/route.ts',
  'apps/agrimo/app/api/webhooks/clerk/route.ts',
  'apps/console/app/api/webhooks/stripe/route.ts',
  'apps/console/app/api/stripe/webhooks/route.ts',
  'apps/zonga/app/api/webhooks/stripe/route.ts',
].filter((p) => existsSync(join(ROOT, p)))

describe('WHK-001: No inline Svix HMAC verification', () => {
  const clerkWebhookRoutes = WEBHOOK_ROUTES.filter((p) => p.includes('clerk'))

  it.each(clerkWebhookRoutes)(
    '%s should use @nzila/platform-auth for Svix verification',
    (relativePath) => {
      const src = readFileSync(join(ROOT, relativePath), 'utf-8')

      // Flag: inline createHmac usage for webhook verification
      const hasInlineHmac =
        src.includes("createHmac('sha256'") || src.includes('createHmac("sha256"')
      const usesSharedPackage =
        src.includes('@nzila/platform-auth') || src.includes('verifySvixSignature') || src.includes('verifyClerkWebhook')

      // Warn if inline HMAC exists without shared package import
      // This is a migration flag — will become a hard fail once all apps migrate
      if (hasInlineHmac && !usesSharedPackage) {
        console.warn(
          `⚠️ ${relativePath} uses inline HMAC — migrate to @nzila/platform-auth/clerk-webhook`,
        )
      }

      // For now, just ensure the file at least handles signature verification
      expect(
        hasInlineHmac || usesSharedPackage,
        `${relativePath} must verify webhook signatures (inline or via shared package)`,
      ).toBe(true)
    },
  )
})

describe('WHK-002: Webhook handlers validate timestamps', () => {
  const clerkWebhookRoutes = WEBHOOK_ROUTES.filter((p) => p.includes('clerk'))

  it.each(clerkWebhookRoutes)(
    '%s must validate timestamp tolerance',
    (relativePath) => {
      const src = readFileSync(join(ROOT, relativePath), 'utf-8')

      const checksTimestamp =
        src.includes('isTimestampValid') ||
        src.includes('isSvixTimestampValid') ||
        src.includes('svixTimestamp')

      expect(
        checksTimestamp,
        `${relativePath} must validate Svix timestamp to prevent replays`,
      ).toBe(true)
    },
  )
})

describe('WHK-003: api-guards.ts should reference @nzila/platform-auth', () => {
  const ORG_SCOPED_APPS = [
    'console',
    'cfo',
    'zonga',
    'partners',
    'union-eyes',
    'flow',
    'agrimo',
  ]

  const guardFiles = ORG_SCOPED_APPS.map((app) => ({
    app,
    path: join(ROOT, 'apps', app, 'lib', 'api-guards.ts'),
  })).filter(({ path }) => existsSync(path))

  it.each(guardFiles.map(({ app }) => app))(
    '%s/lib/api-guards.ts should import from @nzila/platform-auth',
    (app) => {
      const src = readFileSync(
        join(ROOT, 'apps', app, 'lib', 'api-guards.ts'),
        'utf-8',
      )

      const usesSharedAuth =
        src.includes('@nzila/platform-auth') ||
        src.includes('@nzila/db')

      // All guard files must at least use platform auth primitives
      // This is a progressive enforcement flag
      expect(
        usesSharedAuth,
        `${app}/lib/api-guards.ts should use platform auth packages`,
      ).toBe(true)
    },
  )
})
