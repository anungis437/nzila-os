import { listAiPrompts, createAiPrompt } from '@/lib/services/ai-prompt-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Prompts Registry (Admin)
 * GET  /api/ai/prompts?appKey=...   → list prompts
 * POST /api/ai/prompts              → create prompt
 *
 * RBAC: org_admin or platform ai_admin
 */
import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'
import { authenticateUser, requirePlatformRole } from '@/lib/api-guards'

const CreatePromptSchema = z.object({
  appKey: z.string().min(1).max(60),
  promptKey: z.string().min(1).max(120),
  description: z.string().optional(),
  ownerRole: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const appKey = req.nextUrl.searchParams.get('appKey')

  return NextResponse.json(await listAiPrompts(appKey))
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreatePromptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  return NextResponse.json(await createAiPrompt(parsed.data, auth.userId), { status: 201 })
}
