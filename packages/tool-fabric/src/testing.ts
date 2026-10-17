/**
 * @nzila/tool-fabric/testing — TEST-ONLY fixtures
 *
 * Static resolver / verifier for unit tests and local experiments. These are
 * NOT authoritative: they accept whatever the test seeds. Production wiring
 * must never import this module (it is deliberately not exported from the
 * package barrel).
 */
import type { AgentAuthorityRecord, AgentAuthorityResolver } from './authority'
import type { GovernanceDecisionVerifier } from './governance'
import type { GovernanceDecisionSnapshot } from './types'

export class StaticAgentAuthorityResolver implements AgentAuthorityResolver {
  private readonly records = new Map<string, AgentAuthorityRecord>()

  constructor(records: readonly AgentAuthorityRecord[] = []) {
    for (const r of records) this.records.set(r.agentId, r)
  }

  set(record: AgentAuthorityRecord): void {
    this.records.set(record.agentId, record)
  }

  async resolve(agentId: string): Promise<AgentAuthorityRecord | null> {
    return this.records.get(agentId) ?? null
  }
}

export class StaticGovernanceDecisionVerifier implements GovernanceDecisionVerifier {
  private readonly decisions = new Map<string, GovernanceDecisionSnapshot>()

  add(snapshot: GovernanceDecisionSnapshot): void {
    this.decisions.set(snapshot.decisionRef, snapshot)
  }

  setStatus(decisionRef: string, status: GovernanceDecisionSnapshot['status']): void {
    const d = this.decisions.get(decisionRef)
    if (d) this.decisions.set(decisionRef, { ...d, status })
  }

  async verify(decisionRef: string): Promise<GovernanceDecisionSnapshot | null> {
    return this.decisions.get(decisionRef) ?? null
  }
}
