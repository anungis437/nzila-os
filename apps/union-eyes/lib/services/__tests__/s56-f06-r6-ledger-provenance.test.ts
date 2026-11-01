/**
 * F06 R6: the ledger can say, for every defect, which batch touched it, under which commit, and in which files, including the batches that
 * only upgraded a defect in place (no item of their own). Credit is unchanged: each defect is still counted once.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../../../..')
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const source = read('docs/union-eyes/convergence/remediation/elimination-batches.json') as {
  batches: Array<{ id: string; evidenceCommit: string | null; items: unknown[]; touches?: Array<{ defectId: string; status: string; files: string[] }> }>
}
const built = read('docs/union-eyes/convergence/remediation/ue-gate0-defect-elimination.json') as {
  entries: Record<string, { status: string; history?: Array<{ batch: string; evidenceCommit: string | null; files: string[] }> }>
  totals: { implementedPendingQualification: number }
}

const f06 = source.batches.filter((batch) => /^B1(0[5-9]|[1-9]\d)-/.test(batch.id))

describe('F06 ledger provenance', () => {
  it('records the defects touched by every F06 batch from B105, including in-place upgrades', () => {
    expect(f06.length).toBeGreaterThanOrEqual(13)
    for (const batch of f06) expect(batch.touches?.length ?? 0, batch.id).toBeGreaterThan(0)
  })

  it('names the commit of every F06 batch except the newest, which the next batch fills in', () => {
    for (const batch of f06.slice(0, -1)) expect(batch.evidenceCommit, batch.id).toMatch(/^[0-9a-f]{9,40}$/)
  })

  it('lists, for the small-group suppression defect, B111 and its commit alongside the later R2 step', () => {
    const id = Object.keys(built.entries).find((key) => key.startsWith('DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL'))
    const history = built.entries[id as string].history ?? []
    const b111 = history.find((step) => step.batch.startsWith('B111-'))
    expect(b111?.evidenceCommit).toBe('b15818963')
    expect(b111?.files.some((file) => file.endsWith('lib/reports/report-config-validation.ts'))).toBe(true)
    expect(history.some((step) => step.batch.startsWith('B113-'))).toBe(true)
    expect(built.entries[id as string].status).toBe('PARTIAL')
  })

  it('names only source files that exist, so the evidence is recoverable', () => {
    for (const batch of f06) {
      for (const touch of batch.touches ?? []) {
        for (const file of touch.files) expect(fs.existsSync(path.join(root, file)), `${batch.id}: ${file}`).toBe(true)
      }
    }
  })

  it('does not change the credit: every touched defect is counted once', () => {
    const credited = Object.values(built.entries).filter((entry) => entry.status === 'IMPLEMENTED_PENDING_QUALIFICATION').length
    expect(credited).toBe(built.totals.implementedPendingQualification)
  })
})
