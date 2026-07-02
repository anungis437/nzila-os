import type { DecisionEvidencePack, SealedDecisionEvidencePack } from './schema'

// ─── Decision Evidence Store ──────────────────────────────────────────────────

export interface DecisionEvidenceStore {
  /** Append-only: a pack can be created but never mutated after sealing. */
  append(pack: DecisionEvidencePack): Promise<void>

  /** Get pack by ID. */
  getById(id: string): Promise<DecisionEvidencePack | undefined>

  /** List packs for an org. */
  getByOrg(
    orgId: string,
    options?: { packType?: string; sealed?: boolean; limit?: number },
  ): Promise<DecisionEvidencePack[]>

  /**
   * Seal a pack — transitions it to immutable.
   * Implementations must enforce that this is irreversible.
   */
  seal(id: string, sealedAt: string, packHash: string): Promise<DecisionEvidencePack>

  /** Retrieve the sealed evidence pack envelope for export. */
  getSealedPack(id: string): Promise<SealedDecisionEvidencePack | undefined>

  /** Append a sealed pack record (for archive / export chains). */
  appendSealed(sealed: SealedDecisionEvidencePack): Promise<void>
}
