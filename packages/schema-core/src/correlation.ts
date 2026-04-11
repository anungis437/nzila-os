import { z } from 'zod'

/**
 * Correlation / distributed trace context schemas.
 */

export const correlationContextSchema = z.object({
  correlationId: z.string().min(1),
  causationId: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
})
export type CorrelationContext = z.infer<typeof correlationContextSchema>
