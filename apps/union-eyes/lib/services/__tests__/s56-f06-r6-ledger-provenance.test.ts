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

const f06 = source.batches.filter((batch) => /^B1(0[5-9]|[1-9]\d)-F06-/.test(batch.id))

// Files a batch named as evidence that were deleted afterwards, each with the reason.
const REMOVED_LATER: Record<string, string> = {
  'apps/union-eyes/lib/email/report-email-templates.ts':
    'dead code (nothing that runs reaches it) deleted with the scheduled-report executor it served, in the mismatch census (UE-CONV-H-017); the batch commit holds the file',
  'apps/union-eyes/lib/email/__tests__/report-email-templates.test.ts': 'the test of the deleted module above',
  'apps/union-eyes/actions/icra/get-adaptive-resolution.ts':
    'unmounted code (no page, route or component imports it) deleted in the orphan census (UE-CONV-H-027); the batch commit holds the file',
  'apps/union-eyes/components/dashboards/nzila-ops-dashboard.tsx':
    'unmounted UI (no page renders it) deleted in the orphan census (UE-CONV-H-027); the batch commit holds the file',
}

describe('F06 ledger provenance', () => {
  it('records the defects touched by every F06 batch from B105, including in-place upgrades', () => {
    expect(f06.length).toBeGreaterThanOrEqual(13)
    for (const batch of f06) expect(batch.touches?.length ?? 0, batch.id).toBeGreaterThan(0)
  })

  it('names the commit of every F06 batch', () => {
    for (const batch of f06) expect(batch.evidenceCommit, batch.id).toMatch(/^[0-9a-f]{9,40}$/)
  })

  it('lists, for the small-group suppression defect, B111 and its commit alongside the later R2 step', () => {
    const id = Object.keys(built.entries).find((key) => key.startsWith('DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL'))
    const history = built.entries[id as string].history ?? []
    const b111 = history.find((step) => step.batch.startsWith('B111-'))
    expect(b111?.evidenceCommit).toBe('b15818963')
    expect(b111?.files.some((file) => file.endsWith('lib/reports/report-config-validation.ts'))).toBe(true)
    expect(history.some((step) => step.batch.startsWith('B113-'))).toBe(true)
    expect(built.entries[id as string].status).toBe('IMPLEMENTED_PENDING_QUALIFICATION')
  })

  it('names only source files that exist, so the evidence is recoverable', () => {
    for (const batch of f06) {
      for (const touch of batch.touches ?? []) {
        for (const file of touch.files) {
          // A file the census later proves nothing reaches is deleted; the evidence then lives in the batch's commit.
          if (file in REMOVED_LATER) continue
          expect(fs.existsSync(path.join(root, file)), `${batch.id}: ${file}`).toBe(true)
        }
      }
    }
  })

  it('names each file removed since its batch with the reason, and only while the file is gone', () => {
    for (const file of Object.keys(REMOVED_LATER)) expect(fs.existsSync(path.join(root, file)), `${file} exists again: remove it from REMOVED_LATER`).toBe(false)
  })

  it('does not change the credit: every touched defect is counted once', () => {
    const credited = Object.values(built.entries).filter((entry) => entry.status === 'IMPLEMENTED_PENDING_QUALIFICATION').length
    expect(credited).toBe(built.totals.implementedPendingQualification)
  })
})
