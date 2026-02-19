/**
 * @nzila/ai-core — Prompt resolution
 *
 * Resolves the active prompt version for a given app + promptKey.
 * Supports variable interpolation in templates.
 */
import { db } from '@nzila/db'
import { aiPrompts, aiPromptVersions } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { ChatMessage, AiModelParams } from './types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ResolvedPrompt {
  promptId: string
  versionId: string
  version: number
  messages: ChatMessage[]
  outputSchema: Record<string, unknown> | null
  defaultParams: AiModelParams
}

// ── Resolve active prompt ───────────────────────────────────────────────────

/**
 * Resolve the active prompt version for the given app + promptKey.
 * Applies variable interpolation using `{{varName}}` syntax.
 */
export async function resolvePrompt(opts: {
  appKey: string
  promptKey: string
  variables?: Record<string, string>
}): Promise<ResolvedPrompt | null> {
  // 1. Find the prompt
  const [prompt] = await db
    .select()
    .from(aiPrompts)
    .where(
      and(
        eq(aiPrompts.appKey, opts.appKey),
        eq(aiPrompts.promptKey, opts.promptKey),
      ),
    )
    .limit(1)

  if (!prompt) return null

  // 2. Find the active version (or latest staged)
  const [version] = await db
    .select()
    .from(aiPromptVersions)
    .where(
      and(
        eq(aiPromptVersions.promptId, prompt.id),
        eq(aiPromptVersions.status, 'active'),
      ),
    )
    .orderBy(desc(aiPromptVersions.version))
    .limit(1)

  if (!version) return null

  // 3. Interpolate variables
  const interpolate = (tpl: string): string => {
    if (!opts.variables) return tpl
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return opts.variables![key] ?? `{{${key}}}`
    })
  }

  const messages: ChatMessage[] = []

  if (version.systemTemplate) {
    messages.push({ role: 'system', content: interpolate(version.systemTemplate) })
  }

  messages.push({ role: 'user', content: interpolate(version.template) })

  const defaultParams = (version.defaultParams ?? {}) as AiModelParams

  return {
    promptId: prompt.id,
    versionId: version.id,
    version: version.version,
    messages,
    outputSchema: version.outputSchema as Record<string, unknown> | null,
    defaultParams,
  }
}

// ── List prompt versions ────────────────────────────────────────────────────

export async function listPromptVersions(promptId: string) {
  return db
    .select()
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptId, promptId))
    .orderBy(desc(aiPromptVersions.version))
}

// ── Activate a version (retire previous active) ────────────────────────────

export async function activatePromptVersion(versionId: string): Promise<void> {
  // Get the version to find its promptId
  const [ver] = await db
    .select()
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.id, versionId))
    .limit(1)

  if (!ver) throw new Error(`Prompt version ${versionId} not found`)

  // Retire current active versions for the same prompt
  const activeVersions = await db
    .select()
    .from(aiPromptVersions)
    .where(
      and(
        eq(aiPromptVersions.promptId, ver.promptId),
        eq(aiPromptVersions.status, 'active'),
      ),
    )

  for (const av of activeVersions) {
    await db
      .update(aiPromptVersions)
      .set({ status: 'retired', updatedAt: new Date() })
      .where(eq(aiPromptVersions.id, av.id))
  }

  // Activate the target version
  await db
    .update(aiPromptVersions)
    .set({ status: 'active', activatedAt: new Date(), updatedAt: new Date() })
    .where(eq(aiPromptVersions.id, versionId))
}
