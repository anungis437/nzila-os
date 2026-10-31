/**
 * Platform-wide delivery suppression of an e-mail address (platform 0053, cache 0043).
 *
 * A complaint or a provider suppression on one organization's message used to stop only that organization; every other organization could
 * still write to the address, and the next complaint landed on the shared sending domain. The provider webhook now records the address
 * here, in the same transaction as the organization's own suppression, consent record and audit entry, and the single sending function
 * (lib/email-service.ts) refuses to send to an address on the list.
 *
 * This is a DELIVERY suppression, not consent: it does not revoke the recipient's consent anywhere. The table holds the SHA-256 of the
 * lower-cased address, never the address. It is system-only; a suppression is lifted only by a platform administrator (audited).
 */
import { createHash } from 'node:crypto'
import { and, inArray, isNull, eq } from 'drizzle-orm'
import { emailAddressSuppressions } from '@/db/schema/domains/communications/email-address-suppressions'
import { withSystemContext } from '@/lib/db/with-rls-context'

export type SuppressionReason = 'complaint' | 'provider_suppressed'

export const normalizeAddress = (address: string) => address.trim().toLowerCase()

export const addressSha256 = (address: string) => createHash('sha256').update(normalizeAddress(address), 'utf8').digest('hex')

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
  const hashes = [...new Set(addresses.map(addressSha256))]
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
    .where(and(eq(emailAddressSuppressions.addressSha256, addressSha256(input.address)), isNull(emailAddressSuppressions.liftedAt)))
    .returning({ id: emailAddressSuppressions.id })
  return lifted.length > 0
}