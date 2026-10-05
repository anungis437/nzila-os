import { describe, expect, it } from 'vitest'
import { validateAccessReview } from '../../scripts/ue/access-review-validate'

const quarter = '2026-Q4'

const approvedReview = {
  schemaVersion: 1,
  quarter,
  status: 'approved',
  signoffStatus: 'signed',
  preparedBy: 'security-operations@example.test',
  reviewer: 'reviewer@example.test',
  reviewDate: '2026-10-04',
  approvedBy: 'approver@example.test',
  approvedAt: '2026-10-04T17:30:00.000Z',
  evidence: [{ kind: 'identity-export', reference: 'evidence/identity-export.csv' }],
}

describe('quarterly access review validation', () => {
  it('accepts a completed and evidence-backed approval', () => {
    expect(validateAccessReview(approvedReview, quarter)).toEqual([])
  })

  it('rejects a missing packet', () => {
    expect(validateAccessReview({}, quarter).length).toBeGreaterThan(0)
  })

  it.each([
    ['pending review', { status: 'pending-review', signoffStatus: 'pending-review' }],
    ['draft review', { status: 'draft', signoffStatus: 'draft' }],
    ['rejected review', { status: 'rejected', signoffStatus: 'rejected' }],
    [
      'framework-only status',
      { status: 'attestation-framework-active', signoffStatus: 'attestation-framework-active' },
    ],
    [
      'live enumeration without approval',
      { status: 'live-enumeration', signoffStatus: 'pending-review' },
    ],
  ])('rejects %s', (_description, overrides) => {
    expect(
      validateAccessReview({ ...approvedReview, ...overrides }, quarter).length,
    ).toBeGreaterThan(0)
  })

  it('rejects missing or malformed evidence references', () => {
    expect(validateAccessReview({ ...approvedReview, evidence: [] }, quarter)).toContain(
      'evidence must reference at least one review evidence artifact.',
    )
    expect(
      validateAccessReview({ ...approvedReview, evidence: [{ kind: 'export' }] }, quarter),
    ).toContain('Each evidence artifact must include a non-empty kind and reference.')
  })

  it('requires a reviewer different from the packet preparer', () => {
    expect(
      validateAccessReview(
        { ...approvedReview, reviewer: approvedReview.preparedBy },
        quarter,
      ),
    ).toContain('reviewer must be different from the packet preparer.')
  })

  it('rejects invalid dates and a packet for another quarter', () => {
    const errors = validateAccessReview(
      { ...approvedReview, reviewDate: '2026-02-30', quarter: '2026-Q3' },
      quarter,
    )
    expect(errors).toContain('quarter must be 2026-Q4.')
    expect(errors).toContain('reviewDate must be a valid YYYY-MM-DD date.')
  })
})
