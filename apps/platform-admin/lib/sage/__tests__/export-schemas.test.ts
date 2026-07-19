import { describe, expect, it } from 'vitest'
import {
  ApproveExportRequestRequest,
  CreateExportRequestRequest,
  DenyExportRequestRequest,
  GenerateExportPackageRequest,
} from '../export-schemas'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('SAGE export request schemas', () => {
  it('accepts a valid request with purpose + selection', () => {
    expect(
      CreateExportRequestRequest.safeParse({
        purpose: 'internal review',
        evidenceItemIds: [UUID],
      }).success,
    ).toBe(true)
  })

  it('requires a purpose', () => {
    expect(CreateExportRequestRequest.safeParse({ evidenceItemIds: [UUID] }).success).toBe(false)
    expect(CreateExportRequestRequest.safeParse({ purpose: '' }).success).toBe(false)
  })

  it('rejects server-derived identity / status / scope / delivery fields', () => {
    for (const extra of [
      { orgId: 'o' },
      { requesterId: 'u' },
      { approverId: 'u' },
      { generatedBy: 'u' },
      { status: 'approved' },
      { requestedScopeHash: 'h' },
      { approvedScopeHash: 'h' },
      { packageHash: 'h' },
      { storageReference: 's' },
      { deliveryDestination: 'x' },
      { recipient: 'x' },
      { publicUrl: 'x' },
      { actorKind: 'human' },
      { authenticationType: 'interactive_user' },
    ]) {
      expect(
        CreateExportRequestRequest.safeParse({ purpose: 'x', evidenceItemIds: [UUID], ...extra }).success,
      ).toBe(false)
    }
  })

  it('approval + denial require a rationale and reject smuggled identity/scope', () => {
    expect(ApproveExportRequestRequest.safeParse({ rationale: 'ok' }).success).toBe(true)
    expect(ApproveExportRequestRequest.safeParse({ rationale: '' }).success).toBe(false)
    expect(DenyExportRequestRequest.safeParse({ rationale: 'no' }).success).toBe(true)
    for (const extra of [{ approverId: 'u' }, { approvedScopeHash: 'h' }, { status: 'approved' }]) {
      expect(ApproveExportRequestRequest.safeParse({ rationale: 'ok', ...extra }).success).toBe(false)
      expect(DenyExportRequestRequest.safeParse({ rationale: 'ok', ...extra }).success).toBe(false)
    }
  })

  it('generate request accepts an empty body and rejects any smuggled field', () => {
    expect(GenerateExportPackageRequest.safeParse({}).success).toBe(true)
    expect(GenerateExportPackageRequest.safeParse({ storageReference: 's' }).success).toBe(false)
    expect(GenerateExportPackageRequest.safeParse({ recipient: 'x' }).success).toBe(false)
  })
})
