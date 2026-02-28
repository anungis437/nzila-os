/**
 * Contract Test — Agri App Config Compliance
 *
 * AGRI_APP_CONFIG_006:
 *   1. Both Pondu and Cora have required config files
 *   2. Security headers are present in next.config.ts
 *   3. tsconfig extends @nzila/config
 *   4. Vitest config uses defineProject
 *
 * @invariant AGRI_APP_CONFIG_006
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '../..')

const APPS = ['pondu', 'cora'] as const

for (const app of APPS) {
  const APP_DIR = join(ROOT, 'apps', app)

  describe(`AGRI-CFG-01 — ${app} has required config files`, () => {
    const required = [
      'package.json',
      'tsconfig.json',
      'next.config.ts',
      'vitest.config.ts',
      'app/layout.tsx',
    ]
    for (const file of required) {
      it(`${file} exists`, () => {
        expect(existsSync(join(APP_DIR, file))).toBe(true)
      })
    }
    it('app/page.tsx exists', () => {
      const hasRoot = existsSync(join(APP_DIR, 'app/page.tsx'))
      const hasMarketing = existsSync(join(APP_DIR, 'app/(marketing)/page.tsx'))
      expect(hasRoot || hasMarketing).toBe(true)
    })
  })

  describe(`AGRI-CFG-02 — ${app} security headers`, () => {
    it('next.config.ts has security headers', () => {
      const path = join(APP_DIR, 'next.config.ts')
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('Strict-Transport-Security')
      expect(content).toContain('X-Frame-Options')
      expect(content).toContain('X-Content-Type-Options')
    })
  })

  describe(`AGRI-CFG-03 — ${app} tsconfig extends @nzila/config`, () => {
    it('tsconfig.json extends @nzila/config/tsconfig/nextjs', () => {
      const path = join(APP_DIR, 'tsconfig.json')
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('@nzila/config/tsconfig/nextjs')
    })
  })

  describe(`AGRI-CFG-04 — ${app} vitest uses defineProject`, () => {
    it('vitest.config.ts uses defineProject', () => {
      const path = join(APP_DIR, 'vitest.config.ts')
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('defineProject')
    })
  })

  describe(`AGRI-CFG-05 — ${app} uses ClerkProvider`, () => {
    it('layout.tsx wraps with ClerkProvider', () => {
      const path = join(APP_DIR, 'app', 'layout.tsx')
      if (!existsSync(path)) return
      const content = readFileSync(path, 'utf-8')
      expect(content).toContain('ClerkProvider')
    })
  })
}
