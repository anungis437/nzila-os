import { randomUUID } from 'node:crypto'
import {
  governanceRationaleSchema,
  governanceRationaleInputSchema,
  governanceAssumptionSchema,
  rationaleRejectionSchema,
  rationaleAcceptedRiskSchema,
  type GovernanceRationale,
  type GovernanceRationaleInput,
  type GovernanceAssumption,
  type RationaleRejection,
  type RationaleAcceptedRisk,
  type RationaleReplayResult,
} from './schema'
import type { GovernanceRationaleStore } from './store'
import { computeRationaleHash, replayRationale } from './replay'

// ─── Governance Rationale Engine ─────────────────────────────────────────────

export class GovernanceRationaleEngine {
  readonly #store: GovernanceRationaleStore

  constructor(store: GovernanceRationaleStore) {
    this.#store = store
  }

  /**
   * Record a new governance rationale.
   * Computes and stores the replay hash immediately for tamper-evidence.
   */
  async record(input: GovernanceRationaleInput): Promise<GovernanceRationale> {
    const validated = governanceRationaleInputSchema.parse(input)

    const now = new Date().toISOString()
    const id = randomUUID()

    // Build the rationale first (without hash) to compute the hash
    const partial: GovernanceRationale = governanceRationaleSchema.parse({
      ...validated,
      id,
      assumptions: [],
      alternativesRejected: [],
      acceptedRisks: [],
      mitigationCommitments: [],
      approvedBy: [],
      isReplayable: true,
      replayHash: null,
      createdAt: now,
      updatedAt: now,
      supersededBy: null,
    })

    // Compute hash and attach
    const replayHash = computeRationaleHash(partial)

    const rationale: GovernanceRationale = { ...partial, replayHash }

    await this.#store.append(rationale)
    return rationale
  }

  /**
   * Add an assumption to an existing governance rationale.
   */
  async addAssumption(
    rationaleId: string,
    input: Omit<GovernanceAssumption, 'id'>,
  ): Promise<GovernanceRationale> {
    const existing = await this.#getOrThrow(rationaleId)

    const assumption: GovernanceAssumption = governanceAssumptionSchema.parse({
      ...input,
      id: randomUUID(),
    })

    return this.#store.update(rationaleId, {
      assumptions: [...existing.assumptions, assumption],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Record an alternative that was considered but rejected.
   */
  async addRejectedAlternative(
    rationaleId: string,
    input: RationaleRejection,
  ): Promise<GovernanceRationale> {
    const existing = await this.#getOrThrow(rationaleId)

    const rejection = rationaleRejectionSchema.parse(input)

    return this.#store.update(rationaleId, {
      alternativesRejected: [...existing.alternativesRejected, rejection],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add an accepted risk to the governance rationale.
   */
  async addAcceptedRisk(
    rationaleId: string,
    input: Omit<RationaleAcceptedRisk, 'id'>,
  ): Promise<GovernanceRationale> {
    const existing = await this.#getOrThrow(rationaleId)

    const risk: RationaleAcceptedRisk = rationaleAcceptedRiskSchema.parse({
      ...input,
      id: randomUUID(),
    })

    return this.#store.update(rationaleId, {
      acceptedRisks: [...existing.acceptedRisks, risk],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add a sign-off from an approver.
   */
  async approve(
    rationaleId: string,
    actorId: string,
    role: string,
  ): Promise<GovernanceRationale> {
    const existing = await this.#getOrThrow(rationaleId)

    return this.#store.update(rationaleId, {
      approvedBy: [
        ...existing.approvedBy,
        { actorId, role, approvedAt: new Date().toISOString() },
      ],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Supersede an existing rationale with a new one.
   * Marks the old rationale as superseded.
   */
  async supersede(
    existingRationaleId: string,
    newInput: GovernanceRationaleInput,
  ): Promise<GovernanceRationale> {
    // Assert the old rationale exists (throws if not); the return value is
    // not needed here — we only need supersededBy on the new rationale to be
    // set to `existingRationaleId`.
    await this.#getOrThrow(existingRationaleId)

    const newRationale = await this.record({
      ...newInput,
      supersedes: existingRationaleId,
    })

    await this.#store.update(existingRationaleId, {
      status: 'superseded',
      supersededBy: newRationale.id,
      updatedAt: new Date().toISOString(),
    })

    return newRationale
  }

  /**
   * Replay and verify the integrity of a governance rationale.
   * The replayHash is recomputed and compared to the stored hash.
   */
  async replay(rationaleId: string): Promise<RationaleReplayResult> {
    const rationale = await this.#getOrThrow(rationaleId)

    const result = replayRationale(rationale)
    await this.#store.appendReplay(result)

    return result
  }

  /**
   * Replay all active rationale records for an org and return integrity status.
   */
  async replayAll(orgId: string): Promise<RationaleReplayResult[]> {
    const rationales = await this.#store.getByOrg(orgId, { status: 'active' })

    const results: RationaleReplayResult[] = []
    for (const r of rationales) {
      const result = replayRationale(r)
      await this.#store.appendReplay(result)
      results.push(result)
    }

    return results
  }

  async getById(id: string): Promise<GovernanceRationale | undefined> {
    return this.#store.getById(id)
  }

  async getByOrg(orgId: string): Promise<GovernanceRationale[]> {
    return this.#store.getByOrg(orgId)
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  async #getOrThrow(id: string): Promise<GovernanceRationale> {
    const rationale = await this.#store.getById(id)
    if (!rationale) throw new Error(`GovernanceRationale ${id} not found`)
    return rationale
  }
}
