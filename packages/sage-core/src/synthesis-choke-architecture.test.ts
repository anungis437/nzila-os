import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Architectural regression: evidence-bearing retrieval entry points in
 * services.ts MUST call applyAuthorizedEvidenceContextChoke (or the export
 * wrapper that itself calls the choke). If a new list/get/context path is
 * added without the choke, this test fails.
 */
const SERVICES = readFileSync(join(__dirname, 'services.ts'), 'utf8')
const INSTITUTIONAL = readFileSync(join(__dirname, 'institutional-context.ts'), 'utf8')
const SYNTHESIS = readFileSync(join(__dirname, 'synthesis-context.ts'), 'utf8')

function extractFunction(source: string, name: string): string {
  const re = new RegExp(
    `export async function ${name}\\([\\s\\S]*?\\n\\}(?=\\n\\n|\\nexport |\\n/\\*|\\n$)`,
  )
  const m = source.match(re)
  if (!m) {
    // try non-async or internal async function
    const re2 = new RegExp(
      `(?:export )?async function ${name}\\([\\s\\S]*?\\n\\}(?=\\n\\n|\\nexport |\\n/\\*|\\n$)`,
    )
    const m2 = source.match(re2)
    if (!m2) throw new Error(`function ${name} not found in services.ts`)
    return m2[0]
  }
  return m[0]
}

const REQUIRED_ENTRY_POINTS = [
  'listSageEvidenceSources',
  'listSageEvidenceItems',
  'getSageEvidenceSource',
  'getSageEvidenceItem',
  'listSageBoundaryFlags',
  'listSageReviewNotes',
  'listSageDecisionRecords',
  'getSageDecisionRecord',
  'buildSageInstitutionalQaContextForWorkspace',
  'generateSageExportPackage',
] as const

describe('synthesis-safety choke — architectural wiring', () => {
  it('defines applyAuthorizedEvidenceContextChoke as the canonical marker', () => {
    expect(SYNTHESIS).toMatch(/export function applyAuthorizedEvidenceContextChoke/)
  })

  it('institutional-context wrappers call the choke', () => {
    expect(INSTITUTIONAL).toMatch(/applyAuthorizedEvidenceContextChoke/)
    expect(INSTITUTIONAL).toMatch(/filterExportEvidenceResourcesThroughAuthorizedContext/)
  })

  for (const name of REQUIRED_ENTRY_POINTS) {
    it(`${name} calls applyAuthorizedEvidenceContextChoke or export filter wrapper`, () => {
      const body = extractFunction(SERVICES, name)
      const wired =
        body.includes('applyAuthorizedEvidenceContextChoke') ||
        body.includes('filterExportEvidenceResourcesThroughAuthorizedContext') ||
        body.includes('buildSageInstitutionalQaContext')
      expect(wired, `${name} must call the synthesis-safety choke`).toBe(true)
    })
  }

  it('redactDecisionReferences (decision evidence refs) calls the choke', () => {
    const body = extractFunction(SERVICES, 'redactDecisionReferences')
    expect(body).toContain('applyAuthorizedEvidenceContextChoke')
  })
})
