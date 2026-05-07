/**
 * @nzila/platform-governed-ai — In-Memory Store
 */
import type { AIRunRecord, AIRunStore } from './types'
import type { OntologyEntityType as _OntologyEntityType } from '@nzila/platform-ontology'

export function createInMemoryAIRunStore(): AIRunStore {
  const runs = new Map<string, AIRunRecord>()

  return {
    async persistRun(run) {
      runs.set(run.id, run)
    },
    async updateRun(id, update) {
      const existing = runs.get(id)
      if (existing) {
        runs.set(id, { ...existing, ...update })
      }
    },
    async getRun(id) {
      return runs.get(id)
    },
    async getRunsByEntity(entityType, resourceId) {
      return Array.from(runs.values()).filter(
        (r) => r.entityType === entityType && r.resourceId === resourceId,
      )
    },
    async getRunsByTenant(tenantId, limit = 50) {
      return Array.from(runs.values())
        .filter((r) => r.tenantId === tenantId)
        .slice(0, limit)
    },
  }
}

// ── Null Policy Evaluator ───────────────────────────────────────────────────

import type { PolicyEvaluator } from './types'

export function createNullPolicyEvaluator(): PolicyEvaluator {
  return {
    async evaluate() {
      return []
    },
  }
}
