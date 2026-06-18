import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const PANEL_PATH = resolve(
  ROOT,
  'apps/console/app/(dashboard)/workspace/operations/_components/ai-management-panel.tsx',
)
const LOADER_PATH = resolve(ROOT, 'apps/console/app/(dashboard)/workspace/_lib/ai-management.ts')

describe('Console AI management is real', () => {
  it('panel does not contain scaffolded roadmap wording', () => {
    const src = readFileSync(PANEL_PATH, 'utf-8')
    expect(src).not.toMatch(/Roadmap|Not yet wired|scaffolded/i)
  })

  it('panel links to live Console AI and ML surfaces', () => {
    const src = readFileSync(PANEL_PATH, 'utf-8')
    for (const route of [
      '/console/ml/overview',
      '/console/ai/models',
      '/console/ai/usage',
      '/console/ai/actions',
      '/console/ai/knowledge',
    ]) {
      expect(src).toContain(route)
    }
  })

  it('loader reads real AI governance tables', () => {
    const src = readFileSync(LOADER_PATH, 'utf-8')
    for (const token of [
      'aiRequests',
      'aiUsageBudgets',
      'aiKnowledgeSources',
      'aiActions',
      'aiDeploymentRoutes',
      'aiModels',
      'aiDeployments',
    ]) {
      expect(src).toContain(token)
    }
  })
})
