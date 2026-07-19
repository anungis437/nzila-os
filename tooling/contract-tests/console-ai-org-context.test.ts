import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

const AI_PAGES = [
  'apps/console/app/(dashboard)/console/ai/overview/page.tsx',
  'apps/console/app/(dashboard)/console/ai/actions/page.tsx',
  'apps/console/app/(dashboard)/console/ai/models/page.tsx',
  'apps/console/app/(dashboard)/console/ai/usage/page.tsx',
  'apps/console/app/(dashboard)/console/ai/knowledge/page.tsx',
  'apps/console/app/(dashboard)/workspace/_lib/ai-management.ts',
] as const

describe('Console AI uses active org context', () => {
  it('resolves entity context from active org membership', () => {
    for (const relativePath of AI_PAGES) {
      const absolutePath = resolve(ROOT, relativePath)
      const src = readFileSync(absolutePath, 'utf-8')
      expect(src).toContain('resolveConsoleEntityId')
    }
  })

  it('does not hard-pin AI pages to env-only entity id', () => {
    for (const relativePath of AI_PAGES) {
      const absolutePath = resolve(ROOT, relativePath)
      const src = readFileSync(absolutePath, 'utf-8')
      expect(src).not.toMatch(/const\s+DEFAULT_ENTITY_ID\s*=\s*process\.env\.NZILA_DEFAULT_ENTITY_ID/)
    }
  })
})
