import { getState } from './state'
import { PlaneError, PLATFORM_TIERS, UNLABELLED_DEFAULT_TIER, type PlatformTier } from './types'

/**
 * Field names that carry Restricted personal or credential data when present.
 * This is an explicit schema list, not a universal classifier.
 */
export const RESTRICTED_PERSONAL_FIELDS = [
  'sin',
  'ssn',
  'taxId',
  'citizenship',
  'dateOfBirth',
  'healthCard',
  'diagnosis',
  'bankAccount',
  'will',
  'estate',
  'dependant',
  'familyMember',
  'password',
  'privateKey',
  'seed',
  'mfaSecret',
  'apiSecret',
  'pin',
  'secretValue',
] as const

export function declareRestrictedCapability(appId: string): void {
  getState().restrictedApps.add(appId)
}

export function appDeclaresRestricted(appId: string): boolean {
  return getState().restrictedApps.has(appId)
}

export interface ClassifyInput {
  appId: string
  explicitTier?: PlatformTier | null
  /** Schema can hold Restricted personal data and must name a tier. */
  sensitiveSchema?: boolean
  fields?: Record<string, unknown>
}

export interface ClassificationDecision {
  tier: PlatformTier
  source: 'explicit' | 'unlabelled_default'
}

function restrictedFieldsPresent(fields: Record<string, unknown> | undefined): string[] {
  if (!fields) return []
  const normalize = (key: string) => key.toLowerCase().replace(/[_-]/g, '')
  const names = new Set(RESTRICTED_PERSONAL_FIELDS.map(normalize))
  const found: string[] = []
  const seen = new WeakSet<object>()
  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const [key, child] of Object.entries(value)) {
      const field = path ? `${path}.${key}` : key
      if (names.has(normalize(key)) && child != null && child !== '') found.push(field)
      if (['classification', 'dataclassification'].includes(normalize(key)) && typeof child === 'string' && child.toUpperCase() === 'RESTRICTED') found.push(field)
      visit(child, field)
    }
  }
  visit(fields, '')
  return found
}

/**
 * Unlabelled non-sensitive data stays Internal.
 * Restricted personal fields, a sensitive schema, or an app that declared a
 * Restricted capability fail closed until a tier is explicit.
 * A Restricted field cannot be stored under a lower tier.
 */
export function classifyRecord(input: ClassifyInput): ClassificationDecision {
  const sensitiveFields = restrictedFieldsPresent(input.fields)
  const requiresExplicit =
    input.sensitiveSchema === true ||
    appDeclaresRestricted(input.appId) ||
    sensitiveFields.length > 0

  if (requiresExplicit && (input.explicitTier == null || input.explicitTier === undefined)) {
    throw new PlaneError(
      'EXPLICIT_CLASSIFICATION_REQUIRED',
      `App "${input.appId}" cannot store this record without an explicit tier. Unlabelled data is not treated as Internal when a Restricted capability, sensitive schema, or Restricted field is present.`,
    )
  }

  if (input.explicitTier != null && !PLATFORM_TIERS.includes(input.explicitTier)) {
    throw new PlaneError('UNKNOWN_TIER', 'Unknown classification tier.')
  }

  if (sensitiveFields.length > 0 && input.explicitTier !== 'RESTRICTED') {
    throw new PlaneError(
      'RESTRICTED_FIELD_UNDERCLASSIFIED',
      `Fields ${sensitiveFields.join(', ')} are Restricted and cannot be stored as ${input.explicitTier ?? 'unlabelled'}.`,
    )
  }

  if (input.explicitTier) {
    return { tier: input.explicitTier, source: 'explicit' }
  }

  return { tier: UNLABELLED_DEFAULT_TIER, source: 'unlabelled_default' }
}
