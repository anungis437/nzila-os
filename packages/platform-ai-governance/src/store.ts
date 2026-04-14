import type {
  AIDecisionLogEntry,
  HumanReviewFlag,
  ModelRegistryEntry,
  PromptVersion,
} from './types'

export type GovernanceCollection =
  | 'modelRegistry'
  | 'promptVersions'
  | 'decisionLog'
  | 'reviewFlags'

export interface GovernanceStore {
  getModelRegistry(): ModelRegistryEntry[]
  getPromptVersions(): PromptVersion[]
  getDecisionLog(): AIDecisionLogEntry[]
  getReviewFlags(): HumanReviewFlag[]
  clearAll(): void
  persistCollection?(collection: GovernanceCollection): void | Promise<void>
  hydrate?(): Promise<void>
}

class InMemoryGovernanceStore implements GovernanceStore {
  private readonly modelRegistry: ModelRegistryEntry[] = []
  private readonly promptVersions: PromptVersion[] = []
  private readonly decisionLog: AIDecisionLogEntry[] = []
  private readonly reviewFlags: HumanReviewFlag[] = []

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
  }
}

let activeStore: GovernanceStore = new InMemoryGovernanceStore()

export function getGovernanceStore(): GovernanceStore {
  return activeStore
}

export function setGovernanceStore(store: GovernanceStore): void {
  activeStore = store
}

export function resetGovernanceStore(): void {
  activeStore = new InMemoryGovernanceStore()
}

export function persistGovernanceCollection(collection: GovernanceCollection): void {
  const store = getGovernanceStore()
  if (!store.persistCollection) {
    return
  }

  void Promise.resolve(store.persistCollection(collection)).catch((error) => {
    // Keep runtime flow resilient; persistence failures are surfaced via stderr.
    console.error('[platform-ai-governance] Failed to persist governance collection', {
      collection,
      error,
    })
  })
}
