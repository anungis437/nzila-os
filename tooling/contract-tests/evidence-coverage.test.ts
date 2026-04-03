/**
 * Contract test: Evidence coverage for mutation actions.
 *
 * EVD-001: All Zonga action files with INSERT/UPDATE/DELETE mutations must import evidence hooks
 * EVD-002: Financial action files must call buildEvidencePackFromAction
 *
 * Read-only / low-risk modules are excluded (search, listener, streaming, notification).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const ZONGA_ACTIONS = join(ROOT, 'apps', 'zonga', 'lib', 'actions')

/** Action files that are read-only or low-risk (no financial/governance mutations). */
const EXEMPT_FILES = new Set([
  'search-actions.ts',       // read-only queries
  'listener-actions.ts',     // profile/preference UX state
  'streaming-actions.ts',    // read-only streaming URL generation
  'notification-actions.ts', // internal plumbing / UX state
])

/** Action files with financial or governance mutations that MUST have evidence. */
const FINANCIAL_FILES = new Set([
  'payout-actions.ts',
  'revenue-actions.ts',
  'subscription-actions.ts',
  'rights-actions.ts',
  'compliance-actions.ts',
])

function listActionFiles(): string[] {
  if (!existsSync(ZONGA_ACTIONS)) return []
  return readdirSync(ZONGA_ACTIONS)
    .filter((f) => f.endsWith('-actions.ts'))
}

describe('EVD-001: Mutation action files import evidence hooks', () => {
  const actionFiles = listActionFiles().filter((f) => !EXEMPT_FILES.has(f))

  it.each(actionFiles)('%s must import buildEvidencePackFromAction', (file) => {
    const src = readFileSync(join(ZONGA_ACTIONS, file), 'utf-8')

    // Only check files that actually perform mutations
    const hasMutation =
      /\bINSERT INTO\b/i.test(src) ||
      /\bUPDATE\b.*\bSET\b/i.test(src) ||
      /\bDELETE FROM\b/i.test(src) ||
      /\bexecuteCommand\(/i.test(src)

    if (!hasMutation) return // pure-read file — skip

    expect(src).toContain('buildEvidencePackFromAction')
  })
})

describe('EVD-002: Financial action files call processEvidencePack', () => {
  const financialFiles = listActionFiles().filter((f) => FINANCIAL_FILES.has(f))

  it.each(financialFiles)('%s must call processEvidencePack', (file) => {
    const src = readFileSync(join(ZONGA_ACTIONS, file), 'utf-8')
    expect(src).toContain('processEvidencePack')
  })
})
