import type { GovernanceRationale, RationaleReplayResult } from './schema.js'

// ─── Governance Rationale Store ───────────────────────────────────────────────

export interface GovernanceRationaleStore {
  append(rationale: GovernanceRationale): Promise<void>
  getById(id: string): Promise<GovernanceRationale | undefined>
  getByOrg(orgId: string, options?: { status?: string; limit?: number }): Promise<GovernanceRationale[]>
  update(id: string, delta: Partial<GovernanceRationale>): Promise<GovernanceRationale>
  appendReplay(result: RationaleReplayResult): Promise<void>
}
