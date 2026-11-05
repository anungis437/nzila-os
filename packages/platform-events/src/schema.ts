/**
 * @nzila/platform-events — Zod Schemas
 *
 * Validates event envelopes at system boundaries.
 * All external-facing events MUST pass through these schemas.
 *
 * @module @nzila/platform-events/schema
 */
import { z } from 'zod'

// ── Metadata Schema ─────────────────────────────────────────────────────────

export const platformEventMetadataSchema = z.object({
  orgId: z.guid(),
  actorId: z.string().min(1),
  correlationId: z.guid(),
  causationId: z.guid().nullable(),
  source: z.string().min(1),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
})

// ── Event Envelope Schema ───────────────────────────────────────────────────

export const platformEventSchema = z.object({
  id: z.guid(),
  type: z.string().min(1).regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/, {
    message: 'Event type must be dot-namespaced lowercase, e.g. "integration.delivery.completed"',
  }),
  schemaVersion: z.string().regex(/^\d+\.\d+$/, {
    message: 'Schema version must be semver-like, e.g. "1.0"',
  }),
  payload: z.record(z.string(), z.unknown()),
  metadata: platformEventMetadataSchema,
  createdAt: z.string().datetime(),
})

export type ValidatedPlatformEvent = z.infer<typeof platformEventSchema>

// ── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Validate an event envelope. Returns the validated event or throws ZodError.
 */
export function validateEvent(event: unknown): ValidatedPlatformEvent {
  return platformEventSchema.parse(event)
}

/**
 * Safe validation — returns result object instead of throwing.
 */
export function safeValidateEvent(event: unknown): z.ZodSafeParseResult<ValidatedPlatformEvent> {
  return platformEventSchema.safeParse(event)
}
