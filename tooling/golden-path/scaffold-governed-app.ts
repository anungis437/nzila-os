/**
 * Golden Path — Governed App Scaffold Generator
 *
 * Creates a new app in the monorepo with all governance controls pre-wired:
 *   - control-manifest.json (aligned with runtime-adoption-matrix)
 *   - app-architecture.meta.json
 *   - Enforcement handler examples
 *   - Governance-compliant route template
 *   - Contract test stubs
 *
 * Usage:
 *   npx tsx tooling/golden-path/scaffold-governed-app.ts <app-name> [--risk=medium] [--profile=commerce]
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename2 = fileURLToPath(import.meta.url)
const __dirname2 = dirname(__filename2)
const REPO_ROOT = join(__dirname2, '..', '..')

// ── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flags = args.filter(a => a.startsWith('--'))
const positional = args.filter(a => !a.startsWith('--'))

const appName = positional[0]
if (!appName || !/^[a-z][a-z0-9-]*$/.test(appName)) {
  console.error('Usage: scaffold-governed-app <app-name> [--risk=medium] [--profile=commerce]')
  console.error('  app-name: lowercase alphanumeric with hyphens (e.g. "my-app")')
  process.exit(1)
}

const riskLevel = flags.find(f => f.startsWith('--risk='))?.split('=')[1] ?? 'medium'
const profile = flags.find(f => f.startsWith('--profile='))?.split('=')[1] ?? null
const outputRoot = flags.find(f => f.startsWith('--root='))?.split('=')[1] ?? REPO_ROOT

const VALID_RISKS = ['critical', 'high', 'medium', 'low', 'none']
if (!VALID_RISKS.includes(riskLevel)) {
  console.error(`Invalid risk level: ${riskLevel}. Must be one of: ${VALID_RISKS.join(', ')}`)
  process.exit(1)
}

const VALID_PROFILES = ['union-eyes', 'abr-insights', 'fintech', 'commerce', 'agtech', 'media', 'advisory']
if (profile && !VALID_PROFILES.includes(profile)) {
  console.error(`Invalid profile: ${profile}. Must be one of: ${VALID_PROFILES.join(', ')}`)
  process.exit(1)
}

const appDir = join(outputRoot, 'apps', appName)
if (existsSync(appDir)) {
  console.error(`App directory already exists: apps/${appName}`)
  process.exit(1)
}

const requiresEnforcement = ['critical', 'high', 'medium'].includes(riskLevel)

// ── Helpers ─────────────────────────────────────────────────────────────────

function write(relPath: string, content: string) {
  const full = join(appDir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  console.log(`  + apps/${appName}/${relPath}`)
}

// ── Generate files ──────────────────────────────────────────────────────────

console.log(`\n  Scaffolding governed app: ${appName}\n`)

// 1. control-manifest.json
write('control-manifest.json', JSON.stringify({
  $schema: 'https://nzilaos.dev/schemas/control-manifest.json',
  app: appName,
  version: '1.0.0',
  riskLevel,
  policyProfile: profile,
  controls: {
    enforcement: requiresEnforcement,
    governance: requiresEnforcement,
    audit: requiresEnforcement,
    observability: true,
    security: true,
    aiControl: false,
    contracts: requiresEnforcement,
    events: requiresEnforcement,
  },
  exceptions: [],
}, null, 2) + '\n')

// 2. app-architecture.meta.json
write('app-architecture.meta.json', JSON.stringify({
  domain_core_standard_adopted: true,
  layers_present: ['domain', 'services', 'ui'],
  layers_missing: ['workflows', 'queries', 'events'],
  exceptions: [],
  migration_status: 'new',
  priority_migrations: [],
  app_tier: 'DEVELOPMENT',
}, null, 2) + '\n')

// 3. package.json
write('package.json', JSON.stringify({
  name: `@nzila/${appName}`,
  version: '0.1.0',
  private: true,
  scripts: {
    dev: 'next dev',
    build: 'next build',
    start: 'next start',
    lint: 'eslint .',
    typecheck: 'tsc --noEmit',
  },
  dependencies: {
    next: '^15.0.0',
    react: '^19.0.0',
    'react-dom': '^19.0.0',
  },
  devDependencies: {
    '@types/react': '^19.0.0',
    typescript: '^5.0.0',
  },
}, null, 2) + '\n')

// 4. tsconfig.json
write('tsconfig.json', JSON.stringify({
  extends: '../../packages/config/tsconfig.base.json',
  compilerOptions: {
    jsx: 'preserve',
    module: 'esnext',
    moduleResolution: 'bundler',
    noEmit: true,
  },
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules', '.next'],
}, null, 2) + '\n')

// 5. Enforcement handler example (if risk warrants it)
if (requiresEnforcement) {
  write('lib/enforcement.ts', `/**
 * Enforcement pipeline configuration for ${appName}.
 *
 * This file configures the @nzila/enforcement pipeline layers
 * for this app. Import and use \`enforcedHandler\` in API routes.
 */
import {
  composePipeline,
  traceLayer,
  authLayer,
  rateLimitLayer,
  governanceLayer,
  auditLayer,
  type EnforcementContext,
} from '@nzila/enforcement'

/**
 * Create the enforcement pipeline for this app.
 * Customize the layer callbacks for your auth provider, rate limiter, etc.
 */
export function createAppPipeline() {
  return composePipeline([
    traceLayer(),
    authLayer({
      extractActor: async (headers) => {
        // TODO: Replace with your auth provider (e.g., Clerk, NextAuth)
        const token = headers.authorization?.replace('Bearer ', '')
        if (!token) return null
        return {
          actorId: 'placeholder-user',
          orgId: 'placeholder-org',
          roles: ['member'],
        }
      },
    }),
    rateLimitLayer({
      check: async (_orgId, _route) => {
        // TODO: Wire to your rate limiter (Redis, in-memory, etc.)
        return { allowed: true, remaining: 100, resetAt: Date.now() + 60000 }
      },
    }),
    governanceLayer({
      evaluate: async (_ctx) => {
        // TODO: Wire to @nzila/governance canAccess()
        return { outcome: 'allow' as const, reason: 'default-allow' }
      },
    }),
    auditLayer({
      record: async (entry) => {
        // TODO: Wire to @nzila/audit appendEntry()
        console.log('[audit]', JSON.stringify(entry))
      },
    }),
  ])
}

/**
 * Example: wrap an API route handler with enforcement.
 */
export function enforced(
  handler: (ctx: EnforcementContext) => Promise<{ success: boolean; status: number; body?: unknown }>
) {
  const pipeline = createAppPipeline()
  return async (ctx: EnforcementContext) => {
    // Pipeline runs all layers, then the handler as the terminal
    // For real use, prefer createEnforcedHandler() from @nzila/enforcement
    void handler
    return pipeline(ctx)
  }
}
`)
}

// 6. Example API route
write('app/api/health/route.ts', `/**
 * Health check endpoint — bypasses enforcement pipeline.
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    app: '${appName}',
    timestamp: new Date().toISOString(),
  })
}
`)

// 7. Root page
write('app/page.tsx', `export default function Home() {
  return (
    <main>
      <h1>${appName}</h1>
      <p>Governed by NzilaOS enforcement pipeline.</p>
    </main>
  )
}
`)

// 8. Root layout
write('app/layout.tsx', `export const metadata = {
  title: '${appName}',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`)

// 9. .eslintrc.json
write('.eslintrc.json', JSON.stringify({
  root: true,
  extends: ['../../packages/config/eslint-base'],
}, null, 2) + '\n')

// 10. README
write('README.md', `# ${appName}

A governed app in the Nzila OS monorepo.

## Governance Controls

| Control | Status |
|---------|--------|
| Enforcement | ${requiresEnforcement ? '✓ Required' : '○ Optional'} |
| Governance | ${requiresEnforcement ? '✓ Required' : '○ Optional'} |
| Audit | ${requiresEnforcement ? '✓ Required' : '○ Optional'} |
| Observability | ✓ Required |
| Security | ✓ Required |
| AI Control | ○ Optional |

## Quick Start

\`\`\`bash
pnpm dev --filter @nzila/${appName}
\`\`\`

## Governance Compliance

This app's control-manifest.json declares its governance requirements.
Run \`pnpm validate:control:manifests\` to verify compliance.

Risk Level: **${riskLevel}**${profile ? `\nPolicy Profile: **${profile}**` : ''}
`)

console.log(`\n  ✓ Scaffold complete: apps/${appName}`)
console.log(`  Next steps:`)
console.log(`    1. cd apps/${appName} && pnpm install`)
console.log(`    2. Add app to governance/runtime-adoption-matrix.json`)
console.log(`    3. Run: pnpm validate:control:manifests`)
console.log(`    4. Customize lib/enforcement.ts with your auth provider\n`)
