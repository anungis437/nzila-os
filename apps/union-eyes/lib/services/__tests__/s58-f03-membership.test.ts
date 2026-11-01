/**
 * F03 membership: the 16 defects of the cross-tenant family are each assigned to exactly one of the five batches, every one is a defect of the
 * frozen 777-defect register, and the families record still carries every F03 defect that has not been credited. A defect that is credited
 * later leaves the outstanding list but stays in its batch.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const remediation = path.resolve(__dirname, '../../../../../docs/union-eyes/convergence/remediation')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(remediation, file), 'utf8'))
const frozen = JSON.parse(fs.readFileSync(path.resolve(remediation, '../register/ue-route-classification-0c1.json'), 'utf8')).defectRegister as Array<{ id: string }>

const batches = (read('f03-batches.json') as { batches: Array<{ id: string; defects: string[] }> }).batches
const members = (read('families.json') as { members: Record<string, Array<{ id: string }>> }).members['F03-CROSS-TENANT-SYSTEM-ROLE-AND-SCOPE'] ?? []
const credited = new Set(
  (read('ue-all-777-remediation-register.json') as { records: Array<{ defectId: string; engineeringCorrection?: { state?: string } }> }).records
    .filter((record) => record.engineeringCorrection?.state === 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION')
    .map((record) => record.defectId),
)
const assigned = batches.flatMap((batch) => batch.defects)

describe('F03 batch membership', () => {
  it('has five batches of 4, 5, 3, 2 and 2 defects, 16 in all', () => {
    expect(batches.map((batch) => [batch.id, batch.defects.length])).toEqual([['F03-A', 4], ['F03-B', 5], ['F03-C', 3], ['F03-D', 2], ['F03-E', 2]])
    expect(assigned).toHaveLength(16)
  })

  it('assigns every defect to exactly one batch', () => {
    expect(new Set(assigned).size).toBe(assigned.length)
  })

  it('names only defects of the frozen register, which still holds all 777', () => {
    expect(frozen).toHaveLength(777)
    const ids = new Set(frozen.map((defect) => defect.id))
    for (const id of assigned) expect(ids.has(id), id).toBe(true)
  })

  it('covers every F03 defect that is still outstanding, and each assigned defect is outstanding in F03 or has been credited', () => {
    const outstanding = members.map((member) => member.id)
    for (const id of outstanding) expect(assigned, id).toContain(id)
    for (const id of assigned) expect(outstanding.includes(id) || credited.has(id), id).toBe(true)
  })
})
