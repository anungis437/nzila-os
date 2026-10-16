import { inspectSecretIngestion } from './secrets'
import { getState } from './state'
import {
  PlaneError,
  type EvidenceClass,
  type ModelPath,
  type PlatformTier,
  type ProviderEvidenceChecklist,
} from './types'

export interface ModelPathDecision {
  decision: 'ALLOW' | 'DENY' | 'NOT_APPLICABLE'
  allowed: boolean
  reason: string
  restrictedModelProcessingEnabled: boolean
}

const CONTRACT_KEYS: Array<keyof ProviderEvidenceChecklist> = [
  'geographicCommitment',
  'retention',
  'trainingUse',
  'subprocessors',
  'dpa',
  'securityControls',
  'dpia',
]

export function restrictedModelProcessingEnabled(): boolean {
  return [...getState().modelPaths.values()].some((path) => path.approvedForRestricted)
}

export function listModelPaths(): ModelPath[] {
  return [...getState().modelPaths.values()].map((path) => ({ ...path, evidence: { ...path.evidence } }))
}

/**
 * Approval requires every checklist item to be EXTERNAL_CONTRACT_VERIFIED.
 * CODE_PROVEN, CONFIG_PROVEN, and UNVERIFIED are not substitutes.
 * Cross-border paths stay denied: the classification standard allows
 * cross-border Restricted data only with a DPIA and lawful basis, and no
 * such instrument is verified here.
 */
export function approveRestrictedModelPath(pathId: string, evidence: ProviderEvidenceChecklist): void {
  for (const key of CONTRACT_KEYS) {
    const value: EvidenceClass = evidence[key]
    if (value !== 'EXTERNAL_CONTRACT_VERIFIED') {
      throw new PlaneError(
        'UNVERIFIED_PROVIDER_CANNOT_BE_APPROVED',
        `Provider evidence "${key}" is ${value}. Restricted approval requires EXTERNAL_CONTRACT_VERIFIED and does not accept another evidence class as a substitute.`,
      )
    }
  }
  const path = getState().modelPaths.get(pathId)
  if (!path) throw new PlaneError('MODEL_PATH_UNKNOWN', `Model path "${pathId}" is not registered.`)
  if (path.crossBorder) {
    throw new PlaneError(
      'CROSS_BORDER_RESTRICTED_DENIED',
      `Model path "${pathId}" is cross-border (${path.region}). Restricted processing stays denied.`,
    )
  }
  throw new PlaneError(
    'ZERO_RETENTION_UNVERIFIED',
    'A caller-supplied EXTERNAL_CONTRACT_VERIFIED label is not a contract on file. Zero-retention stays UNVERIFIED and Restricted model processing stays denied.',
  )
}

export function evaluateRestrictedModelPath(input: {
  classification?: PlatformTier | null
  redactionMode?: 'strict' | 'balanced' | 'off'
  modelPathId?: string
  text?: string
}): ModelPathDecision {
  if (input.classification !== 'RESTRICTED') {
    return {
      decision: 'NOT_APPLICABLE',
      allowed: true,
      reason: 'Request is not classified Restricted. Existing data classes are unchanged.',
      restrictedModelProcessingEnabled: restrictedModelProcessingEnabled(),
    }
  }
  if (input.text) {
    const secrets = inspectSecretIngestion(input.text)
    if (secrets.rejected) {
      return {
        decision: 'DENY',
        allowed: false,
        reason: `Restricted model input matched a high-confidence credential pattern (${secrets.patternNames.join(', ')}). Route the value to ${secrets.routeTo}.`,
        restrictedModelProcessingEnabled: false,
      }
    }
  }
  if (input.redactionMode === 'off') {
    return {
      decision: 'DENY',
      allowed: false,
      reason: 'Redaction mode off is denied for Restricted model traffic.',
      restrictedModelProcessingEnabled: false,
    }
  }
  const path = input.modelPathId ? getState().modelPaths.get(input.modelPathId) : undefined
  const pathDetail = path
    ? ` Path "${path.id}" region ${path.region} crossBorder=${String(path.crossBorder)} approved=${String(path.approvedForRestricted)} zeroRetention=${path.zeroRetentionClaim}.`
    : ' No model path was named.'
  return {
    decision: 'DENY',
    allowed: false,
    reason: `Restricted model processing is disabled.${pathDetail} Default deny.`,
    restrictedModelProcessingEnabled: false,
  }
}

export function bodiesSafeForPersistence(input: {
  classification?: PlatformTier | null
  requestBody: unknown
  responseBody: unknown
}): { requestBody: unknown; responseBody: unknown; persisted: boolean } {
  if (input.classification === 'RESTRICTED') {
    const omitted = { persisted: false, reason: 'restricted_body_omitted' }
    return { requestBody: omitted, responseBody: { ...omitted }, persisted: false }
  }
  return { requestBody: input.requestBody, responseBody: input.responseBody, persisted: true }
}
