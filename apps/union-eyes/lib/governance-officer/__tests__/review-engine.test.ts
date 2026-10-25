import { describe, expect, it } from 'vitest'
import {
  GovernanceDenied,
  OVERSIGHT_POWERS,
  assertEvidenceNotModifiable,
  assessIndependence,
  assessJurisdiction,
  assignReviewer,
  authorizeOversight,
  canViewAllegation,
  closeReview,
  filterExportableEvidence,
  issueBindingDecision,
  reassignAfterDeparture,
  receiveConcern,
  recordFinding,
  reportActionComplete,
  requestCorrectiveAction,
  requestEvidence,
  revokeReviewerAccess,
  verifyAction,
  type Classification,
  type Ctx,
  type OversightGrant,
  type OversightPower,
  type ReviewCase,
} from '../review-engine'

const NOW = new Date('2026-10-23T12:00:00Z')
const LATER = new Date('2027-10-23T12:00:00Z')
const INST = 'local-1'
const REVIEW = 'rev-1'

const grant = (
  reviewerId: string,
  power: OversightPower,
  over: Partial<OversightGrant> = {},
): OversightGrant => ({
  id: `${reviewerId}-${power}`,
  reviewerId,
  institutionId: INST,
  power,
  source: { kind: 'bylaw', reference: 'Bylaw 14.2' },
  purpose: 'independent governance review',
  reviewId: REVIEW,
  classificationCeiling: 'confidential',
  validFrom: new Date('2026-01-01T00:00:00Z'),
  validUntil: LATER,
  ...over,
})
const grantsFor = (id: string, powers: OversightPower[], over: Partial<OversightGrant> = {}) =>
  powers.map((p) => grant(id, p, over))

const ALL_BUT_BINDING: OversightPower[] = ['monitor', 'evidence_access', 'issue_finding', 'request_corrective_action']
const ctx = (grants: OversightGrant[], now = NOW): Ctx => ({ grants, now })

const fresh = (respondents = ['president']): ReviewCase =>
  receiveConcern({ id: REVIEW, institutionId: INST, submitterId: 'member-1', respondentIds: respondents, now: NOW })

const expectDenied = (fn: () => unknown, code: string) => {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(GovernanceDenied)
    expect((e as GovernanceDenied).denial.code).toBe(code)
    return
  }
  throw new Error(`expected denial ${code}`)
}

describe('five independent oversight powers', () => {
  it('has exactly five powers', () => {
    expect(OVERSIGHT_POWERS).toHaveLength(5)
  })

  it.each(OVERSIGHT_POWERS)('holding any other power never confers %s', (power) => {
    const others = OVERSIGHT_POWERS.filter((p) => p !== power)
    const v = authorizeOversight({
      actorId: 'rev', institutionId: INST, reviewId: REVIEW, power,
      parties: { respondentIds: [], recusedIds: [] },
      grants: others.map((p) => grant('rev', p)), now: NOW,
    })
    expect(v).toMatchObject({ allowed: false, code: 'NO_GRANT' })
  })

  it('a role label or seniority is not an input: no grant means no authority (officer bypass)', () => {
    const v = authorizeOversight({
      actorId: 'president-of-another-matter', institutionId: INST, reviewId: REVIEW, power: 'evidence_access',
      parties: { respondentIds: [], recusedIds: [] }, grants: [], now: NOW,
    })
    expect(v.allowed).toBe(false)
  })

  it('rejects expired, revoked and not-yet-valid grants (stale mandate)', () => {
    const base = { actorId: 'rev', institutionId: INST, reviewId: REVIEW, power: 'monitor' as const, parties: { respondentIds: [], recusedIds: [] }, now: NOW }
    expect(authorizeOversight({ ...base, grants: [grant('rev', 'monitor', { validUntil: new Date('2026-06-01') })] }))
      .toMatchObject({ allowed: false, code: 'GRANT_EXPIRED_OR_REVOKED' })
    expect(authorizeOversight({ ...base, grants: [grant('rev', 'monitor', { revokedAt: new Date('2026-09-01') })] }))
      .toMatchObject({ allowed: false, code: 'GRANT_EXPIRED_OR_REVOKED' })
    expect(authorizeOversight({ ...base, grants: [grant('rev', 'monitor', { validFrom: new Date('2027-01-01') })] }))
      .toMatchObject({ allowed: false })
  })

  it('rejects grants for another review (unrelated case) or another institution (cross-local)', () => {
    const base = { actorId: 'rev', institutionId: INST, reviewId: REVIEW, power: 'evidence_access' as const, parties: { respondentIds: [], recusedIds: [] }, now: NOW }
    expect(authorizeOversight({ ...base, grants: [grant('rev', 'evidence_access', { reviewId: 'other-review' })] }))
      .toMatchObject({ allowed: false, code: 'WRONG_RESOURCE_OR_INSTITUTION' })
    expect(authorizeOversight({ ...base, grants: [grant('rev', 'evidence_access', { institutionId: 'local-2' })] }))
      .toMatchObject({ allowed: false, code: 'WRONG_RESOURCE_OR_INSTITUTION' })
  })

  it('privileged, medical or restricted material needs a grant whose ceiling reaches it', () => {
    const base = { actorId: 'rev', institutionId: INST, reviewId: REVIEW, power: 'evidence_access' as const, parties: { respondentIds: [], recusedIds: [] }, now: NOW }
    for (const c of ['restricted', 'privileged'] as Classification[]) {
      expect(authorizeOversight({ ...base, classification: c, grants: [grant('rev', 'evidence_access')] }))
        .toMatchObject({ allowed: false, code: 'CLASSIFICATION_EXCEEDS_GRANT' })
    }
    expect(authorizeOversight({ ...base, classification: 'privileged', grants: [grant('rev', 'evidence_access', { classificationCeiling: 'privileged' })] }).allowed).toBe(true)
  })
})

describe('independence and conflicts', () => {
  it('complaint against the President: the President cannot assess, assign, or see the allegation', () => {
    const c = fresh(['president'])
    const g = [...grantsFor('president', ALL_BUT_BINDING), ...grantsFor('admin-1', ALL_BUT_BINDING)]
    expectDenied(() => assessJurisdiction(c, 'president', ctx(g)), 'CONFLICTED')
    expect(canViewAllegation(c, 'president', ctx(g))).toBe(false)
  })

  it('complaint against the assigned reviewer: the reviewer is stripped of control and cannot keep acting', () => {
    let c = fresh(['someone']);
    const g = [...grantsFor('registrar', ALL_BUT_BINDING), ...grantsFor('rev', ALL_BUT_BINDING)]
    c = assessIndependence(assessJurisdiction(c, 'registrar', ctx(g)), 'registrar', ctx(g))
    c = assignReviewer(c, 'registrar', 'rev', ctx(g))
    const recused: ReviewCase = { ...c, parties: { ...c.parties, respondentIds: [...c.parties.respondentIds, 'rev'] } }
    const attempt = requestEvidence(recused, 'rev', { id: 'e1', holderId: 'sec', description: 'minutes', classification: 'internal' }, ctx(g))
    expect(attempt.evidence[0]).toMatchObject({ status: 'denied', denialReason: 'CONFLICTED' })
    expectDenied(() => recordFinding(attempt, 'rev', { id: 'f', kind: 'finding', rationale: 'r', sourceRefs: ['e'], limitations: 'l' }, ctx(g)), 'CONFLICTED')
  })

  it('a conflicted officer cannot assign the matter to themselves or an ally', () => {
    const c = assessIndependence(assessJurisdiction(fresh(['president']), 'registrar', ctx(grantsFor('registrar', ALL_BUT_BINDING))), 'registrar', ctx(grantsFor('registrar', ALL_BUT_BINDING)))
    const g = [...grantsFor('president', ALL_BUT_BINDING), ...grantsFor('registrar', ALL_BUT_BINDING)]
    expectDenied(() => assignReviewer(c, 'president', 'president', ctx(g)), 'CONFLICTED_ASSIGNER')
    expectDenied(() => assignReviewer({ ...c, parties: { ...c.parties, recusedIds: ['ally'] } }, 'registrar', 'ally', ctx([...g, ...grantsFor('ally', ALL_BUT_BINDING)])), 'CONFLICTED_ASSIGNEE')
  })

  it('assigning a person without their own current grants fails (assignment confers nothing)', () => {
    const g = grantsFor('registrar', ALL_BUT_BINDING)
    const c = assessIndependence(assessJurisdiction(fresh(), 'registrar', ctx(g)), 'registrar', ctx(g))
    expectDenied(() => assignReviewer(c, 'registrar', 'nobody', ctx(g)), 'NO_GRANT')
  })

  it('the complainant cannot review their own complaint', () => {
    const g = grantsFor('member-1', ALL_BUT_BINDING)
    expectDenied(() => assessJurisdiction(fresh(), 'member-1', ctx(g)), 'CONFLICTED')
  })

  it('small volunteer local: one person holding several roles is still blocked once conflicted', () => {
    const g = grantsFor('volunteer', ALL_BUT_BINDING)
    expect(authorizeOversight({ actorId: 'volunteer', institutionId: INST, reviewId: REVIEW, power: 'issue_finding', parties: { respondentIds: ['volunteer'], recusedIds: [] }, grants: g, now: NOW }))
      .toMatchObject({ allowed: false, code: 'CONFLICTED' })
  })
})

describe('GV01–GV09 connected independent review (domain level)', () => {
  const g = [
    ...grantsFor('registrar', ['monitor']),
    ...grantsFor('rev', ALL_BUT_BINDING),
    ...grantsFor('chair', ['enforce_certify']),
  ]

  function toEvidenceStage() {
    let c = receiveConcern({ id: REVIEW, institutionId: INST, submitterId: 'member-1', respondentIds: ['president'], now: NOW })
    c = assessJurisdiction(c, 'registrar', ctx(g))
    c = assessIndependence(c, 'registrar', ctx(g))
    c = assignReviewer(c, 'registrar', 'rev', ctx(g))
    c = requestEvidence(c, 'rev', { id: 'e1', holderId: 'secretary', description: 'Meeting minutes', classification: 'confidential' }, ctx(g))
    return c
  }

  it('runs intake → assignment → evidence → finding → action → verification → close with history preserved', () => {
    let c = toEvidenceStage()
    expect(c.assigneeId).toBe('rev')
    expect(c.evidence[0]).toMatchObject({ status: 'requested' })

    c = recordFinding(c, 'rev', { id: 'f1', kind: 'finding', rationale: 'Minutes show no quorum', sourceRefs: ['e1'], limitations: 'Only one meeting reviewed' }, ctx(g))
    expect(c.findings[0].kind).toBe('finding')
    expect(c.stage).toBe('finding_recorded')

    c = requestCorrectiveAction(c, 'rev', { id: 'a1', responsibleId: 'secretary', requestedOutcome: 'Re-ratify under proper quorum' }, ctx(g))
    c = reportActionComplete(c, 'secretary', 'a1', ['ratification-minutes'], ctx(g))
    expect(c.actions[0].status).toBe('reported_complete')
    // completion by the owner does not close the matter
    expectDenied(() => closeReview(c, 'rev', ctx(g)), 'INVALID_STAGE')

    c = verifyAction(c, 'rev', 'a1', 'effective', ctx(g))
    expect(c.actions[0]).toMatchObject({ status: 'verified_effective', verifiedBy: 'rev' })
    c = closeReview(c, 'rev', ctx(g))
    expect(c.stage).toBe('closed')
    expect(c.history.map((h) => h.type)).toEqual([
      'concern_received', 'jurisdiction_assessed', 'independence_assessed', 'reviewer_assigned',
      'evidence_requested', 'finding_recorded', 'corrective_action_requested',
      'action_reported_complete', 'action_verified_effective', 'closed',
    ])
  })

  it('a denied evidence request is a recorded state, not an invisible gap (privileged material)', () => {
    let c = toEvidenceStage()
    c = requestEvidence(c, 'rev', { id: 'e2', holderId: 'counsel', description: 'Counsel opinion', classification: 'privileged' }, ctx(g))
    expect(c.evidence[1]).toMatchObject({ status: 'denied', denialReason: 'CLASSIFICATION_EXCEEDS_GRANT' })
    expect(c.history.at(-1)?.type).toBe('evidence_denied')
  })

  it('findings need sources and stated limitations; a finding is not a binding decision', () => {
    const c = toEvidenceStage()
    expectDenied(() => recordFinding(c, 'rev', { id: 'f', kind: 'finding', rationale: 'x', sourceRefs: [], limitations: '' }, ctx(g)), 'UNSUPPORTED_FINDING')
    expectDenied(() => recordFinding(c, 'rev', { id: 'f', kind: 'binding_decision', rationale: 'x', sourceRefs: ['e1'], limitations: 'l' }, ctx(g)), 'USE_ISSUE_DECISION')
  })

  it('binding decisions require the separate enforce_certify power', () => {
    const c = recordFinding(toEvidenceStage(), 'rev', { id: 'f1', kind: 'recommendation', rationale: 'r', sourceRefs: ['e1'], limitations: 'l' }, ctx(g))
    expectDenied(() => issueBindingDecision(c, 'rev', { id: 'd', rationale: 'r', sourceRefs: ['f1'], limitations: 'l' }, ctx(g)), 'NO_GRANT')
    const decided = issueBindingDecision(c, 'chair', { id: 'd', rationale: 'r', sourceRefs: ['f1'], limitations: 'l' }, ctx(g))
    expect(decided.stage).toBe('decision_issued')
    expect(decided.findings.at(-1)?.kind).toBe('binding_decision')
  })

  it('corrective-action self-certification is refused; owner cannot verify own remediation', () => {
    const base = recordFinding(toEvidenceStage(), 'rev', { id: 'f1', kind: 'finding', rationale: 'r', sourceRefs: ['e1'], limitations: 'l' }, ctx(g))
    const withAction = requestCorrectiveAction(base, 'rev', { id: 'a1', responsibleId: 'secretary', requestedOutcome: 'fix' }, ctx(g))
    const done = reportActionComplete(withAction, 'secretary', 'a1', ['proof'], ctx(g))
    const ownerGrants = [...g, ...grantsFor('secretary', ALL_BUT_BINDING)]
    expectDenied(() => verifyAction(done, 'secretary', 'a1', 'effective', ctx(ownerGrants)), 'SELF_CERTIFICATION')
  })

  it('the reviewer cannot own the action and non-owners cannot report completion', () => {
    const base = recordFinding(toEvidenceStage(), 'rev', { id: 'f1', kind: 'finding', rationale: 'r', sourceRefs: ['e1'], limitations: 'l' }, ctx(g))
    expectDenied(() => requestCorrectiveAction(base, 'rev', { id: 'a', responsibleId: 'rev', requestedOutcome: 'x' }, ctx(g)), 'REVIEWER_CANNOT_OWN_ACTION')
    const withAction = requestCorrectiveAction(base, 'rev', { id: 'a1', responsibleId: 'secretary', requestedOutcome: 'fix' }, ctx(g))
    expectDenied(() => reportActionComplete(withAction, 'bystander', 'a1', ['proof'], ctx(g)), 'NOT_RESPONSIBLE_ACTOR')
    expectDenied(() => reportActionComplete(withAction, 'secretary', 'a1', [], ctx(g)), 'EVIDENCE_REQUIRED')
  })

  it('a rejected remediation returns the matter to corrective action and blocks closure', () => {
    const base = recordFinding(toEvidenceStage(), 'rev', { id: 'f1', kind: 'finding', rationale: 'r', sourceRefs: ['e1'], limitations: 'l' }, ctx(g))
    let c = requestCorrectiveAction(base, 'rev', { id: 'a1', responsibleId: 'secretary', requestedOutcome: 'fix' }, ctx(g))
    c = reportActionComplete(c, 'secretary', 'a1', ['proof'], ctx(g))
    c = verifyAction(c, 'rev', 'a1', 'needs_more_work', ctx(g))
    expect(c.stage).toBe('corrective_action_assigned')
    expect(c.actions[0].status).toBe('rejected_needs_more_work')
    expectDenied(() => closeReview(c, 'rev', ctx(g)), 'INVALID_STAGE')
  })

  it('expired mandate mid-review blocks further findings (stale resource links)', () => {
    const c = toEvidenceStage()
    expectDenied(() => recordFinding(c, 'rev', { id: 'f', kind: 'finding', rationale: 'r', sourceRefs: ['e1'], limitations: 'l' }, ctx(g, new Date('2028-01-01'))), 'GRANT_EXPIRED_OR_REVOKED')
  })

  it('reviewer departure revokes access; the successor needs their own grants and inherits the matter', () => {
    const c = toEvidenceStage()
    const revoked = revokeReviewerAccess(g, 'rev', NOW)
    expectDenied(() => recordFinding(c, 'rev', { id: 'f', kind: 'finding', rationale: 'r', sourceRefs: ['e1'], limitations: 'l' }, ctx(revoked)), 'GRANT_EXPIRED_OR_REVOKED')
    expectDenied(() => reassignAfterDeparture(c, 'rev', 'successor', ctx(revoked)), 'NO_GRANT')
    const withSuccessor = [...revoked, ...grantsFor('successor', ALL_BUT_BINDING)]
    const next = reassignAfterDeparture(c, 'rev', 'successor', ctx(withSuccessor))
    expect(next.assigneeId).toBe('successor')
    expect(next.evidence).toEqual(c.evidence)
    expect(next.history.length).toBe(c.history.length + 1)
  })
})

describe('confidentiality and evidence boundaries', () => {
  it('the respondent cannot see the protected allegation until deliberate release; the complainant can', () => {
    const c = fresh(['president'])
    expect(canViewAllegation(c, 'president', ctx([]))).toBe(false)
    expect(canViewAllegation(c, 'member-1', ctx([]))).toBe(true)
    expect(canViewAllegation({ ...c, allegationReleasedToRespondent: true }, 'president', ctx([]))).toBe(true)
  })

  it('an unrelated executive with no grant cannot see the matter', () => {
    expect(canViewAllegation(fresh(), 'vice-president', ctx([]))).toBe(false)
  })

  it('reviewers cannot modify source evidence', () => {
    expectDenied(() => assertEvidenceNotModifiable(), 'EVIDENCE_IMMUTABLE_TO_REVIEWER')
  })

  it('evidence exports exclude everything above the requester\'s grant ceiling', () => {
    const c: ReviewCase = {
      ...fresh(),
      evidence: [
        { id: 'e1', holderId: 'h', description: 'minutes', classification: 'confidential', status: 'provided' },
        { id: 'e2', holderId: 'h', description: 'counsel opinion', classification: 'privileged', status: 'provided' },
        { id: 'e3', holderId: 'h', description: 'pending', classification: 'internal', status: 'requested' },
      ],
    }
    const out = filterExportableEvidence(c, 'rev', ctx(grantsFor('rev', ['evidence_access'])))
    expect(out.map((e) => e.id)).toEqual(['e1'])
    expect(filterExportableEvidence(c, 'stranger', ctx([]))).toEqual([])
  })
})
