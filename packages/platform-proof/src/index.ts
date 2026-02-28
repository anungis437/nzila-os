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

export {
  generateIntegrationsProofSection,
  type IntegrationsProofSection,
  type IntegrationProviderSnapshot,
  type IntegrationsProofPorts,
} from './integrations-proof'

export {
  generateAbrProofSection,
  type AbrProofSection,
  type AbrTerminalEventStats,
  type AbrProofPorts,
} from './abr-proof'

export {
  generateNacpIntegrityProofSection,
  type NacpIntegrityProofSection,
  type NacpSealStatus,
  type NacpAnomaly,
  type NacpIntegrityProofPorts,
} from './nacp-proof'

export { nacpIntegrityPorts } from './ports/nacp'

export {
  generateDataLifecycleProofSection,
  type DataLifecycleProofSection,
  type AppManifestSummary,
  type DataLifecycleProofPorts,
} from './data-lifecycle-proof'
