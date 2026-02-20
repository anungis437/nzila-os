/**
 * @nzila/os-core — Evidence module barrel export
 */
export {
  ControlFamily,
  EvidenceEventType,
  RetentionClass,
  Classification,
  BlobContainer,
  ArtifactDescriptor,
  EvidencePackRequest,
  GOVERNANCE_EVIDENCE_MAPPINGS,
} from './types'
export type {
  UploadedArtifact,
  EvidencePackResult,
  GovernanceEvidenceMapping,
} from './types'
export {
  buildEvidencePackFromAction,
  computeBasePath,
  listMappedActionTypes,
  getEvidenceMapping,
} from './builder'
export type { GovernanceActionContext } from './builder'
export { processEvidencePack } from './generate-evidence-index'
