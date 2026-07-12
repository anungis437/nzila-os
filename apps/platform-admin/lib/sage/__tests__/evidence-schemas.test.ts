import { describe, expect, it } from 'vitest'
import {
  ClassifyEvidenceSourceRequest,
  CreateEvidenceItemRequest,
  CreateEvidenceSourceRequest,
  LinkEvidenceItemRequest,
} from '../evidence-schemas'

describe('SAGE evidence request schemas', () => {
  it('accepts a minimal create-source payload', () => {
    const parsed = CreateEvidenceSourceRequest.safeParse({ sourceType: 'public' })
    expect(parsed.success).toBe(true)
  })

  it('rejects a server-derived field on create-source (strict)', () => {
    const parsed = CreateEvidenceSourceRequest.safeParse({
      sourceType: 'public',
      orgId: 'org_x',
      workspaceId: 'ws_x',
      createdBy: 'actor_x',
      authorizationLevel: 'sensitive',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects an unknown source type', () => {
    expect(CreateEvidenceSourceRequest.safeParse({ sourceType: 'made_up' }).success).toBe(false)
  })

  it('accepts a valid classify payload and rejects extras', () => {
    expect(
      ClassifyEvidenceSourceRequest.safeParse({
        sourceQuality: 'moderate',
        authorizationLevel: 'internal',
      }).success,
    ).toBe(true)
    expect(
      ClassifyEvidenceSourceRequest.safeParse({
        sourceQuality: 'moderate',
        authorizationLevel: 'internal',
        sourceId: 'src_x',
      }).success,
    ).toBe(false)
  })

  it('requires sourceId + confidenceLevel on create-item and rejects lifecycle override', () => {
    expect(
      CreateEvidenceItemRequest.safeParse({ sourceId: 's1', confidenceLevel: 'high' }).success,
    ).toBe(true)
    expect(
      CreateEvidenceItemRequest.safeParse({
        sourceId: 's1',
        confidenceLevel: 'high',
        lifecycleState: 'accepted',
      }).success,
    ).toBe(false)
  })

  it('rejects any body field on link (identity comes from the route)', () => {
    expect(LinkEvidenceItemRequest.safeParse({}).success).toBe(true)
    expect(LinkEvidenceItemRequest.safeParse({ itemId: 'i1' }).success).toBe(false)
  })
})
