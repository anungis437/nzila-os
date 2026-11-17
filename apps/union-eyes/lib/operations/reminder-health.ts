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

/** Reads a provider receipt for an actual persisted reminder without sending a
 * canary email or exposing its recipient/body. A provider delivery event is
 * explicitly not a claim of human inbox receipt. */
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
  if (!key || key.trim().length < 16) return failed('The configured email provider credential is unavailable')
  if (!row || !z.guid().safeParse(row.id).success) return failed('No persisted provider receipt is available for a mail health read')
  const sentAt = Date.parse(row.sent_at)
  if (!Number.isFinite(sentAt) || sentAt > Date.now() + 5 * 60_000) return failed('Persisted email receipt timestamp is invalid')
  try {
    const response = await fetch(`https://api.resend.com/emails/${row.id}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return failed('The configured email provider could not verify the persisted receipt')
    const body = z.object({ id: z.guid(), last_event: z.string() }).parse(await response.json())
    if (body.id !== row.id) return failed('Email provider receipt identity did not match')
    const completed = ['delivered', 'opened', 'clicked'].includes(body.last_event)
    const ageMs = Date.now() - Date.parse(row.sent_at)
    const pending = ['sent', 'queued'].includes(body.last_event) && ageMs >= -5 * 60_000 && ageMs < 15 * 60_000
    return completed || pending ? { state: 'ok' as const,
      note: completed ? 'Configured provider reports delivery for the persisted reminder; human inbox receipt is separate' : 'Configured provider reports a recent accepted reminder; delivery is pending',
      providerEvent: body.last_event }
      : failed('The persisted reminder has no timely positive provider delivery event')
  } catch { return failed('Configured email provider receipt could not be read') }
}
