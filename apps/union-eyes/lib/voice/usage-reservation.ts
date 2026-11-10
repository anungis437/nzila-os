import { createHash } from 'node:crypto';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { voiceUsageReservations } from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';

export type VoiceUsageStatus = 'reserved' | 'settled' | 'released' | 'held';

export function voiceIntentKeyHash(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function voiceReservationCreditsForBytes(bytes: number): number {
  // Conservative 8 kbit/s lower-bound: reserve enough started minutes before
  // disclosure; unused capacity is released when actual duration is returned.
  return Math.max(1, Math.ceil(bytes / 60_000));
}

export async function reserveVoiceUsage(
  tx: RLSTx,
  input: {
    organizationId: string;
    userId: string;
    intentKey: string;
    credits: number;
    monthlyLimit: number | null;
  },
) {
  const intentKeyHash = voiceIntentKeyHash(input.intentKey);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`voice:${input.organizationId}`}, 0))`);

  const [existing] = await tx
    .select()
    .from(voiceUsageReservations)
    .where(and(
      eq(voiceUsageReservations.organizationId, input.organizationId),
      eq(voiceUsageReservations.intentKeyHash, intentKeyHash),
    ))
    .limit(1);
  if (existing) return { reservation: existing, replay: true } as const;

  if (input.monthlyLimit !== null) {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const [usage] = await tx
      .select({ credits: sql<number>`coalesce(sum(case when ${voiceUsageReservations.status} = 'settled' then ${voiceUsageReservations.settledCredits} else ${voiceUsageReservations.reservedCredits} end), 0)::int` })
      .from(voiceUsageReservations)
      .where(and(
        eq(voiceUsageReservations.organizationId, input.organizationId),
        inArray(voiceUsageReservations.status, ['reserved', 'settled', 'held']),
        gte(voiceUsageReservations.reservedAt, month),
      ));
    if ((usage?.credits ?? 0) + input.credits > input.monthlyLimit) {
      throw new Error('VOICE_CREDITS_EXHAUSTED');
    }
  }

  const [reservation] = await tx
    .insert(voiceUsageReservations)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      intentKeyHash,
      reservedCredits: input.credits,
      status: 'reserved',
    })
    .returning();
  if (!reservation) throw new Error('VOICE_RESERVATION_FAILED');
  return { reservation, replay: false } as const;
}

export async function finalizeVoiceUsage(
  tx: RLSTx,
  input: {
    organizationId: string;
    reservationId: string;
    status: Exclude<VoiceUsageStatus, 'reserved'>;
    actualSeconds?: number;
    providerReference?: string;
    reason: string;
  },
) {
  const calculatedCredits = input.status === 'settled'
    ? Math.max(1, Math.ceil((input.actualSeconds ?? 0) / 60))
    : input.status === 'released' ? 0 : undefined;
  const [current] = await tx
    .select({ reservedCredits: voiceUsageReservations.reservedCredits })
    .from(voiceUsageReservations)
    .where(and(
      eq(voiceUsageReservations.id, input.reservationId),
      eq(voiceUsageReservations.organizationId, input.organizationId),
      eq(voiceUsageReservations.status, 'reserved'),
    ))
    .limit(1);
  if (!current) return null;
  const status = input.status === 'settled' && (calculatedCredits ?? 0) > current.reservedCredits
    ? 'held'
    : input.status;
  const settledCredits = status === 'settled' || status === 'released' ? calculatedCredits : undefined;
  const [row] = await tx
    .update(voiceUsageReservations)
    .set({
      status,
      settledCredits,
      providerReference: input.providerReference,
      outcomeReason: input.reason,
      settledAt: status === 'held' ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(voiceUsageReservations.id, input.reservationId),
      eq(voiceUsageReservations.organizationId, input.organizationId),
      eq(voiceUsageReservations.status, 'reserved'),
    ))
    .returning();
  return row ?? null;
}
