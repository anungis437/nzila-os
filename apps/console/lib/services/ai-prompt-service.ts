import { platformDb } from '@nzila/db/platform'
import { aiPrompts, aiPromptVersions } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'

export interface CreatePromptInput {
  appKey: string
  promptKey: string
  description?: string
  ownerRole?: string
}
export interface CreatePromptVersionInput {
  promptId: string
  template: string
  systemTemplate?: string
  outputSchema?: Record<string, unknown>
  allowedFeatures?: string[]
  defaultParams?: { temperature?: number; maxTokens?: number; topP?: number }
}

export async function listAiPrompts(appKey: string | null) {
  const query = appKey
    ? platformDb.select().from(aiPrompts).where(eq(aiPrompts.appKey, appKey))
    : platformDb.select().from(aiPrompts)

  const rows = await query
  return rows
}

export async function createAiPrompt(input: CreatePromptInput, actorId: string) {
  const [row] = await platformDb
    .insert(aiPrompts)
    .values({
      appKey: input.appKey,
      promptKey: input.promptKey,
      description: input.description ?? null,
      ownerRole: input.ownerRole ?? null,
      createdBy: actorId,
    })
    .returning()

  return row
}

export async function createAiPromptVersion(input: CreatePromptVersionInput, actorId: string) {
  // Get next version number
  const [latest] = await platformDb
    .select({ version: aiPromptVersions.version })
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptId, input.promptId))
    .orderBy(desc(aiPromptVersions.version))
    .limit(1)

  const nextVersion = (latest?.version ?? 0) + 1

  const [row] = await platformDb
    .insert(aiPromptVersions)
    .values({
      promptId: input.promptId,
      version: nextVersion,
      template: input.template,
      systemTemplate: input.systemTemplate ?? null,
      outputSchema: input.outputSchema ?? null,
      allowedFeatures: input.allowedFeatures ?? [],
      defaultParams: input.defaultParams ?? {},
      createdBy: actorId,
    })
    .returning()

  return row
}
