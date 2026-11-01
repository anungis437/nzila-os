/**
 * Platform-wide delivery suppression of an e-mail address (platform 0053, cache 0043).
 *
 * A complaint or a provider suppression on one organization's message used to stop only that organization; every other organization could
 * still write to the address, and the next complaint landed on the shared sending domain. The provider webhook now records the address
 * here, in the same transaction as the organization's own suppression, consent record and audit entry, and the single sending function
 * (lib/email-service.ts) refuses to send to an address on the list.
 *
 * This is a DELIVERY suppression, not consent: it does not revoke the recipient's consent anywhere. The table holds a one-way digest of the
 * normalized address, never the address. It is system-only; a suppression is lifted only by a platform administrator (audited).
 *
 * Digest. An unkeyed SHA-256 of an address can be reversed by anyone holding the table, by hashing candidate addresses, which would
 * disclose who has complained. With EMAIL_SUPPRESSION_HASH_KEY configured (32+ characters, not a placeholder) new suppressions are stored as
 * HMAC-SHA-256 under that key. Lookups and lifts always try both the keyed and the plain digest, so a suppression recorded before the key
 * was set, or while it is unset, is still honoured: a digest change never makes a suppressed address deliverable again. Without the key the
 * plain digest is used and a warning is logged once; the key is a privacy control and its absence must not switch the protection off.
 *
 * Normalization. The address is trimmed, Unicode-normalized, lower-cased, and its domain converted to ASCII (punycode) with any trailing dot
 * removed, so the same mailbox written in a different case, form or IDN spelling is the same address. Plus-addressing and dots are NOT
 * folded: providers treat them differently, and folding would suppress a different person's mailbox.
 */
import { createHash, createHmac } from 'node:crypto'
import { domainToASCII } from 'node:url'
import { and, inArray, isNull } from 'drizzle-orm'
import { emailAddressSuppressions } from '@/db/schema/domains/communications/email-address-suppressions'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'

export type SuppressionReason = 'complaint' | 'provider_suppressed'

export function normalizeAddress(address: string): string {
  const trimmed = address.trim().normalize('NFC')
  const at = trimmed.lastIndexOf('@')
  if (at <= 0) return trimmed.toLowerCase()
  const local = trimmed.slice(0, at).toLowerCase()
  const rawDomain = trimmed.slice(at + 1).replace(/\.$/, '').toLowerCase()
  return `${local}@${domainToASCII(rawDomain) || rawDomain}`
}

const MIN_KEY_LENGTH = 32
const PLACEHOLDERS = new Set(['changeme', 'change-me', 'change_me', 'placeholder', 'your-secret', 'replace-me', 'replace_me', 'todo', 'example'])
let warnedUnkeyed = false

function digestKey(): string | null {
  const value = (process.env.EMAIL_SUPPRESSION_HASH_KEY ?? '').trim()
  return value.length >= MIN_KEY_LENGTH && !PLACEHOLDERS.has(value.toLowerCase()) ? value : null
}

const plainDigest = (address: string) => createHash('sha256').update(normalizeAddress(address), 'utf8').digest('hex')

/** The digest new suppressions are stored under: keyed when a key is configured, plain otherwise. */
export function addressSha256(address: string): string {
  const key = digestKey()
  if (key) return createHmac('sha256', key).update(normalizeAddress(address), 'utf8').digest('hex')
  if (!warnedUnkeyed) {
    warnedUnkeyed = true
    logger.warn('EMAIL_SUPPRESSION_HASH_KEY is not configured: address suppressions are stored as an unkeyed digest')
  }
  return plainDigest(address)
}

/** Every digest a suppression of this address may be stored under, for lookups and lifts. */
export function addressDigests(address: string): string[] {
  return [...new Set([addressSha256(address), plainDigest(address)])]
}

/** Whether the address is among the suppressed digests returned by suppressedAddressHashes. */
export const isAddressSuppressed = (suppressed: ReadonlySet<string>, address: string): boolean => addressDigests(address).some((digest) => suppressed.has(digest))

/** `Name <a@b.c>` or `a@b.c` to `a@b.c`; null when no address can be read. */
export function extractAddress(recipient: string): string | null {
  const bracketed = /<([^<>\s]+@[^<>\s]+)>/.exec(recipient)
  const candidate = (bracketed ? bracketed[1] : recipient).trim()
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) ? candidate : null
}

type Writer = {
  insert: (table: typeof emailAddressSuppressions) => {
    values: (v: Record<string, unknown>) => { onConflictDoUpdate: (c: Record<string, unknown>) => PromiseLike<unknown> }
  }
}

/** Record or renew a suppression. A new complaint on a later message clears an earlier lift. Run it inside the webhook's transaction. */
export async function suppressAddress(
  tx: unknown,
  input: { address: string; reason: SuppressionReason; sourceOrganizationId: string; providerEventId?: string | null },
): Promise<void> {
  const hash = addressSha256(input.address)
  await (tx as Writer)
    .insert(emailAddressSuppressions)
    .values({
      addressSha256: hash,
      reason: input.reason,
      sourceOrganizationId: input.sourceOrganizationId,
      firstProviderEventId: input.providerEventId ?? null,
      lastProviderEventId: input.providerEventId ?? null,
    })
    .onConflictDoUpdate({
      target: emailAddressSuppressions.addressSha256,
      set: {
        reason: input.reason,
        lastProviderEventId: input.providerEventId ?? null,
        updatedAt: new Date(),
        liftedAt: null,
        liftedBy: null,
        liftReason: null,
      },
    })
}

/** The hashes among `addresses` that are suppressed right now (a lifted suppression does not count). */
export async function suppressedAddressHashes(addresses: string[]): Promise<Set<string>> {
  const hashes = [...new Set(addresses.flatMap(addressDigests))]
  if (hashes.length === 0) return new Set()
  const rows = await withSystemContext((tx) =>
    tx
      .select({ hash: emailAddressSuppressions.addressSha256 })
      .from(emailAddressSuppressions)
      .where(and(inArray(emailAddressSuppressions.addressSha256, hashes), isNull(emailAddressSuppressions.liftedAt))),
  )
  return new Set(rows.map((row) => row.hash))
}

/** Lift a suppression (platform administrator only; the caller audits it in the same transaction). Returns whether one was lifted. */
export async function liftAddressSuppression(
  tx: { update: (table: typeof emailAddressSuppressions) => { set: (v: Record<string, unknown>) => { where: (c: unknown) => { returning: (f: Record<string, unknown>) => PromiseLike<unknown[]> } } } },
  input: { address: string; liftedBy: string; reason: string },
): Promise<boolean> {
  const lifted = await tx
    .update(emailAddressSuppressions)
    .set({ liftedAt: new Date(), liftedBy: input.liftedBy, liftReason: input.reason, updatedAt: new Date() })
    .where(and(inArray(emailAddressSuppressions.addressSha256, addressDigests(input.address)), isNull(emailAddressSuppressions.liftedAt)))
    .returning({ id: emailAddressSuppressions.id })
  return lifted.length > 0
}