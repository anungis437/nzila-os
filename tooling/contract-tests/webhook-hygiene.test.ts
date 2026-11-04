/**
 * Contract test: Webhook handler hygiene.
 *
 * WHK-001: Every Clerk-named webhook route must verify the Svix signature. The shared verifier that used to live in @nzila/platform-auth was
 *          retired with the identity provider (UE-CONV-A-006), so a route that still exists carries its own HMAC check
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

describe('WHK-001: Webhook handlers verify the signature', () => {
  const clerkWebhookRoutes = WEBHOOK_ROUTES.filter((p) => p.includes('clerk'))

  it.each(clerkWebhookRoutes)(
    '%s must verify the Svix signature',
    (relativePath) => {
      const src = readFileSync(join(ROOT, relativePath), 'utf-8')

      const verifiesSignature =
        src.includes("createHmac('sha256'") || src.includes('createHmac("sha256"')

      expect(
        verifiesSignature,
        `${relativePath} must verify webhook signatures`,
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
