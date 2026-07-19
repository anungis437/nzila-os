import type {
  AIDecisionLogEntry,
  HumanReviewFlag,
  ModelRegistryEntry,
  PromptVersion,
} from './types'
import type { GovernanceCollection, GovernanceStore } from './store'
import { setGovernanceStore } from './store'

interface DbBindings {
  db: unknown
  aiGovernanceDecisionLog: unknown
  aiGovernanceModels: unknown
  aiGovernancePromptVersions: unknown
  aiGovernanceReviewFlags: unknown
}

let cachedBindings: DbBindings | null = null

async function loadDbBindings(): Promise<DbBindings> {
  if (cachedBindings) {
    return cachedBindings
  }

  const moduleName = '@nzila/db'
  const mod = (await import(moduleName)) as Record<string, any>
  cachedBindings = {
    db: mod.db,
    aiGovernanceDecisionLog: mod.aiGovernanceDecisionLog,
    aiGovernanceModels: mod.aiGovernanceModels,
    aiGovernancePromptVersions: mod.aiGovernancePromptVersions,
    aiGovernanceReviewFlags: mod.aiGovernanceReviewFlags,
  }

  return cachedBindings
}

function toIso(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date(String(value)).toISOString()
}

function toDate(value: string | undefined): Date | null {
  if (!value) {
    return null
  }
  return new Date(value)
}

export class PostgresGovernanceStore implements GovernanceStore {
  private readonly modelRegistry: ModelRegistryEntry[] = []
  private readonly promptVersions: PromptVersion[] = []
  private readonly decisionLog: AIDecisionLogEntry[] = []
  private readonly reviewFlags: HumanReviewFlag[] = []
  private persistQueue: Promise<void> = Promise.resolve()
  private readonly database: unknown
  private readonly bindings: DbBindings

  constructor(bindings: DbBindings, database?: unknown) {
    this.bindings = bindings
    this.database = database ?? bindings.db
  }

  async hydrate(): Promise<void> {
    const [models, prompts, decisions, flags] = await Promise.all([
      this.database.select().from(this.bindings.aiGovernanceModels),
      this.database.select().from(this.bindings.aiGovernancePromptVersions),
      this.database.select().from(this.bindings.aiGovernanceDecisionLog),
      this.database.select().from(this.bindings.aiGovernanceReviewFlags),
    ])

    this.modelRegistry.length = 0
    this.modelRegistry.push(
      ...models.map((row: unknown) => ({
        id: row.id,
        name: row.name,
        version: row.version,
        provider: row.provider,
        capabilities: (row.capabilities ?? []) as string[],
        riskLevel: row.riskLevel,
        approvedForProduction: row.approvedForProduction,
        registeredAt: toIso(row.registeredAt),
        lastAuditedAt: row.lastAuditedAt ? toIso(row.lastAuditedAt) : undefined,
      })),
    )

    this.promptVersions.length = 0
    this.promptVersions.push(
      ...prompts.map((row: unknown) => ({
        id: row.id,
        promptName: row.promptName,
        version: row.version,
        template: row.template,
        author: row.author,
        createdAt: toIso(row.createdAt),
        active: row.active,
        changeReason: row.changeReason,
      })),
    )

    this.decisionLog.length = 0
    this.decisionLog.push(
      ...decisions.map((row: unknown) => ({
        id: row.id,
        timestamp: toIso(row.timestamp),
        modelId: row.modelId,
        promptId: row.promptId,
        app: row.app,
        orgId: row.orgId,
        inputSummary: row.inputSummary,
        outputSummary: row.outputSummary,
        confidence: Number(row.confidence),
        requiresHumanReview: row.requiresHumanReview,
        reviewStatus: row.reviewStatus ?? undefined,
        reviewedBy: row.reviewedBy ?? undefined,
        reviewedAt: row.reviewedAt ? toIso(row.reviewedAt) : undefined,
        modelVersion: row.modelVersion ?? undefined,
        engineVersion: row.engineVersion ?? undefined,
        evidenceRefs: (row.evidenceRefs ?? []) as string[],
      })),
    )

    this.reviewFlags.length = 0
    this.reviewFlags.push(
      ...flags.map((row: unknown) => ({
        id: row.id,
        decisionId: row.decisionId,
        reason: row.reason,
        flaggedAt: toIso(row.flaggedAt),
        flaggedBy: row.flaggedBy,
        priority: row.priority,
        resolved: row.resolved,
        resolution: row.resolution ?? undefined,
      })),
    )
  }

  getModelRegistry(): ModelRegistryEntry[] {
    return this.modelRegistry
  }

  getPromptVersions(): PromptVersion[] {
    return this.promptVersions
  }

  getDecisionLog(): AIDecisionLogEntry[] {
    return this.decisionLog
  }

  getReviewFlags(): HumanReviewFlag[] {
    return this.reviewFlags
  }

  clearAll(): void {
    this.modelRegistry.length = 0
    this.promptVersions.length = 0
    this.decisionLog.length = 0
    this.reviewFlags.length = 0

    void this.persistCollection('modelRegistry')
    void this.persistCollection('promptVersions')
    void this.persistCollection('decisionLog')
    void this.persistCollection('reviewFlags')
  }

  persistCollection(collection: GovernanceCollection): Promise<void> {
    this.persistQueue = this.persistQueue.then(() => this.persistCollectionNow(collection))
    return this.persistQueue
  }

  private async persistCollectionNow(collection: GovernanceCollection): Promise<void> {
    if (collection === 'modelRegistry') {
      await this.database.delete(this.bindings.aiGovernanceModels)
      if (this.modelRegistry.length > 0) {
        await this.database.insert(this.bindings.aiGovernanceModels).values(
          this.modelRegistry.map((entry) => ({
            id: entry.id,
            name: entry.name,
            version: entry.version,
            provider: entry.provider,
            capabilities: entry.capabilities,
            riskLevel: entry.riskLevel,
            approvedForProduction: entry.approvedForProduction,
            registeredAt: new Date(entry.registeredAt),
            lastAuditedAt: toDate(entry.lastAuditedAt),
            updatedAt: new Date(),
          })),
        )
      }
      return
    }

    if (collection === 'promptVersions') {
      await this.database.delete(this.bindings.aiGovernancePromptVersions)
      if (this.promptVersions.length > 0) {
        await this.database.insert(this.bindings.aiGovernancePromptVersions).values(
          this.promptVersions.map((entry) => ({
            id: entry.id,
            promptName: entry.promptName,
            version: entry.version,
            template: entry.template,
            author: entry.author,
            createdAt: new Date(entry.createdAt),
            active: entry.active,
            changeReason: entry.changeReason,
            updatedAt: new Date(),
          })),
        )
      }
      return
    }

    if (collection === 'decisionLog') {
      await this.database.delete(this.bindings.aiGovernanceDecisionLog)
      if (this.decisionLog.length > 0) {
        await this.database.insert(this.bindings.aiGovernanceDecisionLog).values(
          this.decisionLog.map((entry) => ({
            id: entry.id,
            timestamp: new Date(entry.timestamp),
            modelId: entry.modelId,
            promptId: entry.promptId,
            app: entry.app,
            orgId: entry.orgId,
            inputSummary: entry.inputSummary,
            outputSummary: entry.outputSummary,
            confidence: String(entry.confidence),
            requiresHumanReview: entry.requiresHumanReview,
            reviewStatus: entry.reviewStatus ?? null,
            reviewedBy: entry.reviewedBy ?? null,
            reviewedAt: toDate(entry.reviewedAt),
            modelVersion: entry.modelVersion ?? null,
            engineVersion: entry.engineVersion ?? null,
            evidenceRefs: entry.evidenceRefs ?? [],
            updatedAt: new Date(),
          })),
        )
      }
      return
    }

    await this.database.delete(this.bindings.aiGovernanceReviewFlags)
    if (this.reviewFlags.length > 0) {
      await this.database.insert(this.bindings.aiGovernanceReviewFlags).values(
        this.reviewFlags.map((entry) => ({
          id: entry.id,
          decisionId: entry.decisionId,
          reason: entry.reason,
          flaggedAt: new Date(entry.flaggedAt),
          flaggedBy: entry.flaggedBy,
          priority: entry.priority,
          resolved: entry.resolved,
          resolution: entry.resolution ?? null,
          updatedAt: new Date(),
        })),
      )
    }
  }
}

export async function createPostgresGovernanceStore(database?: unknown): Promise<PostgresGovernanceStore> {
  const bindings = await loadDbBindings()
  const store = new PostgresGovernanceStore(bindings, database)
  await store.hydrate()
  return store
}

export async function initializeGovernanceStoreFromEnv(database?: unknown): Promise<boolean> {
  const mode = process.env.AI_GOVERNANCE_STORE?.toLowerCase()
  if (mode !== 'postgres') {
    return false
  }

  const store = await createPostgresGovernanceStore(database)
  setGovernanceStore(store)
  return true
}
