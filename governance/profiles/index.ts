/**
 * Nzila OS — Governance Policy Profiles
 *
 * Each vertical app applies a governance profile that may add stricter
 * controls or extra evidence collectors. Profiles may NEVER:
 *   - Disable org isolation
 *   - Disable audit emission
 *   - Disable evidence sealing
 *   - Disable scanner gates
 *
 * @module governance/profiles
 */

// ── Core controls that are IMMUTABLE across all profiles ────────────────────

export const IMMUTABLE_CONTROLS = [
  'org-isolation',
  'audit-emission',
  'evidence-sealing',
  'hash-chain-integrity',
  'secret-scanning',
  'dependency-audit',
  'contract-tests',
  'eslint-governance-rules',
] as const

export type ImmutableControl = (typeof IMMUTABLE_CONTROLS)[number]

// ── Profile definition ──────────────────────────────────────────────────────

export interface GovernanceProfile {
  /** Unique profile identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Profile category */
  category: 'governance' | 'fintech' | 'commerce' | 'agtech' | 'media' | 'advisory'
  /** Additional contract tests required */
  extraContractTests: string[]
  /** Additional evidence collectors */
  extraCollectors: string[]
  /** Additional red-team test vectors */
  extraRedTeamVectors: string[]
  /** Whether dual-control is required for sensitive operations */
  requiresDualControl: boolean
  /** Whether key lifecycle management is required */
  requiresKeyLifecycle: boolean
  /** Whether confidential reporting model is required */
  requiresConfidentialReporting: boolean
  /** Custom CI steps (job names) that must pass */
  extraCiGates: string[]
}

// ── Profile registry ────────────────────────────────────────────────────────

export const PROFILES: Record<string, GovernanceProfile> = {
  'union-eyes': {
    id: 'union-eyes',
    name: 'Union Eyes',
    category: 'governance',
    extraContractTests: [
      'role-graph-acyclic',
      'case-evidence-export',
      'litigation-hold',
      'document-version-hashing',
    ],
    extraCollectors: ['case-evidence', 'role-graph'],
    extraRedTeamVectors: ['unauthorized-case-access', 'role-graph-cycle-injection'],
    requiresDualControl: false,
    requiresKeyLifecycle: false,
    requiresConfidentialReporting: false,
    extraCiGates: [],
  },

  'abr-insights': {
    id: 'abr-insights',
    name: 'ABR Insights',
    category: 'advisory',
    extraContractTests: [
      'identity-vault-isolation',
      'case-access-need-to-know',
      'dual-control-case-close',
      'dual-control-severity-change',
      'dual-control-identity-unmask',
    ],
    extraCollectors: ['identity-vault', 'case-access-log'],
    extraRedTeamVectors: [
      'metadata-inference-attack',
      'unauthorized-identity-access',
      'case-correlation-leak',
    ],
    requiresDualControl: true,
    requiresKeyLifecycle: false,
    requiresConfidentialReporting: true,
    extraCiGates: ['identity-vault-test'],
  },

  fintech: {
    id: 'fintech',
    name: 'Fintech (Payments/Lending)',
    category: 'fintech',
    extraContractTests: [
      'key-rotation-artifact',
      'dual-control-financial',
      'dr-simulation-artifact',
      'double-submit-prevention',
      'transaction-idempotency',
    ],
    extraCollectors: ['key-rotation', 'financial-controls', 'dr-simulation'],
    extraRedTeamVectors: [
      'double-submit-attack',
      'key-replay-attack',
      'transaction-manipulation',
    ],
    requiresDualControl: true,
    requiresKeyLifecycle: true,
    requiresConfidentialReporting: false,
    extraCiGates: ['key-lifecycle-gate'],
  },

  commerce: {
    id: 'commerce',
    name: 'Commerce (Shop/Trade)',
    category: 'commerce',
    extraContractTests: [
      'order-idempotency',
      'inventory-consistency',
      'price-integrity',
    ],
    extraCollectors: ['order-audit', 'inventory-snapshot'],
    extraRedTeamVectors: ['price-manipulation', 'order-replay'],
    requiresDualControl: false,
    requiresKeyLifecycle: false,
    requiresConfidentialReporting: false,
    extraCiGates: [],
  },

  agtech: {
    id: 'agtech',
    name: 'AgTech',
    category: 'agtech',
    extraContractTests: [
      'supply-chain-traceability',
      'certification-integrity',
    ],
    extraCollectors: ['supply-chain', 'certification'],
    extraRedTeamVectors: ['certification-forgery', 'traceability-gap'],
    requiresDualControl: false,
    requiresKeyLifecycle: false,
    requiresConfidentialReporting: false,
    extraCiGates: [],
  },

  media: {
    id: 'media',
    name: 'Media (CongoWave/CyberLearn)',
    category: 'media',
    extraContractTests: [
      'content-integrity',
      'access-control-content',
    ],
    extraCollectors: ['content-audit'],
    extraRedTeamVectors: ['content-tampering', 'unauthorized-content-access'],
    requiresDualControl: false,
    requiresKeyLifecycle: false,
    requiresConfidentialReporting: false,
    extraCiGates: [],
  },

  advisory: {
    id: 'advisory',
    name: 'Advisory (Insight CFO/CORA)',
    category: 'advisory',
    extraContractTests: [
      'client-data-isolation',
      'report-integrity',
    ],
    extraCollectors: ['advisory-report'],
    extraRedTeamVectors: ['cross-client-data-leak', 'report-manipulation'],
    requiresDualControl: false,
    requiresKeyLifecycle: false,
    requiresConfidentialReporting: false,
    extraCiGates: [],
  },
}

// ── Profile validation ──────────────────────────────────────────────────────

export interface ProfileValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate that a profile does not disable any immutable controls.
 * This is called during CI to ensure no profile circumvents core governance.
 */
export function validateProfile(profile: GovernanceProfile): ProfileValidationResult {
  const errors: string[] = []

  // Profiles cannot have empty id
  if (!profile.id) {
    errors.push('Profile must have a non-empty id')
  }

  // Profiles cannot have empty name
  if (!profile.name) {
    errors.push('Profile must have a non-empty name')
  }

  // Ensure no profile is trying to disable immutable controls
  // (This is structural — the type system prevents it, but we validate at runtime too)
  const profileStr = JSON.stringify(profile).toLowerCase()
  const disablePatterns = [
    'disable.*isolation',
    'skip.*audit',
    'bypass.*seal',
    'disable.*scanner',
    'skip.*contract',
  ]

  for (const pattern of disablePatterns) {
    if (new RegExp(pattern).test(profileStr)) {
      errors.push(`Profile "${profile.id}" appears to disable a core control: ${pattern}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get profile by ID. Throws if profile not found.
 */
export function getProfile(profileId: string): GovernanceProfile {
  const profile = PROFILES[profileId]
  if (!profile) {
    throw new Error(
      `Unknown governance profile: "${profileId}". ` +
      `Available profiles: ${Object.keys(PROFILES).join(', ')}`,
    )
  }
  return profile
}
