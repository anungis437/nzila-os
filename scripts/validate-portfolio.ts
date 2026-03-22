#!/usr/bin/env npx tsx
/**
 * validate:portfolio — Portfolio-level maturity classifier for NzilaOS apps.
 *
 * Scans every app in apps/ and classifies maturity based on:
 *   - middleware.ts presence + quality (rate limiting, request-ID)
 *   - @nzila/os-core dependency
 *   - Health route
 *   - Test coverage (any test files)
 *   - API routes (real vs placeholder)
 *   - Environment schema in os-core
 *
 * Outputs a JSON + Markdown matrix to reports/
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== join(dir, '..')) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = join(dir, '..')
  }
  throw new Error('Cannot find repo root')
}

type Maturity = 'production-grade' | 'pilot-grade' | 'internal/admin' | 'scaffold'

interface AppAssessment {
  app: string
  maturity: Maturity
  hasMiddleware: boolean
  hasRateLimiting: boolean
  hasRequestId: boolean
  hasOsCore: boolean
  hasHealthRoute: boolean
  hasTests: boolean
  hasEnvSchema: boolean
  apiRouteCount: number
  score: number
  gaps: string[]
}

function walkDir(dir: string, maxDepth = 5, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return []
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.next', '.turbo'].includes(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...walkDir(full, maxDepth, depth + 1))
      } else {
        results.push(full)
      }
    }
  } catch { /* permission error */ }
  return results
}

function countApiRoutes(appDir: string): number {
  const apiDir = join(appDir, 'app', 'api')
  if (!existsSync(apiDir)) return 0
  return walkDir(apiDir).filter(f => /route\.(ts|tsx)$/.test(f)).length
}

function hasTestFiles(appDir: string): boolean {
  const files = walkDir(appDir)
  return files.some(f => /\.(test|spec)\.(ts|tsx)$/.test(f))
}

const root = findRepoRoot()
const appsDir = join(root, 'apps')
const reportsDir = join(root, 'reports')
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

// Read env.ts once for schema coverage check
const envPath = join(root, 'packages', 'os-core', 'src', 'config', 'env.ts')
const envFile = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''

const assessments: AppAssessment[] = []

for (const app of readdirSync(appsDir)) {
  const appDir = join(appsDir, app)
  if (!statSync(appDir).isDirectory()) continue
  if (!existsSync(join(appDir, 'package.json'))) continue

  const pkgJson = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'))
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }

  const mwPath = join(appDir, 'middleware.ts')
  const hasMiddleware = existsSync(mwPath)
  const mwContent = hasMiddleware ? readFileSync(mwPath, 'utf-8') : ''
  const hasRateLimiting = mwContent.includes('rateLimit') || mwContent.includes('checkRateLimit')
  const hasRequestId = mwContent.includes('x-request-id')

  const hasOsCore = !!deps['@nzila/os-core']
  const hasHealthRoute = existsSync(join(appDir, 'app', 'api', 'health', 'route.ts'))
  const hasTests = hasTestFiles(appDir)
  const hasEnvSchema = envFile.includes(`'${app}'`)
  const apiRouteCount = countApiRoutes(appDir)

  const gaps: string[] = []
  if (!hasMiddleware) gaps.push('no middleware.ts')
  if (hasMiddleware && !hasRateLimiting) gaps.push('middleware missing rate limiting')
  if (hasMiddleware && !hasRequestId) gaps.push('middleware missing request-ID')
  if (!hasOsCore) gaps.push('no @nzila/os-core dependency')
  if (!hasHealthRoute) gaps.push('no /api/health route')
  if (!hasTests) gaps.push('no test files')
  if (!hasEnvSchema) gaps.push('no Zod env schema in os-core')
  if (apiRouteCount === 0) gaps.push('no API routes')

  // Score: 1 point per capability
  const score = [hasMiddleware, hasRateLimiting, hasRequestId, hasOsCore, hasHealthRoute, hasTests, hasEnvSchema, apiRouteCount > 0]
    .filter(Boolean).length

  // Classification uses both score and domain signals
  // internal/admin: admin dashboards, not customer-facing
  const INTERNAL_APPS = new Set(['platform-admin'])
  // pilot-grade: verticals with limited test coverage or early-stage data integration
  const PILOT_APPS = new Set(['mobility', 'mobility-client-portal', 'trade', 'agrimo', 'cora'])

  let maturity: Maturity
  if (INTERNAL_APPS.has(app)) {
    maturity = 'internal/admin'
  } else if (score <= 3) {
    maturity = 'scaffold'
  } else if (PILOT_APPS.has(app) || (!hasTests && score < 8)) {
    maturity = 'pilot-grade'
  } else {
    maturity = 'production-grade'
  }

  assessments.push({
    app, maturity, hasMiddleware, hasRateLimiting, hasRequestId,
    hasOsCore, hasHealthRoute, hasTests, hasEnvSchema, apiRouteCount, score, gaps,
  })
}

// Sort by score descending
assessments.sort((a, b) => b.score - a.score)

// Summary
const summary = {
  'production-grade': assessments.filter(a => a.maturity === 'production-grade').length,
  'pilot-grade': assessments.filter(a => a.maturity === 'pilot-grade').length,
  'internal/admin': assessments.filter(a => a.maturity === 'internal/admin').length,
  scaffold: assessments.filter(a => a.maturity === 'scaffold').length,
}

// Write JSON
const report = { generatedAt: new Date().toISOString(), summary, assessments }
writeFileSync(join(reportsDir, 'portfolio-maturity.json'), JSON.stringify(report, null, 2))

// Write Markdown
const md = [
  '# NzilaOS Portfolio Maturity Matrix',
  '',
  `> Generated: ${report.generatedAt}`,
  '',
  `| Maturity | Count |`,
  `|----------|-------|`,
  ...Object.entries(summary).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## App Assessment',
  '',
  '| App | Maturity | Score | MW | RL | RID | Core | Health | Tests | Env | APIs | Gaps |',
  '|-----|----------|-------|----|----|-----|------|--------|-------|-----|------|------|',
  ...assessments.map(a => {
    const y = '✅'
    const n = '❌'
    return `| ${a.app} | ${a.maturity} | ${a.score}/8 | ${a.hasMiddleware ? y : n} | ${a.hasRateLimiting ? y : n} | ${a.hasRequestId ? y : n} | ${a.hasOsCore ? y : n} | ${a.hasHealthRoute ? y : n} | ${a.hasTests ? y : n} | ${a.hasEnvSchema ? y : n} | ${a.apiRouteCount} | ${a.gaps.join(', ') || '—'} |`
  }),
  '',
  '## Legend',
  '',
  '- **MW**: middleware.ts present',
  '- **RL**: Rate limiting in middleware',
  '- **RID**: Request-ID propagation',
  '- **Core**: @nzila/os-core dependency',
  '- **Health**: /api/health route',
  '- **Tests**: Test files present',
  '- **Env**: Zod env schema in os-core',
  '- **APIs**: Number of API route files',
  '',
].join('\n')
writeFileSync(join(reportsDir, 'portfolio-maturity.md'), md)

// Print summary
console.log('\n══════════════════════════════════════════════════════════════')
console.log('  NzilaOS Portfolio Maturity Matrix')
console.log('══════════════════════════════════════════════════════════════\n')
for (const a of assessments) {
  const icon = a.maturity === 'production-grade' ? '🟢' : a.maturity === 'pilot-grade' ? '🟡' : a.maturity === 'internal/admin' ? '🔵' : '🟠'
  console.log(`${icon} ${a.app.padEnd(25)} ${a.maturity.padEnd(20)} ${a.score}/8  ${a.gaps.length > 0 ? `[${a.gaps.join(', ')}]` : ''}`)
}
console.log(`\n  Production-Grade: ${summary['production-grade']}  |  Pilot-Grade: ${summary['pilot-grade']}  |  Internal/Admin: ${summary['internal/admin']}  |  Scaffold: ${summary.scaffold}`)
console.log('\n  Reports written to reports/portfolio-maturity.{json,md}\n')
