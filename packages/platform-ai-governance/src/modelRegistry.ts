import { randomUUID } from 'node:crypto'
import type { ModelRegistryEntry } from './types'
import { getGovernanceStore, persistGovernanceCollection } from './store'

export function registerModel(params: {
  name: string
  version: string
  provider: string
  capabilities: string[]
  riskLevel: 'low' | 'medium' | 'high'
}): ModelRegistryEntry {
  const registry = getGovernanceStore().getModelRegistry()
  const entry: ModelRegistryEntry = {
    id: randomUUID(),
    ...params,
    approvedForProduction: false,
    registeredAt: new Date().toISOString(),
  }
  registry.push(entry)
  persistGovernanceCollection('modelRegistry')
  return entry
}

export function approveModel(modelId: string): ModelRegistryEntry | undefined {
  const registry = getGovernanceStore().getModelRegistry()
  const entry = registry.find((m) => m.id === modelId)
  if (entry) {
    entry.approvedForProduction = true
    entry.lastAuditedAt = new Date().toISOString()
    persistGovernanceCollection('modelRegistry')
  }
  return entry
}

export function getModel(modelId: string): ModelRegistryEntry | undefined {
  const registry = getGovernanceStore().getModelRegistry()
  return registry.find((m) => m.id === modelId)
}

export function listModels(filters?: {
  provider?: string
  approvedOnly?: boolean
}): ModelRegistryEntry[] {
  const registry = getGovernanceStore().getModelRegistry()
  let results = [...registry]
  if (filters?.provider) results = results.filter((m) => m.provider === filters.provider)
  if (filters?.approvedOnly) results = results.filter((m) => m.approvedForProduction)
  return results
}

export function clearRegistry(): void {
  const registry = getGovernanceStore().getModelRegistry()
  registry.length = 0
  persistGovernanceCollection('modelRegistry')
}
