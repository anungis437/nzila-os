import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const UE_AI_CLIENT = resolve(ROOT, 'apps/union-eyes/lib/ai/ai-client.ts')
const CONSOLE_AI_USAGE = resolve(ROOT, 'apps/console/app/(dashboard)/console/ai/usage/page.tsx')
const KEY_UE_FILES = [
  'apps/union-eyes/lib/ai/grievance-triage.ts',
  'apps/union-eyes/lib/ai/steward-copilot.ts',
  'apps/union-eyes/lib/ai/employer-risk.ts',
  'apps/union-eyes/lib/ai/clause-reasoning.ts',
  'apps/union-eyes/lib/ai/executive-insights.ts',
  'apps/union-eyes/lib/ai/financial-insights.ts',
  'apps/union-eyes/lib/ai/pension-intelligence.ts',
  'apps/union-eyes/lib/ai/chatbot-service.ts',
  'apps/union-eyes/app/api/ai/search/route.ts',
  'apps/union-eyes/app/api/ai/summarize/route.ts',
] as const

describe('UE AI client attribution is wired end-to-end', () => {
  it('defines shared UE organization trace helper', () => {
    const src = readFileSync(UE_AI_CLIENT, 'utf-8')
    expect(src).toContain('buildOrgAiTrace')
    expect(src).toContain("domainType: 'organization'")
  })

  it('threads org trace through key Union Eyes AI paths', () => {
    for (const relativePath of KEY_UE_FILES) {
      const src = readFileSync(resolve(ROOT, relativePath), 'utf-8')
      expect(src).toContain('buildOrgAiTrace')
    }
  })

  it('surfaces client-attributed AI activity in Console', () => {
    const src = readFileSync(CONSOLE_AI_USAGE, 'utf-8')
    expect(src).toContain("after_json->>'domainId'")
    expect(src).toContain("action = 'ai.request_executed'")
    expect(src).toContain('Client-Attributed Activity')
  })
})
