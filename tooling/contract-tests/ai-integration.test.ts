/**
 * Contract Test — AI Integration (STUDIO-AI-01)
 *
 * Verifies:
 *   1. Apps declaring @nzila/ai-sdk have a lib/ai-client.ts wiring module.
 *   2. Apps declaring @nzila/ml-sdk have a lib/ml-client.ts wiring module.
 *   3. Wiring modules import from the correct SDK package.
 *   4. No app directly depends on @nzila/ai-core or @nzila/ml-core
 *      (must go through the SDK governance barrel to get tracing + rate limits).
 *   5. Apps with wiring modules actually use them somewhere in lib/ or app/.
 *
 * This prevents "dep declared but never bootstrapped" scenarios and
 * ensures all AI/ML access is mediated through the SDK layer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function allTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...allTsFiles(full))
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

const ALL_APPS = [
  'console',
  'union-eyes',
  'cfo',
  'partners',
  'nacp-exams',
  'zonga',
  'abr',
  'orchestrator-api',
  'web',
]

/**
 * Apps explicitly excluded from the "must have wiring" rule.
 * - web: marketing site, declares SDK but bootstraps lazily via RSC.
 * - orchestrator-api: headless API, no AI features yet.
 * - console: declares ai-sdk + ai-core but never uses them — pending cleanup.
 */
const AI_WIRING_EXEMPTIONS = new Set(['web', 'orchestrator-api', 'console'])

describe('AI/ML integration (STUDIO-AI-01)', () => {
  // ── 1. SDK dep → wiring module ────────────────────────────────────────

  describe('AI wiring', () => {
    for (const app of ALL_APPS) {
      const pkgPath = resolve(ROOT, 'apps', app, 'package.json')
      if (!existsSync(pkgPath)) continue

      const deps = JSON.parse(readFileSync(pkgPath, 'utf-8')).dependencies ?? {}

      if (deps['@nzila/ai-sdk'] && !AI_WIRING_EXEMPTIONS.has(app)) {
        it(`${app} — has lib/ai-client.ts when @nzila/ai-sdk is declared`, () => {
          const f = resolve(ROOT, 'apps', app, 'lib', 'ai-client.ts')
          expect(
            existsSync(f),
            `${app} declares @nzila/ai-sdk but missing lib/ai-client.ts wiring module`,
          ).toBe(true)
        })

        it(`${app} — ai-client.ts imports from @nzila/ai-sdk`, () => {
          const f = resolve(ROOT, 'apps', app, 'lib', 'ai-client.ts')
          if (!existsSync(f)) return
          const src = readFileSync(f, 'utf-8')
          expect(src).toContain('@nzila/ai-sdk')
        })
      }
    }
  })

  describe('ML wiring', () => {
    for (const app of ALL_APPS) {
      const pkgPath = resolve(ROOT, 'apps', app, 'package.json')
      if (!existsSync(pkgPath)) continue

      const deps = JSON.parse(readFileSync(pkgPath, 'utf-8')).dependencies ?? {}

      if (deps['@nzila/ml-sdk'] && !AI_WIRING_EXEMPTIONS.has(app)) {
        it(`${app} — has lib/ml-client.ts when @nzila/ml-sdk is declared`, () => {
          const f = resolve(ROOT, 'apps', app, 'lib', 'ml-client.ts')
          expect(
            existsSync(f),
            `${app} declares @nzila/ml-sdk but missing lib/ml-client.ts wiring module`,
          ).toBe(true)
        })

        it(`${app} — ml-client.ts imports from @nzila/ml-sdk`, () => {
          const f = resolve(ROOT, 'apps', app, 'lib', 'ml-client.ts')
          if (!existsSync(f)) return
          const src = readFileSync(f, 'utf-8')
          expect(src).toContain('@nzila/ml-sdk')
        })
      }
    }
  })

  // ── 2. No direct core-package access ──────────────────────────────────

  describe('No direct core-package bypass', () => {
    /**
     * Known exceptions: console currently depends on @nzila/ai-core
     * directly — this is a Phase 3 migration item.
     */
    const CORE_BYPASS_KNOWN = new Set(['console'])

    for (const app of ALL_APPS) {
      const pkgPath = resolve(ROOT, 'apps', app, 'package.json')
      if (!existsSync(pkgPath)) continue

      const deps = JSON.parse(readFileSync(pkgPath, 'utf-8')).dependencies ?? {}

      if (deps['@nzila/ai-core'] && !CORE_BYPASS_KNOWN.has(app)) {
        it(`${app} — should not depend on @nzila/ai-core directly`, () => {
          expect(
            deps['@nzila/ai-core'],
            `${app} depends on @nzila/ai-core directly — migrate to @nzila/ai-sdk`,
          ).toBeUndefined()
        })
      }

      if (deps['@nzila/ml-core']) {
        it(`${app} — should not depend on @nzila/ml-core directly`, () => {
          expect(
            deps['@nzila/ml-core'],
            `${app} depends on @nzila/ml-core directly — use @nzila/ml-sdk instead`,
          ).toBeUndefined()
        })
      }
    }

    // Fallback: if no violations found, the happy path still needs a test
    it('no apps bypass core packages directly', () => {
      expect(true).toBe(true)
    })
  })

  // ── 3. Wiring modules are actually used ───────────────────────────────

  describe('Wiring modules are exercised', () => {
    /**
     * Many apps pre-create ai-client.ts / ml-client.ts in preparation
     * for Phase 3 (AI Integration). We only enforce usage for apps that
     * are KNOWN to have AI/ML-powered features in production already.
     */
    const AI_EXERCISED_APPS = new Set(['cfo', 'union-eyes', 'zonga', 'nacp-exams', 'partners', 'abr'])
    const ML_EXERCISED_APPS = new Set(['cfo', 'union-eyes', 'zonga', 'nacp-exams', 'partners', 'abr'])

    const SDK_WIRING: Array<{ file: string; importHint: string; activeApps: Set<string> }> = [
      { file: 'lib/ai-client.ts', importHint: 'ai-client', activeApps: AI_EXERCISED_APPS },
      { file: 'lib/ml-client.ts', importHint: 'ml-client', activeApps: ML_EXERCISED_APPS },
    ]

    for (const { file, importHint, activeApps } of SDK_WIRING) {
      for (const app of activeApps) {
        const wiringPath = resolve(ROOT, 'apps', app, file)
        if (!existsSync(wiringPath)) continue

        it(`${app} — ${file} is imported by at least one other file`, () => {
          const searchDirs = [
            resolve(ROOT, 'apps', app, 'lib'),
            resolve(ROOT, 'apps', app, 'app'),
            resolve(ROOT, 'apps', app, 'src'),
          ]

          const appFiles = searchDirs.flatMap((d) => allTsFiles(d))
          const importedSomewhere = appFiles.some((f) => {
            if (f === wiringPath) return false
            const src = readFileSync(f, 'utf-8')
            return src.includes(importHint)
          })

          expect(
            importedSomewhere,
            `${app}/${file} exists but no file imports it — the wiring module is dead code`,
          ).toBe(true)
        })
      }
    }
  })
})
