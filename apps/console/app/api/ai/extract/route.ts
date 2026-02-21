/**
 * API — AI Extract (schema-validated structured output)
 * POST /api/ai/extract
 *
 * Generates structured JSON output validated against a Zod/JSON schema.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  generate,
  resolvePrompt,
  AiExtractRequestSchema,
  validateOutputSchema,
} from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiExtractRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId, appKey, profileKey, promptKey, input, variables, dataClass, trace } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // Resolve prompt to get outputSchema
    const resolved = await resolvePrompt({ appKey, promptKey, variables })
    const outputSchema = resolved?.outputSchema ?? null

    // Call generate with JSON response format
    const result = await generate({
      entityId,
      appKey,
      profileKey,
      promptKey,
      input,
      variables,
      dataClass,
      trace,
    })

    // Parse the response as JSON
    let parsedOutput: Record<string, unknown>
    try {
      parsedOutput = JSON.parse(result.content)
    } catch {
      // Retry once with a repair prompt
      const repairResult = await generate({
        entityId,
        appKey,
        profileKey,
        input: `The following text should be valid JSON. Fix it and return only valid JSON:\n\n${result.content}`,
        dataClass,
        trace,
      })

      try {
        parsedOutput = JSON.parse(repairResult.content)
      } catch {
        return NextResponse.json(
          { error: 'Failed to extract structured JSON from response', code: 'schema_invalid' },
          { status: 422 },
        )
      }
    }

    // Validate against output schema if available
    if (outputSchema) {
      const validation = validateOutputSchema(parsedOutput, outputSchema)
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Schema validation failed: ${validation.error}`, code: 'schema_invalid' },
          { status: 422 },
        )
      }
    }

    return NextResponse.json({
      requestId: result.requestId,
      data: parsedOutput,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
    })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    console.error('[AI Extract Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
