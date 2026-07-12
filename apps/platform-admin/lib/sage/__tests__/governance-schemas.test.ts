import { describe, expect, it } from 'vitest'
import {
  CreateBoundaryFlagRequest,
  CreateDecisionRecordRequest,
  CreateReviewNoteRequest,
  ResolveBoundaryFlagRequest,
} from '../governance-schemas'

const UUID = '11111111-1111-1111-1111-111111111111'

describe('SAGE governance request schemas', () => {
  it('accepts a minimal boundary flag and rejects server-derived fields', () => {
    expect(
      CreateBoundaryFlagRequest.safeParse({ flagType: 'sensitivity', targetType: 'workspace' })
        .success,
    ).toBe(true)
    expect(
      CreateBoundaryFlagRequest.safeParse({
        flagType: 'sensitivity',
        targetType: 'workspace',
        orgId: 'org_x',
        createdBy: 'actor_x',
      }).success,
    ).toBe(false)
  })

  it('requires a resolution note and rejects a smuggled resolver identity', () => {
    expect(
      ResolveBoundaryFlagRequest.safeParse({ resolution: 'resolved', resolutionNote: 'done' })
        .success,
    ).toBe(true)
    expect(ResolveBoundaryFlagRequest.safeParse({ resolution: 'resolved', resolutionNote: '' }).success).toBe(
      false,
    )
    expect(
      ResolveBoundaryFlagRequest.safeParse({
        resolution: 'resolved',
        resolutionNote: 'done',
        resolvedBy: 'actor_x',
      }).success,
    ).toBe(false)
  })

  it('rejects a browser-supplied reviewer identity on a review note', () => {
    expect(
      CreateReviewNoteRequest.safeParse({
        noteType: 'observation',
        targetType: 'workspace',
        note: 'human note',
      }).success,
    ).toBe(true)
    expect(
      CreateReviewNoteRequest.safeParse({
        noteType: 'observation',
        targetType: 'workspace',
        note: 'human note',
        reviewerId: 'actor_x',
      }).success,
    ).toBe(false)
  })

  it('requires decision + uncertainty and rejects reviewer / score / automated fields', () => {
    expect(
      CreateDecisionRecordRequest.safeParse({
        decision: 'proceed',
        uncertainty: 'limited sample',
        referencedEvidenceItemIds: [UUID],
      }).success,
    ).toBe(true)
    // Missing uncertainty is rejected.
    expect(CreateDecisionRecordRequest.safeParse({ decision: 'proceed' }).success).toBe(false)
    // Smuggled reviewer / score / automated-decision fields are rejected.
    for (const extra of [
      { humanReviewerId: 'actor_x' },
      { reviewerId: 'actor_x' },
      { score: 5 },
      { certification: 'ok' },
      { automatedDecision: true },
    ]) {
      expect(
        CreateDecisionRecordRequest.safeParse({
          decision: 'proceed',
          uncertainty: 'limited',
          ...extra,
        }).success,
      ).toBe(false)
    }
  })

  it('rejects browser-supplied actor-kind / human-assurance / final-authorization fields', () => {
    // The actor kind, human flags, the FINAL authorization envelope, and the
    // basis are all derived server-side — a browser can never supply them.
    for (const extra of [
      { actorKind: 'human' },
      { actorKind: 'service' },
      { isHuman: true },
      { authorizationLevel: 'public' },
      { authorizationBasis: 'workspace_default' },
      { excludedFromExternalReview: false },
    ]) {
      expect(
        CreateDecisionRecordRequest.safeParse({
          decision: 'proceed',
          uncertainty: 'limited',
          ...extra,
        }).success,
      ).toBe(false)
      expect(
        CreateBoundaryFlagRequest.safeParse({
          flagType: 'sensitivity',
          targetType: 'workspace',
          ...extra,
        }).success,
      ).toBe(false)
    }
  })

  it('accepts an optional requestedAuthorizationLevel (raise-only; server floors it)', () => {
    expect(
      CreateBoundaryFlagRequest.safeParse({
        flagType: 'sensitivity',
        targetType: 'workspace',
        requestedAuthorizationLevel: 'sensitive',
      }).success,
    ).toBe(true)
    // Only valid ladder values are accepted.
    expect(
      CreateDecisionRecordRequest.safeParse({
        decision: 'proceed',
        uncertainty: 'limited',
        requestedAuthorizationLevel: 'not-a-level',
      }).success,
    ).toBe(false)
  })
})
