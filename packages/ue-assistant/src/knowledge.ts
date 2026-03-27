/**
 * @nzila/ue-assistant — Knowledge Layer / Scoped RAG (Phase 4)
 *
 * Retrieves source-grounded knowledge for the assistant. Knowledge
 * sources are scoped by org, local, and role. Retrieval follows
 * local > global and structured > unstructured priority.
 */
import {
  KnowledgeSourceTypes,
  type KnowledgeCitation,
  type KnowledgeSourceType,
  type UserContext,
  UEAssistantRoles,
  type IntentType,
  IntentTypes,
} from './types'

// ── Knowledge Entry ─────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  readonly id: string
  readonly sourceType: KnowledgeSourceType
  readonly orgId: string
  readonly localId: string | null
  readonly title: string
  readonly content: string
  readonly language: string
  readonly tags: readonly string[]
}

// ── Knowledge Store Interface ───────────────────────────────────────────────

export interface KnowledgeStore {
  search(params: {
    query: string
    orgId: string
    localId: string
    sourceTypes: readonly KnowledgeSourceType[]
    language: string
    limit: number
  }): KnowledgeEntry[]
}

// ── In-Memory Knowledge Store (for testing / default) ───────────────────────

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly entries: KnowledgeEntry[] = []

  add(entry: KnowledgeEntry): void {
    this.entries.push(entry)
  }

  search(params: {
    query: string
    orgId: string
    localId: string
    sourceTypes: readonly KnowledgeSourceType[]
    language: string
    limit: number
  }): KnowledgeEntry[] {
    const lower = params.query.toLowerCase()
    return this.entries
      .filter((e) => {
        // Org scope: must match org
        if (e.orgId !== params.orgId) return false
        // Local scope: local-specific entries must match local
        if (e.localId !== null && e.localId !== params.localId) return false
        // Source type filter
        if (!params.sourceTypes.includes(e.sourceType)) return false
        // Content match (simple keyword search)
        return (
          e.content.toLowerCase().includes(lower) ||
          e.title.toLowerCase().includes(lower) ||
          e.tags.some((t) => lower.includes(t.toLowerCase()))
        )
      })
      // Local entries first (local > global priority)
      .sort((a, b) => {
        if (a.localId !== null && b.localId === null) return -1
        if (a.localId === null && b.localId !== null) return 1
        // Same-language entries first
        if (a.language === params.language && b.language !== params.language)
          return -1
        if (a.language !== params.language && b.language === params.language)
          return 1
        return 0
      })
      .slice(0, params.limit)
  }
}

// ── Source Type Resolution ──────────────────────────────────────────────────

const INTENT_SOURCE_MAP: Record<IntentType, readonly KnowledgeSourceType[]> = {
  [IntentTypes.GRIEVANCE]: [
    KnowledgeSourceTypes.GRIEVANCE_PROCEDURE,
    KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    KnowledgeSourceTypes.CASE_DATA,
  ],
  [IntentTypes.RIGHTS]: [
    KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    KnowledgeSourceTypes.GRIEVANCE_PROCEDURE,
  ],
  [IntentTypes.CONTRACT]: [
    KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
  ],
  [IntentTypes.SAFETY]: [
    KnowledgeSourceTypes.SAFETY_POLICY,
    KnowledgeSourceTypes.UE_WORKFLOW,
  ],
  [IntentTypes.BENEFITS]: [
    KnowledgeSourceTypes.BENEFITS_DOCUMENTATION,
    KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
  ],
  [IntentTypes.VOTING]: [
    KnowledgeSourceTypes.UE_WORKFLOW,
    KnowledgeSourceTypes.MODULE_CONFIG,
  ],
  [IntentTypes.EDUCATION]: [
    KnowledgeSourceTypes.UE_WORKFLOW,
    KnowledgeSourceTypes.MODULE_CONFIG,
  ],
  [IntentTypes.NAVIGATION]: [
    KnowledgeSourceTypes.UE_ROUTE,
    KnowledgeSourceTypes.UE_WORKFLOW,
  ],
  [IntentTypes.CASE_ANALYSIS]: [
    KnowledgeSourceTypes.CASE_DATA,
    KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    KnowledgeSourceTypes.GRIEVANCE_PROCEDURE,
  ],
  [IntentTypes.DRAFTING]: [
    KnowledgeSourceTypes.GRIEVANCE_PROCEDURE,
    KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    KnowledgeSourceTypes.CASE_DATA,
  ],
  [IntentTypes.OVERSIGHT]: [
    KnowledgeSourceTypes.CASE_DATA,
    KnowledgeSourceTypes.UE_WORKFLOW,
    KnowledgeSourceTypes.MODULE_CONFIG,
  ],
  [IntentTypes.UNKNOWN]: [],
}

export function getSourceTypesForIntent(
  intent: IntentType,
): readonly KnowledgeSourceType[] {
  return INTENT_SOURCE_MAP[intent] ?? []
}

// ── Scoped Retrieval ────────────────────────────────────────────────────────

/**
 * Retrieve knowledge entries scoped by context, intent, and role.
 * Case data is only retrievable by stewards, local admins, or parent admins.
 */
export function retrieveKnowledge(
  store: KnowledgeStore,
  query: string,
  intent: IntentType,
  ctx: UserContext,
  limit: number = 5,
): KnowledgeCitation[] {
  let sourceTypes = [...getSourceTypesForIntent(intent)]

  // Members cannot access case data directly through knowledge layer
  if (ctx.userRole === UEAssistantRoles.MEMBER) {
    sourceTypes = sourceTypes.filter(
      (s) => s !== KnowledgeSourceTypes.CASE_DATA,
    )
  }

  if (sourceTypes.length === 0) return []

  const entries = store.search({
    query,
    orgId: ctx.orgId,
    localId: ctx.localId,
    sourceTypes,
    language: ctx.language,
    limit,
  })

  return entries.map((e, i) => ({
    sourceType: e.sourceType,
    sourceId: e.id,
    title: e.title,
    excerpt: e.content.slice(0, 200),
    relevanceScore: Math.max(0.5, 1 - i * 0.1),
  }))
}
