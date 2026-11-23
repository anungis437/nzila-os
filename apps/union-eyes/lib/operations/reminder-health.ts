import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { RLSTx } from '@/lib/db/with-rls-context'

export async function readReminderHealth(tx: RLSTx) {
  const [row] = await tx.execute<{ stale_pending: number; expired_claims: number; recent_dead_letters: number }>(sql`
    SELECT count(*) FILTER (WHERE status IN ('pending','failed') AND scheduled_for < now()-interval '15 minutes')::int AS stale_pending,
      count(*) FILTER (WHERE status='claimed' AND (lease_expires_at IS NULL OR lease_expires_at < now()-interval '2 minutes'))::int AS expired_claims,
      count(*) FILTER (WHERE status='dead_letter' AND dead_lettered_at > now()-interval '24 hours')::int AS recent_dead_letters
    FROM public.deadline_reminders`)
  if (!row || Object.values(row).some(value => !Number.isInteger(value) || value < 0)) throw new Error('UE_OPERATIONS_QUEUE_MEASUREMENT_INVALID')
  return { state: Object.values(row).every(value => value === 0) ? 'ok' as const : 'fail' as const,
    note: 'Measured due reminder queue age, expired claims and dead letters in the last 24 hours',
    stalePending: row.stale_pending, expiredClaims: row.expired_claims, recentDeadLetters: row.recent_dead_letters }
}

/** Retain actual persisted mail provenance without exposing its recipient/body.
 * Current sender authentication, delivery and human inbox receipt are distinct. */
export async function readLatestReminderReceipt(tx: RLSTx) {
  const rows = await tx.execute<{ id: string; sent_at: string }>(sql`
    SELECT provider_message_id AS id, sent_at::text FROM public.deadline_reminders
    WHERE provider='resend' AND provider_message_id IS NOT NULL AND sent_at IS NOT NULL
    ORDER BY sent_at DESC, id DESC LIMIT 1`)
  return rows[0]
}

export async function probeReminderMailProvider(row: { id: string; sent_at: string } | undefined) {
  const failed = (note: string) => ({ state: 'fail' as const, note })
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM
  if (!key || key.trim().length < 16) return failed('The configured sending credential is unavailable')
  if (!from || !from.includes('@') || /[\r\n]/.test(from)) return failed('The configured sender is unavailable')
  if (!row || !z.guid().safeParse(row.id).success) return failed('No persisted provider receipt is available for mail provenance')
  const sentAt = Date.parse(row.sent_at)
  if (!Number.isFinite(sentAt) || sentAt > Date.now() + 5 * 60_000) return failed('Persisted email receipt timestamp is invalid')
  try {
    // The sending API authenticates before validating recipients. A deliberately
    // empty recipient array cannot send email. Staging qualification separately
    // verifies the invalid-key control (401) and this expected rejection (422).
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [], subject: 'Union Eyes provider authentication check',
        text: 'No recipients supplied; this request must be rejected.' }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    const body = z.object({ name: z.string(), message: z.string() }).passthrough().safeParse(await response.json())
    if (response.status !== 422 || !body.success || body.data.name !== 'missing_required_field' ||
        !/\bto\b/i.test(body.data.message) || 'id' in body.data) {
      return failed('The configured sending credential could not be authenticated without a recipient')
    }
    return { state: 'ok' as const,
      note: 'Sending API authenticated the configured key and rejected an empty recipient list; delivery and inbox receipt remain separate required release proofs',
      verification: 'sender_api_authentication_only' as const, providerHttpStatus: 422,
      recipients: 0, emailAccepted: false, deliveryVerified: false, humanInboxVerified: false }
  } catch { return failed('Configured sending API authentication could not be verified') }
}
