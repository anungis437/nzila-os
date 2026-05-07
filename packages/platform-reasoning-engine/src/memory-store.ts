/**
 * @nzila/platform-reasoning-engine — In-Memory Store
 */
import type { ReasoningChain, ReasoningStore } from './types'

export function createInMemoryReasoningStore(): ReasoningStore {
  const chains = new Map<string, ReasoningChain>()

  return {
    async persistChain(chain) {
      chains.set(chain.id, chain)
    },
    async getChain(id) {
      return chains.get(id)
    },
    async getChainsByEntity(entityType, resourceId) {
      return Array.from(chains.values()).filter(
        (c) => c.entityType === entityType && c.resourceId === resourceId,
      )
    },
    async getChainsByOrg(orgId, limit = 50) {
      return Array.from(chains.values())
        .filter((c) => c.orgId === orgId)
        .slice(0, limit)
    },
  }
}
