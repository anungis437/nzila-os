/**
 * Raw Date parameters over drizzle's postgres.js driver (UE-CONV-H-011).
 *
 * drizzle's postgres-js driver replaces the driver's serializers for timestamptz, timestamp and date with identity functions, because drizzle encodes a value through its
 * column mapper (a Date becomes its ISO string) before the value reaches the driver. A Date interpolated into a raw `sql` template has no column, so it reaches the driver
 * as an object, and the driver throws ERR_INVALID_ARG_TYPE ("The "string" argument must be of type string ... Received an instance of Date") when it writes the bind
 * message. 58 production statements did this (scripts/runtime/raw-date-params.ts finds them by type).
 *
 * serializeRawDates keeps drizzle's behavior for everything drizzle already encoded and sends a Date the way drizzle's own column mappers do: as its ISO-8601 instant
 * (PostgreSQL reads that as a timestamptz, as the UTC wall clock of a timestamp, and as the UTC day of a date). Call it after drizzle() has been constructed over the client:
 * drizzle installs its serializers at construction, so an earlier call would be replaced.
 */
import type postgres from 'postgres'

/** timestamptz, timestamp and date. */
const TEMPORAL_TYPE_OIDS = ['1184', '1114', '1082'] as const

type Serializer = ((value: unknown) => unknown) & { rawDates?: true }

export function serializeRawDates<T extends postgres.Sql>(client: T): T {
  const serializers = client.options.serializers as Record<string, Serializer | undefined>
  for (const oid of TEMPORAL_TYPE_OIDS) {
    const encode = serializers[oid]
    if (encode?.rawDates) continue
    const wrapped: Serializer = (value) => (value instanceof Date ? value.toISOString() : encode ? encode(value) : value)
    wrapped.rawDates = true
    serializers[oid] = wrapped
  }
  return client
}
