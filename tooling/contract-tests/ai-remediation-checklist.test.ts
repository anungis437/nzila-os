import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const MATRIX_PATH = resolve(ROOT, 'governance/ai/AI_VALIDATION_MATRIX.md')
const REMEDIATION_PATH = resolve(ROOT, 'governance/ai/AI_REMEDIATION_CHECKLIST.md')

describe('AI remediation checklist coverage', () => {
  const matrix = readFileSync(MATRIX_PATH, 'utf-8')
  const remediation = readFileSync(REMEDIATION_PATH, 'utf-8')

  function extractAttentionIds(input: string): string[] {
    const ids: string[] = []
    for (const line of input.split('\n')) {
      if (!line.startsWith('| ')) continue
      if (!line.includes('ACCOUNTED-ATTENTION')) continue
      const cols = line.split('|').map((c) => c.trim())
      // columns: ["", "Surface ID", ...]
      const id = cols[1]
      if (id && id !== 'Surface ID' && /^[a-z0-9][a-z0-9-]*$/.test(id)) ids.push(id)
    }
    return ids
  }

  const attentionIds = extractAttentionIds(matrix)

  it('tracks active attention surfaces or explicitly marks empty queue', () => {
    if (attentionIds.length === 0) {
      expect(remediation).toContain('No active ACCOUNTED-ATTENTION surfaces')
      return
    }
    expect(attentionIds.length).toBeGreaterThan(0)
  })

  it('contains a remediation section for every attention surface', () => {
    const missing = attentionIds.filter((id) => !remediation.includes(`## ${id}`))
    expect(
      missing,
      `Missing remediation sections for: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('contains acceptance criteria for every attention surface', () => {
    const missingCriteria = attentionIds.filter((id) => {
      const start = remediation.indexOf(`## ${id}`)
      if (start < 0) return true
      const next = remediation.indexOf('\n## ', start + 1)
      const block = next < 0 ? remediation.slice(start) : remediation.slice(start, next)
      return !block.includes('Acceptance criteria:')
    })

    expect(
      missingCriteria,
      `Missing acceptance criteria for: ${missingCriteria.join(', ')}`,
    ).toEqual([])
  })
})
