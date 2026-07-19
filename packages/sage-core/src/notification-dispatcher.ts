/**
 * Notification Dispatcher
 *
 * Processes pending notifications from the durable outbox with lease/fence pattern.
 * Designed to run as a timer-triggered Azure Function or similar worker process.
 *
 * Semantics:
 *   - Leases pending notifications with FOR UPDATE SKIP LOCKED
 *   - Decrypts the encrypted payload (invitationToken, recipientEmail, etc.)
 *   - Dispatches to notification provider (email, SMS, etc.)
 *   - Marks as dispatched or dead_letter
 *   - Retries failed messages with exponential backoff + true full jitter
 *   - Recovers stale leases (lease_expires_at < now)
 *
 * At-least-once delivery:
 *   - If process crashes after successful provider send but before marking dispatched,
 *     the lease will expire and another dispatcher will retry with the same messageId.
 *   - Provider must deduplicate on messageId to prevent duplicate processing.
 *
 * Dead-letter handling:
 *   - After max_retries attempts, message is moved to dead_letter.
 *   - Manual intervention required to resolve (e.g., fix encryption key, update email).
 */

import { SageDeliveryNotificationError, type SageDeliveryNotifier } from './delivery-notifier'
import type { SageRepository } from './repository'
import type { SageSqlClient } from './sql-client'
import { decryptNotificationPayload, notificationPayloadAad } from './notification-encryption'
import type { SageNotificationOutbox } from './delivery-types'

export interface NotificationDispatcherConfig {
  /**
   * Maximum number of concurrent notifications to dispatch in one run.
   * Prevents overwhelming the provider or consuming too many connections.
   */
  maxConcurrentDispatches?: number

  /**
   * How long to hold a lease before considering it stale and recoverable.
   * Should be > expected dispatch time + provider timeout.
   */
  leaseMs?: number

  /**
   * Maximum number of retry attempts before moving to dead-letter.
   */
  maxRetries?: number

  /**
   * Base delay in milliseconds for exponential backoff.
   * Used in full jitter: delay = random(0, min(maxDelay, base * 2^attempt))
   */
  baseDelayMs?: number

  /**
   * Maximum delay between retries to prevent excessive waiting.
   */
  maxDelayMs?: number

  /**
   * Identifier for this dispatcher instance (for logging and lease ownership).
   */
  dispatcherInstanceId?: string

  /**
   * Injectable clock. Defaults to `() => new Date()`. Tests should override this
   * so the invitation-expiry check compares against a frozen test time rather
   * than real wall time (otherwise long-lived test fixtures drift past the TTL
   * and dispatch is short-circuited to dead-letter).
   */
  now?: () => Date
}

const DEFAULT_CONFIG: Required<NotificationDispatcherConfig> = {
  maxConcurrentDispatches: 10,
  leaseMs: 30_000, // 30 seconds
  maxRetries: 5,
  baseDelayMs: 1_000, // 1 second
  maxDelayMs: 60_000, // 1 minute
  dispatcherInstanceId: `dispatcher-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  now: () => new Date(),
}

export class NotificationDispatcher {
  private config: Required<NotificationDispatcherConfig>

  constructor(
    private repo: SageRepository,
    private notifier: SageDeliveryNotifier,
    private sql: SageSqlClient,
    config?: NotificationDispatcherConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Main dispatch entry point. Called periodically by a timer or job queue.
   * Processes up to maxConcurrentDispatches pending notifications.
   */
  async run(): Promise<{
    processed: number
    succeeded: number
    failed: number
    errors: Array<{ messageId: string; error: string }>
  }> {
    const errors: Array<{ messageId: string; error: string }> = []
    let succeeded = 0
    let failed = 0

    for (let i = 0; i < this.config.maxConcurrentDispatches; i++) {
      try {
        // Claim one pending notification with a lease
        const claimed = await this.repo.claimPendingNotificationForDispatch({
          maxAttempts: this.config.maxRetries,
          dispatchOwner: this.config.dispatcherInstanceId,
          leaseMs: this.config.leaseMs,
        })

        if (!claimed) {
          // No more pending notifications
          break
        }

        const result = await this.dispatchOne(claimed)
        if (result.success) {
          succeeded++
        } else {
          failed++
          errors.push({ messageId: claimed.messageId, error: result.error || 'unknown error' })
        }
      } catch (err) {
        failed++
        errors.push({
          messageId: 'unknown',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return {
      processed: succeeded + failed,
      succeeded,
      failed,
      errors,
    }
  }

  /**
   * Dispatch a single claimed notification.
   * Handles decryption, provider dispatch, retry logic, and result marking.
   */
  private async dispatchOne(
    notification: SageNotificationOutbox,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Decrypt the payload with AAD verification (binds to this specific grant)
      const aad = notificationPayloadAad(notification)
      const payload = decryptNotificationPayload(notification.encryptedPayload, aad, notification.encryptionKeyReference)
      if (!payload) {
        const error = 'Failed to decrypt notification payload (AAD mismatch or corrupted)'
        await this.repo.markNotificationDeadLetter({
          id: notification.id,
          dispatchOwner: this.config.dispatcherInstanceId,
          errorCode: 'DECRYPT_ERROR',
          errorMessage: error,
        })
        return { success: false, error }
      }

      if (Date.parse(payload.expiresAt) <= this.config.now().getTime()) {
        const error = 'Invitation expired before notification dispatch'
        await this.repo.markNotificationDeadLetter({
          id: notification.id,
          dispatchOwner: this.config.dispatcherInstanceId,
          errorCode: 'INVITATION_EXPIRED',
          errorMessage: error,
        })
        return { success: false, error }
      }

      // Send to provider
      try {
        const providerResult = await this.notifier.sendInvitation({
          grantId: notification.grantId,
          recipientId: notification.recipientId,
          recipientEmailHash: notification.recipientAddressHash,
          organizationSafeName: '', // Passed by notifier; not in outbox
          purposeSummary: null,
          invitationExpiresAt: payload.expiresAt,
          claimToken: payload.invitationToken,
          messageId: notification.messageId,
          idempotencyKey: notification.messageId, // Stable ID for provider deduplication
        })

        // Mark as dispatched
        await this.repo.markNotificationDispatched({
          id: notification.id,
          dispatchOwner: this.config.dispatcherInstanceId,
          providerMessageId: providerResult.providerMessageId ?? undefined,
        })

        return { success: true }
      } catch (dispatchErr) {
        const errorMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr)

        // Check if retryable
        const isRetryable = this.isTransientError(dispatchErr)
        if (!isRetryable || notification.attemptCount >= this.config.maxRetries) {
          // Mark as terminal (dead-letter)
          await this.repo.markNotificationDeadLetter({
            id: notification.id,
            dispatchOwner: this.config.dispatcherInstanceId,
            errorCode: isRetryable ? 'MAX_RETRIES_EXCEEDED' : 'PERMANENT_ERROR',
            errorMessage: errorMsg,
          })
          return { success: false, error: errorMsg }
        }

        // Release back to pending with exponential backoff
        const delay = this.calculateBackoff(notification.attemptCount)
        const nextAttemptAt = new Date(Date.now() + delay).toISOString()

        await this.repo.releaseNotificationOutboxToPending({
          id: notification.id,
          dispatchOwner: this.config.dispatcherInstanceId,
          nextAttemptAt,
          errorCode: 'TRANSIENT_PROVIDER_ERROR',
        })

        return { success: false, error: `Transient error, will retry: ${errorMsg}` }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      try {
        await this.repo.markNotificationDeadLetter({
          id: notification.id,
          dispatchOwner: this.config.dispatcherInstanceId,
          errorCode: 'DISPATCH_ERROR',
          errorMessage: error,
        })
      } catch {
        // Best-effort; ignore errors marking failure
      }
      return { success: false, error }
    }
  }

  /**
   * Determine if an error is transient (retryable) or permanent.
   * Transient: network timeouts, 5xx provider errors, rate limits
   * Permanent: 4xx client errors (invalid email), auth failures, encryption errors
   */
  private isTransientError(err: unknown): boolean {
    if (err instanceof SageDeliveryNotificationError) return err.classification === 'transient'
    if (!(err instanceof Error)) return false

    // Network errors
    if (err.message.includes('timeout') || err.message.includes('ECONNREFUSED')) return true
    if (err.message.includes('ECONNRESET') || err.message.includes('socket hang up')) return true

    // Provider 5xx errors (indicated by error code)
    if (err.message.includes('5xx') || err.message.includes('503')) return true

    // Rate limits
    if (err.message.includes('429') || err.message.includes('rate limit')) return true

    // Permanent errors
    if (err.message.includes('invalid email') || err.message.includes('4xx')) return false
    if (err.message.includes('authentication') || err.message.includes('unauthorized')) return false

    // Default to retryable for unknown errors
    return true
  }

  /**
   * Calculate backoff delay using true full jitter.
   * Formula: delay = random(0, min(maxDelay, base * 2^attempt))
   *
   * This prevents thundering herd on provider after outage recovery.
   * Each retry gets a completely random delay, not bounded by previous attempt.
   */
  private calculateBackoff(attemptCount: number): number {
    const cap = Math.min(
      this.config.maxDelayMs,
      this.config.baseDelayMs * Math.pow(2, attemptCount),
    )
    return Math.floor(Math.random() * cap)
  }

  /**
   * Recover stale leases (dispatcher crashed and didn't release the lease).
   * Called periodically to keep the queue unblocked.
   */
  async recoverStaleLeases(): Promise<{ recovered: number }> {
    const staleLeases = await this.sql.query<{ id: string }>(
      `select id from sage_notification_outbox
       where status = 'dispatching' and lease_expires_at < now()
       limit 100`,
    )

    let recovered = 0
    for (const row of staleLeases.rows) {
      const res = await this.sql.query<{ id: string }>(
        `update sage_notification_outbox
         set status = 'pending', dispatch_owner = null, lease_expires_at = null,
             next_attempt_at = coalesce(next_attempt_at, now())
         where id = $1 and status = 'dispatching' and lease_expires_at < now()
         returning id`,
        [row.id],
      )
      if (res.rows.length > 0) recovered++
    }

    return { recovered }
  }
}
