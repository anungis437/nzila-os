// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Prompt Versions (Admin)
 * GET  /api/ai/prompts/versions?promptId=...   → list versions
 * POST /api/ai/prompts/versions                → create version
 * PATCH /api/ai/prompts/versions               → activate a version
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { aiPromptVersions } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { requirePlatformRole } from '@/lib/api-guards'
import { activatePromptVersion, listPromptVersions } from '@nzila/ai-core'

const CreateVersionSchema = z.object({
  promptId: z.string().uuid(),
  template: z.string().min(1),
  systemTemplate: z.string().optional(),
  outputSchema: z.record(z.unknown()).optional(),
  allowedFeatures: z.array(z.string()).optional(),
  defaultParams: z.object({
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    topP: z.number().optional(),
  }).optional(),
})

const ActivateVersionSchema = z.object({
  versionId: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  const auth = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!auth.ok) return auth.response

  const promptId = req.nextUrl.searchParams.get('promptId')
  if (!promptId) {
    return NextResponse.json({ error: 'promptId required' }, { status: 400 })
  }

  const rows = await listPromptVersions(promptId)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreateVersionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Get next version number
  const [latest] = await db
    .select({ version: aiPromptVersions.version })
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptId, parsed.data.promptId))
    .orderBy(desc(aiPromptVersions.version))
    .limit(1)

  const nextVersion = (latest?.version ?? 0) + 1

  const [row] = await db
    .insert(aiPromptVersions)
    .values({
      promptId: parsed.data.promptId,
      version: nextVersion,
      template: parsed.data.template,
      systemTemplate: parsed.data.systemTemplate ?? null,
      outputSchema: parsed.data.outputSchema ?? null,
      allowedFeatures: parsed.data.allowedFeatures ?? [],
      defaultParams: parsed.data.defaultParams ?? {},
      createdBy: auth.userId,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = ActivateVersionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  await activatePromptVersion(parsed.data.versionId)

  return NextResponse.json({ activated: parsed.data.versionId })
}
