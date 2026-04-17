import { z } from 'zod'

export const eventPayloadSchema = z.object({
  event: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_:.\-]+$/i, 'Invalid event format'),
  properties: z.record(z.union([z.string().max(256), z.number(), z.boolean()])).optional(),
  ts: z.string().datetime().optional(),
  page: z.string().max(512).optional(),
})

export type EventPayload = z.infer<typeof eventPayloadSchema>

export function validateEventPayload(raw: unknown): EventPayload {
  const payload = eventPayloadSchema.parse(raw)
  const properties = payload.properties ?? {}
  if (Object.keys(properties).length > 20) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'too_many_properties',
        path: ['properties'],
      },
    ])
  }
  return payload
}
