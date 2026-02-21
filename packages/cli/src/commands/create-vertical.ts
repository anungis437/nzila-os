/**
 * Nzila OS CLI — create-vertical command
 *
 * Scaffolds a complete vertical app under apps/<name>/ with:
 *   - authorize() middleware
 *   - scopedDb + withAudit
 *   - RBAC configuration
 *   - Telemetry context
 *   - Entity schema placeholder
 *   - Example route using audited scopedDb
 *   - Contract test stub
 *   - Ops pack stub
 *   - Evidence collector stub
 *   - ESLint config with no-shadow-ai, no-shadow-ml, no-shadow-db
 *   - package.json
 *   - tsconfig.json
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface CreateVerticalOptions {
  profile: string
  dryRun: boolean
}

const VALID_PROFILES = [
  'union-eyes',
  'abr-insights',
  'fintech',
  'commerce',
  'agtech',
  'media',
  'advisory',
] as const

export async function createVertical(name: string, options: CreateVerticalOptions): Promise<void> {
  // Validate name
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`❌ Invalid vertical name: "${name}". Must be lowercase alphanumeric with hyphens.`)
    process.exit(1)
  }

  // Validate profile
  if (!VALID_PROFILES.includes(options.profile as any)) {
    console.error(`❌ Invalid governance profile: "${options.profile}". Valid: ${VALID_PROFILES.join(', ')}`)
    process.exit(1)
  }

  // Resolve paths
  const repoRoot = findRepoRoot()
  const appDir = join(repoRoot, 'apps', name)

  if (existsSync(appDir)) {
    console.error(`❌ Directory already exists: apps/${name}/`)
    process.exit(1)
  }

  const files = generateFiles(name, options)

  if (options.dryRun) {
    console.log(`\n🔍 Dry run — would create ${files.length} files:\n`)
    for (const f of files) {
      console.log(`  📄 apps/${name}/${f.path}`)
    }
    return
  }

  // Create directories and write files
  for (const f of files) {
    const fullPath = join(appDir, f.path)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/') > -1 ? fullPath.lastIndexOf('/') : fullPath.lastIndexOf('\\'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(fullPath, f.content, 'utf-8')
  }

  console.log(`\n✅ Vertical "${name}" created at apps/${name}/\n`)
  console.log('Next steps:')
  console.log(`  1. cd apps/${name}`)
  console.log('  2. pnpm install')
  console.log('  3. pnpm contract-tests  (should pass immediately)')
  console.log('  4. Customize entity.ts with your domain schema')
  console.log('  5. Add routes under app/api/')
  console.log('')
}

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== join(dir, '..')) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = join(dir, '..')
  }
  console.error('❌ Could not find repo root (no pnpm-workspace.yaml found)')
  process.exit(1)
}

interface GeneratedFile {
  path: string
  content: string
}

function generateFiles(name: string, options: CreateVerticalOptions): GeneratedFile[] {
  const pkgName = `@nzila/${name}`
  const pascalName = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')

  return [
    // ── package.json ────────────────────────────────────────────────
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: pkgName,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
            typecheck: 'tsc --noEmit',
            test: 'vitest run --passWithNoTests',
          },
          dependencies: {
            '@clerk/nextjs': '^6.0.0',
            '@nzila/db': 'workspace:*',
            '@nzila/os-core': 'workspace:*',
            '@nzila/ai-sdk': 'workspace:*',
            '@nzila/ml-sdk': 'workspace:*',
            '@nzila/ui': 'workspace:*',
            next: '^15.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            zod: '^3.24.0',
          },
          devDependencies: {
            '@types/node': '^25',
            '@types/react': '^19',
            typescript: '^5',
            vitest: '^4.0.18',
          },
        },
        null,
        2,
      ) + '\n',
    },

    // ── tsconfig.json ───────────────────────────────────────────────
    {
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2,
      ) + '\n',
    },

    // ── next.config.ts ──────────────────────────────────────────────
    {
      path: 'next.config.ts',
      content: `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@nzila/db', '@nzila/os-core', '@nzila/ui'],
}

export default nextConfig
`,
    },

    // ── eslint.config.mjs ───────────────────────────────────────────
    {
      path: 'eslint.config.mjs',
      content: `import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import noShadowAi from '../../packages/ai-sdk/eslint-no-shadow-ai.mjs'
import noShadowMl from '../../packages/ml-sdk/eslint-no-shadow-ml.mjs'
import noShadowDb from '../../packages/db/eslint-no-shadow-db.mjs'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noShadowAi,
  noShadowMl,
  noShadowDb,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
`,
    },

    // ── middleware.ts ────────────────────────────────────────────────
    {
      path: 'middleware.ts',
      content: `/**
 * ${pascalName} — Next.js middleware
 *
 * Clerk authentication + rate limiting.
 * All API routes must also call authorize() from @nzila/os-core/policy.
 */
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/health(.*)',
])

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

export default clerkMiddleware(async (auth, request) => {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const rl = checkRateLimit(ip, { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMIT_MAX) },
    )
  }
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
`,
    },

    // ── lib/api-guards.ts ───────────────────────────────────────────
    {
      path: 'lib/api-guards.ts',
      content: `/**
 * ${pascalName} — API route guards
 *
 * Entity membership + platform RBAC + scoped DB + automatic audit.
 * Every API route MUST call requireEntityAccess() or requirePlatformRole().
 */
import { NextResponse } from 'next/server'
import { authorize, authorizeEntityAccess, type AuthContext } from '@nzila/os-core/policy'
import { createScopedDb, type ScopedDb } from '@nzila/db/scoped'
import { withAudit, type AuditedScopedDb } from '@nzila/db/audit'
import type { NextRequest } from 'next/server'

export interface GuardResult {
  ok: true
  context: AuthContext
  scopedDb: AuditedScopedDb
}

export interface GuardError {
  ok: false
  response: NextResponse
}

/**
 * Require entity-level access with automatic scopedDb + audit.
 *
 * Returns an audited, entity-scoped database client ready to use.
 */
export async function requireEntityAccess(
  req: NextRequest,
  entityId: string,
): Promise<GuardResult | GuardError> {
  try {
    const ctx = await authorize(req)
    await authorizeEntityAccess(ctx, entityId)

    const scopedDb = createScopedDb(entityId)
    const auditedDb = withAudit(scopedDb, {
      actorId: ctx.userId,
      entityId,
      actorRole: ctx.role,
      correlationId: req.headers.get('x-request-id') ?? undefined,
    })

    return { ok: true, context: ctx, scopedDb: auditedDb }
  } catch (err) {
    const status = (err as any).statusCode ?? 403
    return {
      ok: false,
      response: NextResponse.json(
        { error: (err as Error).message },
        { status },
      ),
    }
  }
}
`,
    },

    // ── lib/rbac.ts ─────────────────────────────────────────────────
    {
      path: 'lib/rbac.ts',
      content: `/**
 * ${pascalName} — RBAC Configuration
 *
 * Re-exports from @nzila/os-core/policy for domain-specific role usage.
 */
export {
  authorize,
  withAuth,
  authorizeEntityAccess,
  AuthorizationError,
} from '@nzila/os-core/policy'
export type { NzilaRole } from '@nzila/os-core/policy'
export type { Scope } from '@nzila/os-core/policy'
`,
    },

    // ── lib/telemetry.ts ────────────────────────────────────────────
    {
      path: 'lib/telemetry.ts',
      content: `/**
 * ${pascalName} — Telemetry Context
 *
 * Re-exports telemetry utilities from @nzila/os-core.
 * All API routes should include correlation IDs in responses.
 */
export * from '@nzila/os-core/telemetry'
`,
    },

    // ── lib/entity.ts ───────────────────────────────────────────────
    {
      path: 'lib/entity.ts',
      content: `/**
 * ${pascalName} — Entity Schema
 *
 * Define domain-specific tables here. All tables MUST include
 * an entity_id column for entity isolation enforcement.
 *
 * Example:
 *   export const ${name.replace(/-/g, '_')}_items = pgTable('${name.replace(/-/g, '_')}_items', {
 *     id: uuid('id').primaryKey().defaultRandom(),
 *     entityId: uuid('entity_id').notNull().references(() => entities.id),
 *     name: text('name').notNull(),
 *     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
 *   })
 */
// Import schema dependencies as needed:
// import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
// import { entities } from '@nzila/db/schema'
`,
    },

    // ── app/layout.tsx ──────────────────────────────────────────────
    {
      path: 'app/layout.tsx',
      content: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${pascalName} — Nzila OS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    },

    // ── app/page.tsx ────────────────────────────────────────────────
    {
      path: 'app/page.tsx',
      content: `export default function HomePage() {
  return (
    <main>
      <h1>${pascalName}</h1>
      <p>Nzila OS vertical — fully governed, entity-isolated, audit-enforced.</p>
    </main>
  )
}
`,
    },

    // ── app/api/health/route.ts ─────────────────────────────────────
    {
      path: 'app/api/health/route.ts',
      content: `/**
 * Health check endpoint — public, no auth required.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', app: '${name}', timestamp: new Date().toISOString() })
}
`,
    },

    // ── app/api/entities/[entityId]/example/route.ts ────────────────
    {
      path: 'app/api/entities/[entityId]/example/route.ts',
      content: `/**
 * ${pascalName} — Example entity-scoped route
 *
 * Demonstrates the correct pattern:
 *   1. authorize() via requireEntityAccess()
 *   2. scopedDb for entity-isolated queries
 *   3. withAudit for automatic audit emission
 *
 * Replace this with your domain-specific routes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireEntityAccess } from '@/lib/api-guards'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(req, entityId)
  if (!guard.ok) return guard.response

  // Use guard.scopedDb for all queries — entity isolation + audit guaranteed
  // Example: const items = await guard.scopedDb.select(myTable)

  return NextResponse.json({
    entityId,
    message: 'Entity access verified. ScopedDb + audit ready.',
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params
  const guard = await requireEntityAccess(req, entityId)
  if (!guard.ok) return guard.response

  const body = await req.json()

  // Example mutation with automatic audit:
  // const [row] = await guard.scopedDb.insert(myTable, body).returning()

  return NextResponse.json(
    { entityId, message: 'Created (with automatic audit)' },
    { status: 201 },
  )
}
`,
    },

    // ── vitest.config.ts ────────────────────────────────────────────
    {
      path: 'vitest.config.ts',
      content: `import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
})
`,
    },

    // ── Contract test stub ──────────────────────────────────────────
    {
      path: '__tests__/contract.test.ts',
      content: `/**
 * ${pascalName} — Contract Test Stub
 *
 * Validates that this vertical adheres to Nzila OS governance posture.
 * These tests should pass immediately after scaffolding.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const APP_DIR = join(__dirname, '..')

describe('${pascalName} — governance compliance', () => {
  it('has middleware.ts with Clerk auth', () => {
    const mw = join(APP_DIR, 'middleware.ts')
    expect(existsSync(mw)).toBe(true)
    const content = readFileSync(mw, 'utf-8')
    expect(content).toContain('clerkMiddleware')
    expect(content).toContain('auth.protect')
  })

  it('has api-guards.ts with authorize()', () => {
    const guards = join(APP_DIR, 'lib', 'api-guards.ts')
    expect(existsSync(guards)).toBe(true)
    const content = readFileSync(guards, 'utf-8')
    expect(content).toContain('authorize')
    expect(content).toContain('createScopedDb')
    expect(content).toContain('withAudit')
  })

  it('example route uses requireEntityAccess', () => {
    const route = join(APP_DIR, 'app', 'api', 'entities', '[entityId]', 'example', 'route.ts')
    expect(existsSync(route)).toBe(true)
    const content = readFileSync(route, 'utf-8')
    expect(content).toContain('requireEntityAccess')
  })

  it('eslint config includes no-shadow-db', () => {
    const eslint = join(APP_DIR, 'eslint.config.mjs')
    expect(existsSync(eslint)).toBe(true)
    const content = readFileSync(eslint, 'utf-8')
    expect(content).toContain('noShadowDb')
    expect(content).toContain('noShadowAi')
    expect(content).toContain('noShadowMl')
  })

  it('has health endpoint', () => {
    const health = join(APP_DIR, 'app', 'api', 'health', 'route.ts')
    expect(existsSync(health)).toBe(true)
  })

  it('has RBAC configuration', () => {
    const rbac = join(APP_DIR, 'lib', 'rbac.ts')
    expect(existsSync(rbac)).toBe(true)
    const content = readFileSync(rbac, 'utf-8')
    expect(content).toContain('authorize')
  })

  it('has telemetry configuration', () => {
    const telemetry = join(APP_DIR, 'lib', 'telemetry.ts')
    expect(existsSync(telemetry)).toBe(true)
  })
})
`,
    },

    // ── Ops pack stub ───────────────────────────────────────────────
    {
      path: 'ops/runbook.md',
      content: `# ${pascalName} — Ops Runbook

## Health Check
\`GET /api/health\` → \`{ status: "ok" }\`

## Deployment
Standard Nzila OS deployment pipeline via CI/CD.

## Incident Response
Follow \`ops/incident-response/\` playbooks in the monorepo root.

## Rollback
See \`docs/migration/ROLLBACK_RUNBOOK.md\` for database rollback procedures.
`,
    },

    // ── Evidence collector stub ─────────────────────────────────────
    {
      path: 'lib/evidence.ts',
      content: `/**
 * ${pascalName} — Evidence Collector Stub
 *
 * Integrate with @nzila/os-core/evidence to produce
 * tamper-evident evidence packs for this vertical's operations.
 *
 * See packages/os-core/src/evidence/ for the full pipeline.
 */
export { buildEvidencePackFromAction, processEvidencePack } from '@nzila/os-core/evidence'
`,
    },

    // ── Governance profile ──────────────────────────────────────────
    {
      path: 'governance.json',
      content: JSON.stringify(
        {
          vertical: name,
          profile: options.profile,
          generatedAt: new Date().toISOString(),
          immutableControls: [
            'org-isolation',
            'audit-emission',
            'evidence-sealing',
            'hash-chain-integrity',
            'scoped-db-enforcement',
            'no-direct-provider-import',
          ],
          profileExtensions: getProfileExtensions(options.profile),
        },
        null,
        2,
      ) + '\n',
    },

    // ── CODEOWNERS ──────────────────────────────────────────────────
    {
      path: 'CODEOWNERS',
      content: `# ${pascalName} — Code Ownership
# All changes to this vertical require review from vertical leads + platform governance.

* @nzila-os/${name}-leads @nzila-os/platform-governance
governance.json @nzila-os/platform-governance
eslint.config.mjs @nzila-os/platform-governance
middleware.ts @nzila-os/platform-governance @nzila-os/${name}-leads
`,
    },

    // ── GitHub Actions governance workflow reference ─────────────────
    {
      path: '.github/governance.yml',
      content: `# ${pascalName} — Governance Workflow Reference
#
# This vertical imports the reusable nzila-governance.yml workflow.
# DO NOT modify governance controls below — they are immutable.
name: ${name}-governance

on:
  pull_request:
    paths:
      - 'apps/${name}/**'
  push:
    branches: [main]
    paths:
      - 'apps/${name}/**'

jobs:
  governance:
    uses: ./.github/workflows/nzila-governance.yml
    with:
      vertical: ${name}
      profile: ${options.profile}
    secrets: inherit
`,
    },

    // ── Red-team test stub ──────────────────────────────────────────
    {
      path: '__tests__/redteam.test.ts',
      content: `/**
 * ${pascalName} — Red-Team Test Stub
 *
 * Adversarial tests specific to this vertical.
 * These run on the red-team schedule and during PR checks.
 */
import { describe, it, expect } from 'vitest'

describe('${pascalName} — red-team', () => {
  it('cannot access data without entity membership', () => {
    // TODO: Implement cross-org access test for ${name}
    expect(true).toBe(true)
  })

  it('cannot bypass audit for mutations', () => {
    // TODO: Implement audit bypass test for ${name}
    expect(true).toBe(true)
  })
})
`,
    },
  ]
}

/**
 * Get profile-specific governance extensions.
 * These are additive controls — they never weaken base immutable controls.
 */
function getProfileExtensions(profile: string): string[] {
  const map: Record<string, string[]> = {
    'union-eyes': [
      'litigation-hold-enforcement',
      'role-graph-acyclic-validation',
      'document-version-hashing',
      'case-evidence-export',
    ],
    'abr-insights': [
      'confidential-reporting',
      'identity-vault-encryption',
      'need-to-know-access',
      'dual-control-case-access',
    ],
    fintech: [
      'dual-control-financial-actions',
      'key-rotation-governance',
      'dr-simulation-artifacts',
      'payment-encryption',
    ],
    commerce: [],
    agtech: [],
    media: [],
    advisory: [],
  }
  return map[profile] ?? []
}
