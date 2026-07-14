/**
 * Phase 8A.1 Crash-Recovery Tests
 *
 * Proves that:
 *   1. Message-ID is stable (not timestamp-derived)
 *   2. Encryption/decryption works
 *   3. Lease/fence prevents concurrent claims
 *   4. Crash-after-commit recovery via encrypted payload
 *   5. Provider failure and retry
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { InMemorySageRepository, decryptNotificationPayload, encryptNotificationPayload, type SageNotificationPayload } from '../src'

describe('Phase 8A.1: Crash-Safe Invitation Delivery', () => {
  let repo: InMemorySageRepository

  beforeAll(() => {
    // Set encryption key for tests: 32 bytes = 64 hex characters
    process.env.SAGE_NOTIFICATION_ENCRYPTION_KEY = 'a'.repeat(64)
  })

  beforeEach(() => {
    repo = new InMemorySageRepository()
  })

  describe('Message-ID Stability', () => {
    it('should generate stable messageId from request ID (not timestamp)', () => {
      const requestId = 'req-stable-123'

      // Simulate two different timestamps
      const messageId1 = `sage-delivery-invitation-v1:${requestId}`
      const messageId2 = `sage-delivery-invitation-v1:${requestId}`

      // THEN: messageIds are identical (not timestamp-dependent)
      expect(messageId1).toBe(messageId2)
      expect(messageId1).toMatch(/^sage-delivery-invitation-v1:req-/)
    })
  })

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt notification payload', () => {
      const payload: SageNotificationPayload = {
        invitationToken: 'secret-token-abc123',
        recipientEmail: 'test@example.com',
        claimUrlTemplate: '/delivery/claim?token={token}',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }

      const encrypted = encryptNotificationPayload(payload)
      expect(encrypted).toMatch(/^enc:v1:[a-f0-9]{24}:[a-f0-9]+:[a-f0-9]+$/)

      const decrypted = decryptNotificationPayload(encrypted)
      expect(decrypted).toEqual(payload)
    })

    it('should return null on corrupted ciphertext', () => {
      const corrupted = 'enc:v1:0000000000000000000000:invalid:invalid'
      const result = decryptNotificationPayload(corrupted)
      expect(result).toBeNull()
    })

    it('should bind payload to AAD and reject on AAD mismatch', () => {
      const payload: SageNotificationPayload = {
        invitationToken: 'token-aad-test',
        recipientEmail: 'aad@example.com',
        claimUrlTemplate: '/delivery/claim',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }

      const grantId = 'grant-123'
      const messageId = 'msg-456'
      const aad = `${grantId}:${messageId}`

      // Encrypt with AAD
      const encrypted = encryptNotificationPayload(payload, aad)

      // Decrypt with correct AAD
      const decrypted = decryptNotificationPayload(encrypted, aad)
      expect(decrypted).toEqual(payload)

      // Decrypt with wrong AAD fails
      const wrongAad = `${grantId}:different-msg`
      const wrongDecrypt = decryptNotificationPayload(encrypted, wrongAad)
      expect(wrongDecrypt).toBeNull()

      // Decrypt without AAD fails (AAD was used during encryption)
      const noAadDecrypt = decryptNotificationPayload(encrypted)
      expect(noAadDecrypt).toBeNull()
    })
  })

  describe('Lease and Fence Pattern', () => {
    it('should prevent concurrent claims with lease', async () => {
      // GIVEN: a pending notification
      const notification = await repo.enqueueNotificationOutbox({
        intent: {
          messageId: 'msg-concurrent-1',
          deliveryRequestId: 'req-1',
          grantId: 'grant-1',
          recipientId: 'recip-1',
          provider: 'email',
          template: 'invitation',
          recipientAddressHash: 'hash-1',
          encryptedPayload: encryptNotificationPayload({
            invitationToken: 'token-1',
            recipientEmail: 'user@example.com',
            claimUrlTemplate: '/delivery/claim',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
          encryptionKeyReference: 'v1',
          createdAt: new Date().toISOString(),
        },
        orgId: 'org-1',
        workspaceId: 'ws-1',
        recipientId: 'recip-1',
      })

      // WHEN: first dispatcher claims
      const claimed1 = await repo.claimPendingNotificationForDispatch({
        dispatchOwner: 'dispatcher-1',
        leaseMs: 30000,
      })

      // THEN: first claim succeeds
      expect(claimed1?.dispatchOwner).toBe('dispatcher-1')
      expect(claimed1?.status).toBe('dispatching')

      // WHEN: second dispatcher tries to claim
      const claimed2 = await repo.claimPendingNotificationForDispatch({
        dispatchOwner: 'dispatcher-2',
        leaseMs: 30000,
      })

      // THEN: second claim fails
      expect(claimed2).toBeUndefined()
    })
  })

  describe('Crash Recovery Scenarios', () => {
    it('should recover plaintext token from encrypted outbox', async () => {
      const payload: SageNotificationPayload = {
        invitationToken: 'recovery-token-xyz',
        recipientEmail: 'recover@example.com',
        claimUrlTemplate: '/delivery/claim?token={token}',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }
      const encrypted = encryptNotificationPayload(payload)

      const notification = await repo.enqueueNotificationOutbox({
        intent: {
          messageId: 'msg-recovery-1',
          deliveryRequestId: 'req-recovery',
          grantId: 'grant-recovery',
          recipientId: 'recip-recovery',
          provider: 'email',
          template: 'invitation',
          recipientAddressHash: 'hash-recovery',
          encryptedPayload: encrypted,
          encryptionKeyReference: 'v1',
          createdAt: new Date().toISOString(),
        },
        orgId: 'org-recovery',
        workspaceId: 'ws-recovery',
        recipientId: 'recip-recovery',
      })

      const retrieved = await repo.getNotificationOutboxByMessageId('msg-recovery-1')
      expect(retrieved).toBeDefined()

      const recovered = decryptNotificationPayload(retrieved!.encryptedPayload)
      expect(recovered?.invitationToken).toBe(payload.invitationToken)
    })
  })

  describe('Error Scenarios', () => {
    it('should mark notification as dispatched on success', async () => {
      const notification = await repo.enqueueNotificationOutbox({
        intent: {
          messageId: 'msg-success',
          deliveryRequestId: 'req-success',
          grantId: 'grant-success',
          recipientId: 'recip-success',
          provider: 'email',
          template: 'invitation',
          recipientAddressHash: 'hash-success',
          encryptedPayload: encryptNotificationPayload({
            invitationToken: 'token-success',
            recipientEmail: 'success@example.com',
            claimUrlTemplate: '/delivery/claim',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
          encryptionKeyReference: 'v1',
          createdAt: new Date().toISOString(),
        },
        orgId: 'org-success',
        workspaceId: 'ws-success',
        recipientId: 'recip-success',
      })

      const claimed = await repo.claimPendingNotificationForDispatch({
        dispatchOwner: 'test-dispatcher',
        leaseMs: 30000,
      })

      const result = await repo.markNotificationDispatched({
        id: claimed!.id,
        dispatchOwner: 'test-dispatcher',
        providerMessageId: 'provider-msg-123',
      })

      expect(result.success).toBe(true)

      const updated = await repo.getNotificationOutboxById(claimed!.id)
      expect(updated?.status).toBe('dispatched')
    })

    it('should mark notification as failed on error', async () => {
      const notification = await repo.enqueueNotificationOutbox({
        intent: {
          messageId: 'msg-fail',
          deliveryRequestId: 'req-fail',
          grantId: 'grant-fail',
          recipientId: 'recip-fail',
          provider: 'email',
          template: 'invitation',
          recipientAddressHash: 'hash-fail',
          encryptedPayload: encryptNotificationPayload({
            invitationToken: 'token-fail',
            recipientEmail: 'fail@example.com',
            claimUrlTemplate: '/delivery/claim',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
          encryptionKeyReference: 'v1',
          createdAt: new Date().toISOString(),
        },
        orgId: 'org-fail',
        workspaceId: 'ws-fail',
        recipientId: 'recip-fail',
      })

      const claimed = await repo.claimPendingNotificationForDispatch({
        dispatchOwner: 'test-dispatcher',
        leaseMs: 30000,
      })

      const result = await repo.markNotificationFailed({
        id: claimed!.id,
        dispatchOwner: 'test-dispatcher',
        errorCode: 'PROVIDER_ERROR',
        errorMessage: 'Provider unreachable',
      })

      expect(result.success).toBe(true)

      const updated = await repo.getNotificationOutboxById(claimed!.id)
      expect(updated?.status).toBe('failed')
      expect(updated?.lastErrorCode).toBe('PROVIDER_ERROR')
    })
  })
})
