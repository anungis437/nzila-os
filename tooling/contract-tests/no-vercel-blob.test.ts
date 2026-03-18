/**
 * Contract Test — No Direct @vercel/blob Usage (STUDIO-BLOB-01)
 *
 * Verifies:
 *   No app source file imports from @vercel/blob directly.
 *   All blob storage operations must go through @nzila/blob or a local
 *   lib/blob-client.ts bridge that wraps @nzila/blob.
 *
 *   This ensures the platform is provider-agnostic (Azure Blob Storage today)
 *   and that all uploads/downloads flow through the observability and
 *   evidence layer.
 *
 * Exemptions:
 *   - package.json files (the dependency may still be declared for type compat)
 *   - node_modules
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

const APPS = [
  'console',
  'partners',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
  'union-eyes',
  'web',
]

describe('No direct @vercel/blob imports in app source', () => {
  for (const app of APPS) {
    it(`${app} — no source files import @vercel/blob`, () => {
      const appDir = resolve(ROOT, 'apps', app)
      let output = ''
      try {
        output = execSync(
          `git grep -rn "@vercel/blob" -- "apps/${app}/" ":!apps/${app}/package.json" ":!apps/${app}/node_modules" ":!apps/${app}/.next"`,
          { cwd: ROOT, encoding: 'utf-8' },
        )
      } catch {
        // git grep exits non-zero when no matches found — that's what we want
        output = ''
      }

      if (output.trim()) {
        const lines = output
          .trim()
          .split('\n')
          .filter((l) => !l.includes('package.json'))
        expect(
          lines,
          `Found direct @vercel/blob imports in ${app}:\n${lines.join('\n')}`,
        ).toHaveLength(0)
      }
    })
  }
})
