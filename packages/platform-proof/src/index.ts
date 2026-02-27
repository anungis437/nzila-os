/**
 * Nzila OS — Governance Proof Pack
 *
 * Generates an immutable, hash-signed governance proof pack
 * containing contract test hash, CI status, migration ID,
 * audit integrity hash, secret scan status, and red-team summary.
 *
 * @module @nzila/platform-proof
 */

export {
  generateGovernanceProofPack,
  computeSignatureHash,
  type GovernanceProofPack,
} from './proof'
