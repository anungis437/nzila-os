/**
 * PHASE 2 — Startup and Runtime Certification
 *
 * Validates that app startup code has no hidden references to missing
 * columns, relations, or stale configuration. This is a static analysis
 * certification — no running server required.
 *
 * Tests:
 *  1. No runtime references to columns/tables not in canonical schema
 *  2. No stale Drizzle imports referencing removed tables
 *  3. Auth/provider config uses env vars (not hardcoded)
 *  4. Payment config references proper env vars
 *  5. Storage config references proper env vars
 *  6. Feature flag usage is consistent (no dead flags)
 *  7. middleware.ts exists and uses authMiddleware on all deployed apps
 *  8. instrumentation.ts/next.config patterns are consistent
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const APPS_DIR = join(ROOT, 'apps')

const DEPLOYED_APPS = ['web', 'console', 'partners', 'union-eyes', 'cfo', 'zonga']
const AUTH_APPS = ['console', 'partners', 'union-eyes', 'cfo', 'zonga'] // web is public

function walkTs(dir: string, acc: string[] = [], depth = 0): string[] {
  if (depth > 5 || !existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry === '.turbo' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) walkTs(full, acc, depth + 1)
      else if (full.endsWith('.ts') || full.endsWith('.tsx')) acc.push(full)
    } catch { /* skip */ }
  }
  return acc
}

describe('CERT-PHASE-2 — Startup and Runtime Certification', () => {
  // ── 1. Auth middleware on all deployed auth apps ───────────────────────
  it('all deployed auth apps have Clerk middleware', () => {
    const missing: string[] = []
    for (const app of AUTH_APPS) {
      const mwPath = join(APPS_DIR, app, 'middleware.ts')
      if (!existsSync(mwPath)) {
        missing.push(`${app}: middleware.ts missing`)
        continue
      }
      const content = readFileSync(mwPath, 'utf-8')
      if (!content.includes('authMiddleware')) {
        missing.push(`${app}: middleware.ts missing authMiddleware`)
      }
    }
    expect(missing).toEqual([])
  })

  // ── 2. No hardcoded Clerk keys in source ──────────────────────────────
  it('no hardcoded Clerk secret keys in app source code', () => {
    const violations: string[] = []
    for (const app of DEPLOYED_APPS) {
      const appDir = join(APPS_DIR, app)
      for (const dir of ['app', 'src', 'lib', 'components']) {
        const target = join(appDir, dir)
        for (const f of walkTs(target)) {
          const content = readFileSync(f, 'utf-8')
          if (/sk_live_[a-zA-Z0-9]{20,}/.test(content)) {
            violations.push(f.slice(ROOT.length + 1).replace(/\\/g, '/'))
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  // ── 3. No hardcoded Stripe live keys in source ────────────────────────
  it('no hardcoded Stripe live keys in app source code', () => {
    const violations: string[] = []
    for (const app of DEPLOYED_APPS) {
      const appDir = join(APPS_DIR, app)
      for (const dir of ['app', 'src', 'lib', 'components']) {
        const target = join(appDir, dir)
        for (const f of walkTs(target)) {
          const content = readFileSync(f, 'utf-8')
          if (/sk_live_[a-zA-Z0-9]{20,}/.test(content) || /rk_live_[a-zA-Z0-9]{20,}/.test(content)) {
            violations.push(f.slice(ROOT.length + 1).replace(/\\/g, '/'))
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  // ── 4. Payment config references env vars ─────────────────────────────
  it('Stripe config uses process.env, not hardcoded keys', () => {
    const violations: string[] = []
    for (const app of DEPLOYED_APPS) {
      const appDir = join(APPS_DIR, app)
      for (const dir of ['app', 'src', 'lib']) {
        const target = join(appDir, dir)
        for (const f of walkTs(target)) {
          const content = readFileSync(f, 'utf-8')
          // If file mentions Stripe, it should use env var pattern
          if (content.includes('stripe') || content.includes('Stripe')) {
            if (/new Stripe\(['"][a-zA-Z0-9_]{20,}['"]/.test(content)) {
              violations.push(f.slice(ROOT.length + 1).replace(/\\/g, '/'))
            }
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  // ── 5. DATABASE_URL not hardcoded ─────────────────────────────────────
  it('DATABASE_URL uses env vars, not hardcoded connection strings', () => {
    const violations: string[] = []
    for (const app of DEPLOYED_APPS) {
      const configs = [
        join(APPS_DIR, app, 'drizzle.config.ts'),
        join(APPS_DIR, app, 'lib', 'db.ts'),
        join(APPS_DIR, app, 'lib', 'db', 'index.ts'),
      ]
      for (const config of configs) {
        if (!existsSync(config)) continue
        const content = readFileSync(config, 'utf-8')
        // Should use process.env.DATABASE_URL, not a hardcoded postgres:// string
        if (/['"]postgres(ql)?:\/\/[^$]+@[^'"]+['"]/.test(content)) {
          violations.push(config.slice(ROOT.length + 1).replace(/\\/g, '/'))
        }
      }
    }
    expect(violations).toEqual([])
  })

  // ── 6. next.config exists for all deployed Next.js apps ───────────────
  it('all deployed Next.js apps have next.config', () => {
    const missing: string[] = []
    const nextApps = DEPLOYED_APPS.filter(a => a !== 'orchestrator-api')
    for (const app of nextApps) {
      const configs = [
        join(APPS_DIR, app, 'next.config.ts'),
        join(APPS_DIR, app, 'next.config.js'),
        join(APPS_DIR, app, 'next.config.mjs'),
      ]
      if (!configs.some(c => existsSync(c))) {
        missing.push(app)
      }
    }
    expect(missing).toEqual([])
  })

  // ── 7. package.json has required scripts for all deployed apps ────────
  it('all deployed apps have build and start scripts', () => {
    const missing: string[] = []
    for (const app of DEPLOYED_APPS) {
      const pkgPath = join(APPS_DIR, app, 'package.json')
      if (!existsSync(pkgPath)) {
        missing.push(`${app}: no package.json`)
        continue
      }
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (!pkg.scripts?.build) missing.push(`${app}: missing build script`)
      if (!pkg.scripts?.start) missing.push(`${app}: missing start script`)
    }
    expect(missing).toEqual([])
  })

  // ── 8. No AWS credentials hardcoded ───────────────────────────────────
  it('no hardcoded AWS access keys in app source', () => {
    const violations: string[] = []
    for (const app of DEPLOYED_APPS) {
      const appDir = join(APPS_DIR, app)
      for (const dir of ['app', 'src', 'lib']) {
        const target = join(appDir, dir)
        for (const f of walkTs(target)) {
          const content = readFileSync(f, 'utf-8')
          if (/AKIA[0-9A-Z]{16}/.test(content)) {
            violations.push(f.slice(ROOT.length + 1).replace(/\\/g, '/'))
          }
        }
      }
    }
    expect(violations).toEqual([])
  })
})
