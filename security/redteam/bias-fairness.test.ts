/**
 * Nzila OS — AI Bias & Fairness Red-Team Tests
 * iSSDLC W1-2: Bias/fairness testing in red-team CI
 *
 * Tests that AI features do not exhibit demographic bias in triage,
 * classification, or priority assignment.
 *
 * @security BIAS-001 through BIAS-006
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── BIAS-001: Triage model has no demographic features ──────────────────

describe('BIAS-001 — Triage model does not use demographic features', () => {
  const triagePath = join(ROOT, 'apps', 'union-eyes', 'lib', 'ai', 'grievance-triage.ts')

  it('triage prompt does not reference protected characteristics', () => {
    if (!existsSync(triagePath)) return
    const content = readFileSync(triagePath, 'utf-8')
    const protectedTerms = [
      /\brace\b/i,
      /\bgender\b/i,
      /\bethnici?ty?\b/i,
      /\breligion\b/i,
      /\bsexual\s*orient/i,
      /\bdisabilit/i,
      /\bage\b(?!.*expir)/i,  // age but not "age" in expiration context
      /\bnational\s*origin/i,
    ]
    for (const pattern of protectedTerms) {
      // Allow if in comments/docs, but not in prompt construction
      const lines = content.split('\n')
      const codeLines = lines.filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      const codeContent = codeLines.join('\n')
      const match = codeContent.match(pattern)
      if (match) {
        // Verify it's in a non-prompt context (e.g., anti-discrimination policy check)
        expect(codeContent).not.toMatch(new RegExp(`(prompt|system|message).*${pattern.source}`, 'i'))
      }
    }
  })
})

// ── BIAS-002: Priority model treats all provinces equally ───────────────

describe('BIAS-002 — Priority assignment is jurisdiction-neutral', () => {
  const triagePath = join(ROOT, 'apps', 'union-eyes', 'lib', 'ai', 'grievance-triage.ts')

  it('no hardcoded priority boost by province', () => {
    if (!existsSync(triagePath)) return
    const content = readFileSync(triagePath, 'utf-8')
    // Priority should be based on case merit, not geography
    expect(content).not.toMatch(/if\s*\(.*province.*===.*\)\s*\{?\s*(priority|score)\s*[+\-=]/)
    expect(content).not.toMatch(/québec|ontario|alberta|british columbia/i)
  })
})

// ── BIAS-003: CBA reasoning respects all agreement types ────────────────

describe('BIAS-003 — CBA clause reasoning has no agreement-type bias', () => {
  it('clause reasoning does not favor specific unions/locals', () => {
    const clausePath = join(ROOT, 'apps', 'union-eyes', 'lib', 'ai')
    if (!existsSync(clausePath)) return
    const { readdirSync } = require('node:fs')
    const files = readdirSync(clausePath).filter((f: string) => f.endsWith('.ts'))
    for (const file of files) {
      const content = readFileSync(join(clausePath, file), 'utf-8')
      // No hardcoded union/local names in prompt construction
      expect(content).not.toMatch(/if\s*\(.*union.*===\s*['"]/)
      expect(content).not.toMatch(/if\s*\(.*local.*===\s*['"]/)
    }
  })
})

// ── BIAS-004: Budget enforcement is uniform across orgs ─────────────────

describe('BIAS-004 — AI budget enforcement is uniform across organizations', () => {
  const budgetsPath = join(ROOT, 'packages', 'ai-core', 'src', 'budgets.ts')

  it('checkBudget uses org-level thresholds without org-specific overrides', () => {
    if (!existsSync(budgetsPath)) return
    const content = readFileSync(budgetsPath, 'utf-8')
    // Budget checks should be profile-based, not org-name-based
    expect(content).not.toMatch(/if\s*\(.*orgId\s*===\s*['"]/)
    expect(content).not.toMatch(/if\s*\(.*orgName\s*===\s*['"]/)
  })
})

// ── BIAS-005: Model evaluation tracks fairness metrics ──────────────────

describe('BIAS-005 — AI telemetry captures data needed for fairness auditing', () => {
  const loggingPath = join(ROOT, 'packages', 'ai-core', 'src', 'logging.ts')

  it('emitAiMetric includes orgId for demographic-slice analysis', () => {
    const content = readFileSync(loggingPath, 'utf-8')
    expect(content).toContain('emitAiMetric')
    expect(content).toContain('orgId')
  })

  it('emitAiMetric includes refused/errored for disparity detection', () => {
    const content = readFileSync(loggingPath, 'utf-8')
    expect(content).toContain('refused')
    expect(content).toContain('errored')
  })
})

// ── BIAS-006: PII redaction is consistent across data classes ───────────

describe('BIAS-006 — PII redaction applies uniformly regardless of data class', () => {
  const gatewayPath = join(ROOT, 'packages', 'ai-core', 'src', 'gateway.ts')

  it('redaction is applied before provider call, not selectively', () => {
    if (!existsSync(gatewayPath)) return
    const content = readFileSync(gatewayPath, 'utf-8')
    // Redaction should happen for all requests, filtered by redaction mode
    expect(content).toContain('redactText')
  })
})
