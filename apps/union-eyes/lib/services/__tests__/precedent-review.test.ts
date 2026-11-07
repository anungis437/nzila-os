import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  selectRows: [] as unknown[][],
  updateRows: [] as unknown[][],
  sets: [] as Array<Record<string, unknown>>,
  audit: vi.fn(),
  withApi: vi.fn(),
  review: vi.fn(),
}))

const tx = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => h.selectRows.shift() ?? [] }) }) }),
  update: () => ({
    set: (s: Record<string, unknown>) => {
      h.sets.push(s)
      return { where: () => ({ returning: async () => h.updateRows.shift() ?? [] }) }
    },
  }),
}

vi.mock('drizzle-orm', async (orig) => ({ ...(await orig<typeof import('drizzle-orm')>()), and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }))
vi.mock('@/db/schema', () => ({ arbitrationDecisions: { id: 'id', sourceOrganizationId: 'sourceOrganizationId', accessRestrictions: 'accessRestrictions' } }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_c: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx) }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }))

import { precedentSubmitter, reviewPrecedentAudited } from '../precedent-audited-service'
import { resolvePrecedentReviewerAuthority } from '../precedent-review-authority'

const ORG = '11111111-1111-4111-8111-111111111111'
const pending = { id: 'p1', caseNumber: 'C-1', accessRestrictions: 'pending_review', importedFrom: `typed:${ORG}:submitter`, sourceOrganizationId: ORG }
const share = { id: 'p1', outcome: 'share' as const, redactionConfirmed: true, consentConfirmed: true }

// DEF-0B11-PRP-PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY-WITH-NO-REVIEW-PROVENANCE-OR-OWNING-ORGANIZATION
describe('precedent review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.selectRows = []
    h.updateRows = []
    h.sets = []
    h.audit.mockResolvedValue(undefined)
  })

  it('designates no reviewer: every caller is denied until the institution decides who may publish to the shared library', async () => {
    for (const userId of ['admin', 'content-manager', 'platform-staff']) {
      await expect(resolvePrecedentReviewerAuthority({ organizationId: ORG, userId })).resolves.toEqual({ allowed: false, reason: 'reviewer_authority_not_designated' })
    }
  })

  it('shares a pending decision into the library, conditionally on it still pending, with its review provenance in the same transaction', async () => {
    h.selectRows = [[pending]]
    h.updateRows = [[{ ...pending, isPublic: true, accessRestrictions: null }]]
    const result = await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, share)
    expect(result).toMatchObject({ ok: true, publicationStatus: 'shared' })
    expect(h.sets[0]).toMatchObject({ isPublic: true, accessRestrictions: null })
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'precedent.review.shared',
      organizationId: ORG,
      details: expect.objectContaining({ submittedBy: 'submitter', reviewedBy: 'reviewer', redactionConfirmed: true, consentConfirmed: true }),
    }))
  })

  it('rejects a pending decision and keeps it private', async () => {
    h.selectRows = [[pending]]
    h.updateRows = [[{ ...pending, isPublic: false, accessRestrictions: 'review_rejected' }]]
    const result = await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, { id: 'p1', outcome: 'reject', redactionConfirmed: false, consentConfirmed: false })
    expect(result).toMatchObject({ ok: true, publicationStatus: 'review_rejected' })
    expect(h.sets[0]).toMatchObject({ isPublic: false, accessRestrictions: 'review_rejected' })
  })

  it('refuses to share without the redaction and consent attestation, before touching the database', async () => {
    const result = await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, { ...share, consentConfirmed: false })
    expect(result).toEqual({ ok: false, kind: 'attestation_required' })
    expect(h.sets).toHaveLength(0)
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('refuses a review by the person who typed the decision, and one whose submitter is not on record', async () => {
    h.selectRows = [[pending], [{ ...pending, importedFrom: null }]]
    expect(await reviewPrecedentAudited({ organizationId: ORG, userId: 'submitter' }, share)).toEqual({ ok: false, kind: 'self_review' })
    expect(await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, share)).toEqual({ ok: false, kind: 'self_review' })
    expect(h.sets).toHaveLength(0)
  })

  it('refuses a decision that is not the organization\'s, and one that is no longer pending (including a lost race)', async () => {
    h.selectRows = [[], [{ ...pending, accessRestrictions: null }], [pending]]
    h.updateRows = [[]]
    expect(await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, share)).toEqual({ ok: false, kind: 'not_found' })
    expect(await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, share)).toEqual({ ok: false, kind: 'not_pending' })
    expect(await reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, share)).toEqual({ ok: false, kind: 'not_pending' })
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('a failed audit record fails the review', async () => {
    h.selectRows = [[pending]]
    h.updateRows = [[{ ...pending, isPublic: true, accessRestrictions: null }]]
    h.audit.mockRejectedValueOnce(new Error('audit down'))
    await expect(reviewPrecedentAudited({ organizationId: ORG, userId: 'reviewer' }, share)).rejects.toThrow('audit down')
  })

  it('reads the submitter from the provenance the create records', () => {
    expect(precedentSubmitter(`typed:${ORG}:user_42`)).toBe('user_42')
    expect(precedentSubmitter('import:canlii')).toBeNull()
    expect(precedentSubmitter(null)).toBeNull()
  })
})
