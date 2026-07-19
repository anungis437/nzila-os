import { describe, expect, it } from 'vitest'
import {
  ClaimDeliveryInvitationRequest,
  CreateDeliveryRecipientRequest,
  CreateDeliveryRequestRequest,
  DecideDeliveryRequestRequest,
  RevokeDeliveryGrantRequest,
} from '../delivery-schemas'

const FUTURE = '2027-01-01T00:00:00.000Z'

describe('SAGE delivery schemas — strict, server-derived fields rejected', () => {
  it('accepts a valid delivery request', () => {
    expect(
      CreateDeliveryRequestRequest.safeParse({
        exportPackageId: 'pkg_1',
        recipientId: 'drecip_1',
        purpose: 'review',
        accessExpiresAt: FUTURE,
        maxAccesses: 3,
      }).success,
    ).toBe(true)
  })

  it('rejects server-derived identity/status/hash/token fields on a request', () => {
    for (const extra of [
      { orgId: 'o' },
      { workspaceId: 'w' },
      { requesterId: 'u' },
      { approverId: 'u' },
      { issuedBy: 'u' },
      { revokedBy: 'u' },
      { status: 'approved' },
      { packageContentHash: 'h' },
      { packageManifestHash: 'h' },
      { recipientIdentityHash: 'h' },
      { invitationTokenHash: 'h' },
      { sessionToken: 't' },
      { actorKind: 'human' },
      { authenticationType: 'external_recipient' },
      { storageReference: 's' },
      { publicUrl: 'x' },
    ]) {
      expect(
        CreateDeliveryRequestRequest.safeParse({
          exportPackageId: 'pkg_1',
          recipientId: 'drecip_1',
          accessExpiresAt: FUTURE,
          maxAccesses: 1,
          ...extra,
        }).success,
      ).toBe(false)
    }
  })

  it('bounds the access window count and requires a valid expiry', () => {
    expect(CreateDeliveryRequestRequest.safeParse({ exportPackageId: 'p', recipientId: 'r', accessExpiresAt: FUTURE, maxAccesses: 0 }).success).toBe(false)
    expect(CreateDeliveryRequestRequest.safeParse({ exportPackageId: 'p', recipientId: 'r', accessExpiresAt: FUTURE, maxAccesses: 101 }).success).toBe(false)
    expect(CreateDeliveryRequestRequest.safeParse({ exportPackageId: 'p', recipientId: 'r', accessExpiresAt: 'not-a-date', maxAccesses: 1 }).success).toBe(false)
  })

  it('recipient requires a valid email and rejects raw identity fields', () => {
    expect(CreateDeliveryRecipientRequest.safeParse({ displayName: 'R', email: 'r@example.gov' }).success).toBe(true)
    expect(CreateDeliveryRecipientRequest.safeParse({ displayName: 'R', email: 'not-an-email' }).success).toBe(false)
    expect(CreateDeliveryRecipientRequest.safeParse({ displayName: 'R', email: 'r@example.gov', identitySubject: 's' }).success).toBe(false)
    expect(CreateDeliveryRecipientRequest.safeParse({ displayName: 'R', email: 'r@example.gov', normalizedEmailHash: 'h' }).success).toBe(false)
  })

  it('decide requires a rationale; revoke requires a bounded reason code', () => {
    expect(DecideDeliveryRequestRequest.safeParse({ rationale: 'ok' }).success).toBe(true)
    expect(DecideDeliveryRequestRequest.safeParse({ rationale: '' }).success).toBe(false)
    expect(RevokeDeliveryGrantRequest.safeParse({ revocationReasonCode: 'security_concern' }).success).toBe(true)
    expect(RevokeDeliveryGrantRequest.safeParse({ revocationReasonCode: 'not-a-code' }).success).toBe(false)
  })

  it('claim requires a token + verified email and rejects extras', () => {
    expect(ClaimDeliveryInvitationRequest.safeParse({ token: 'abc', verifiedEmail: 'r@example.gov' }).success).toBe(true)
    expect(ClaimDeliveryInvitationRequest.safeParse({ token: '', verifiedEmail: 'r@example.gov' }).success).toBe(false)
    expect(ClaimDeliveryInvitationRequest.safeParse({ token: 'abc', verifiedEmail: 'r@example.gov', grantId: 'g' }).success).toBe(false)
  })
})
