import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Request bodies of the pilot write routes (commercial transition, artifacts, intelligence, reference profile). They were cast to a
 * TypeScript type and the caller's text was stored in a jsonb column with no bound, so every field is now typed and length-bounded.
 * An absent or empty body is the empty object (these routes are triggered with no body); a body that is not an object, or a field of
 * the wrong type or size, is a 400. Unknown keys are dropped, never carried.
 */
const short = (max: number) => z.string().trim().max(max)

export const transitionPayloadSchema = z.object({
  targetState: short(60).optional(),
  reason: short(2000).optional(),
  source: short(100).optional(),
  allowSkip: z.boolean().optional(),
  applyReferenceTemplate: short(100).nullable().optional(),
  // Evidence that the other party accepted the contract. Required for contract_signed.
  counterpartAcceptance: z
    .object({
      acceptedByName: short(255).min(1),
      acceptedByRole: short(255).min(1),
      channel: z.enum(['countersigned_document', 'e_signature_provider', 'written_confirmation']),
      evidenceReference: short(500).min(1),
    })
    .optional(),
})

export const versionNotePayloadSchema = z.object({
  source: short(100).optional(),
  milestone: short(200).optional(),
  notes: short(4000).optional(),
})

export const intelligencePayloadSchema = z.object({
  lessonLearned: short(2000).optional(),
  objectionRaised: short(2000).optional(),
  requestedFeature: short(2000).optional(),
  deploymentBlocker: short(2000).optional(),
  stakeholderSentiment: z.object({
    stakeholder: short(200).optional(),
    sentiment: z.enum(['negative', 'neutral', 'positive']).optional(),
    note: short(2000).optional(),
  }).optional(),
  source: short(100).optional(),
})

export async function parsePilotPayload<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const text = await request.text().catch(() => '')
  if (text.length > 32 * 1024) return { ok: false, response: NextResponse.json({ error: 'The request is too large' }, { status: 413 }) }
  let raw: unknown = {}
  if (text.trim() !== '') {
    try {
      raw = JSON.parse(text)
    } catch {
      return { ok: false, response: NextResponse.json({ error: 'The request body must be valid JSON' }, { status: 400 }) }
    }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid request', details: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.') + ': ' + i.message) }, { status: 400 }) }
  }
  return { ok: true, data: parsed.data }
}
