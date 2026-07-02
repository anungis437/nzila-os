import { randomUUID } from 'node:crypto'
import {
  decisionEvidencePackSchema,
  decisionEvidencePackInputSchema,
  sealedDecisionEvidencePackSchema,
  type DecisionEvidencePack,
  type DecisionEvidencePackInput,
  type SealedDecisionEvidencePack,
} from './schema.js'
import type { DecisionEvidenceStore } from './store.js'
import { computePackHash, computeSealHash } from './hash.js'
import { exportAsJson, exportAsMarkdown } from './export.js'

// ─── Decision Evidence Builder ────────────────────────────────────────────────

export class DecisionEvidenceBuilder {
  readonly #store: DecisionEvidenceStore

  constructor(store: DecisionEvidenceStore) {
    this.#store = store
  }

  /**
   * Create a new decision evidence pack.
   * The pack hash is computed immediately from the stable canonical fields.
   */
  async create(input: DecisionEvidencePackInput): Promise<DecisionEvidencePack> {
    const validated = decisionEvidencePackInputSchema.parse(input)

    const now = new Date().toISOString()
    const id = randomUUID()

    // Build pack without hash first
    const partial = decisionEvidencePackSchema.parse({
      ...validated,
      id,
      packHash: null,
      sealed: false,
      sealedAt: null,
      createdAt: now,
    })

    // Compute hash
    const packHash = computePackHash(partial)

    const pack: DecisionEvidencePack = { ...partial, packHash }

    await this.#store.append(pack)
    return pack
  }

  /**
   * Seal a pack.
   * A sealed pack is immutable and cannot be modified.
   * Produces a sealed envelope with a full-content seal hash.
   */
  async seal(packId: string): Promise<SealedDecisionEvidencePack> {
    const pack = await this.#getOrThrow(packId)

    if (pack.sealed) {
      throw new Error(`Pack ${packId} is already sealed`)
    }

    const sealedAt = new Date().toISOString()
    const sealedPack = await this.#store.seal(packId, sealedAt, pack.packHash!)

    const sealHash = computeSealHash(sealedPack)

    const sealed: SealedDecisionEvidencePack = sealedDecisionEvidencePackSchema.parse({
      pack: { ...sealedPack, sealed: true, sealedAt },
      sealHash,
      sealedAt,
      exportFormats: ['json', 'markdown'],
    })

    await this.#store.appendSealed(sealed)
    return sealed
  }

  /**
   * Export a sealed pack in the requested format.
   */
  async export(
    packId: string,
    format: 'json' | 'markdown',
  ): Promise<string> {
    const sealed = await this.#store.getSealedPack(packId)
    if (!sealed) {
      throw new Error(`Pack ${packId} has not been sealed and cannot be exported`)
    }

    return format === 'json' ? exportAsJson(sealed) : exportAsMarkdown(sealed)
  }

  async getById(id: string): Promise<DecisionEvidencePack | undefined> {
    return this.#store.getById(id)
  }

  async getByOrg(
    orgId: string,
    options?: { packType?: string; sealed?: boolean },
  ): Promise<DecisionEvidencePack[]> {
    return this.#store.getByOrg(orgId, options)
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  async #getOrThrow(id: string): Promise<DecisionEvidencePack> {
    const pack = await this.#store.getById(id)
    if (!pack) throw new Error(`DecisionEvidencePack ${id} not found`)
    return pack
  }
}
