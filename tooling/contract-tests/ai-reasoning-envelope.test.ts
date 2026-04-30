/**
 * Contract Test — AI Reasoning Envelope (AIGOV-ENV-01)
 *
 * Verifies that the AI SDK exposes — and downstream code uses — the
 * reasoning context envelope (`AiTrace` + per-response `requestId`) so that
 * every model invocation can be correlated end-to-end and audited per
 * PIPEDA OPC Proposal #9 (algorithmic traceability) and EU AI Act Art. 12
 * (recordkeeping).
 *
 * This test enforces lifecycle gate G5 in `governance/ai/lifecycle-gates.md`.
 *
 * Specifically asserts:
 *   1. `@nzila/ai-core` types module exports the `AiTrace` interface and the
 *      response shapes carry `requestId`, `model`, `tokensIn`, `tokensOut`,
 *      `latencyMs`, `costUsd`.
 *   2. The Zod schemas in `@nzila/ai-core` mirror `trace.correlationId` so
 *      the envelope is enforceable at API boundaries.
 *   3. The `@nzila/ai-sdk` barrel re-exports `AiTrace`.
 *   4. App wiring modules (lib/ai-client.ts) propagate a correlation id —
 *      heuristic check for `correlationId` or `requestId` token in the file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')

const AI_CORE_TYPES = resolve(ROOT, 'packages/ai-core/src/types.ts')
const AI_CORE_SCHEMAS = resolve(ROOT, 'packages/ai-core/src/schemas.ts')
const AI_SDK_INDEX = resolve(ROOT, 'packages/ai-sdk/src/index.ts')

describe('AI reasoning envelope (AIGOV-ENV-01)', () => {
  it('@nzila/ai-core defines the AiTrace envelope', () => {
    expect(existsSync(AI_CORE_TYPES)).toBe(true)
    const src = readFileSync(AI_CORE_TYPES, 'utf-8')
    expect(src, 'AiTrace interface missing from ai-core/types.ts').toMatch(
      /export\s+interface\s+AiTrace\b/,
    )
    expect(src).toMatch(/correlationId\??:\s*string/)
  })

  it('AiGenerateResponse carries requestId + model + cost + latency', () => {
    const src = readFileSync(AI_CORE_TYPES, 'utf-8')
    const block = src.match(/AiGenerateResponse[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block, 'AiGenerateResponse not found').toBeTruthy()
    for (const field of ['requestId', 'model', 'tokensIn', 'tokensOut', 'latencyMs', 'costUsd']) {
      expect(block, `AiGenerateResponse missing required envelope field "${field}"`).toContain(field)
    }
  })

  it('@nzila/ai-core Zod schemas mirror the trace envelope', () => {
    expect(existsSync(AI_CORE_SCHEMAS)).toBe(true)
    const src = readFileSync(AI_CORE_SCHEMAS, 'utf-8')
    // Should appear in at least the generate / embed / extract request schemas
    const occurrences = (src.match(/trace:\s*z\.object\(/g) ?? []).length
    expect(
      occurrences,
      'Expected trace envelope mirrored in at least 3 Zod schemas (generate, extract, embed/rag, action)',
    ).toBeGreaterThanOrEqual(3)
  })

  it('@nzila/ai-sdk barrel re-exports AiTrace', () => {
    expect(existsSync(AI_SDK_INDEX)).toBe(true)
    const src = readFileSync(AI_SDK_INDEX, 'utf-8')
    expect(src).toMatch(/AiTrace/)
  })

  // ── App wiring propagates correlation ────────────────────────────────────
  // For every app that has a lib/ai-client.ts wiring module, the file should
  // mention correlationId or requestId so that traces are propagated rather
  // than dropped on the floor. This is a heuristic, not a deep check.
  describe('app wiring propagates correlation', () => {
    const appsDir = resolve(ROOT, 'apps')
    if (!existsSync(appsDir)) return

    const apps = readdirSync(appsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    for (const app of apps) {
      const wiringFiles = ['lib/ai-client.ts', 'lib/ai-server.ts'].map(p =>
        join(appsDir, app, p),
      )
      for (const f of wiringFiles) {
        if (!existsSync(f)) continue
        const src = readFileSync(f, 'utf-8')
        // Skip pure re-export shims (small files that just `export { ... } from`)
        const isReExportShim =
          src.length < 800 && /export\s*\{[^}]+\}\s*from\s*['"]/.test(src)
        if (isReExportShim) continue
        const relF = f.replace(ROOT + '\\', '').replace(ROOT + '/', '')
        it(`${app} :: ${relF} references correlation/requestId`, () => {
          expect(
            /correlationId|requestId|AiTrace/.test(src),
            `${app}'s AI wiring should propagate AiTrace.correlationId or requestId`,
          ).toBe(true)
        })
      }
    }
  })
})
