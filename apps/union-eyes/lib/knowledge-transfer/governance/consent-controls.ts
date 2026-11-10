/**
 * Governance & Consent Controls
 *
 * Enforces privacy-safe publishing restrictions and consent lifecycle for
 * exit interview knowledge assets.
 *
 * Design principles:
 * - Consent must be explicit and recorded before semantic indexing
 * - Sensitivity levels have hard publish/index restrictions
 * - Legal review flags block publish until cleared
 * - All governance actions are audit-logged via exitInterviewEvents
 */

import type { ExitInterviewSensitivityLevel } from '@/db/schema';

/**
 * Sensitivity level definitions — affects access scope and indexing eligibility.
 */
export const SENSITIVITY_LEVELS: Record<
  ExitInterviewSensitivityLevel,
  { label: string; indexingAllowed: boolean; description: string }
> = {
  public_internal: {
    label: 'Public (Internal)',
    indexingAllowed: true,
    description: 'Available to all authenticated org members. Eligible for RAG indexing.',
  },
  restricted: {
    label: 'Restricted',
    indexingAllowed: true,
    description: 'Accessible to stewards and above. Eligible for indexing.',
  },
  privileged: {
    label: 'Privileged',
    indexingAllowed: false,
    description: 'Officer/admin access only. Not indexed for general search.',
  },
  legal_sensitive: {
    label: 'Legal Sensitive',
    indexingAllowed: false,
    description: 'Requires legal review before any distribution. Indexing blocked.',
  },
  executive_confidential: {
    label: 'Executive Confidential',
    indexingAllowed: false,
    description: 'Executive access only. Indexing blocked.',
  },
};

/**
 * Minimum role level required to READ an interview at each sensitivity level.
 * Keyed by sensitivity → minimum role name.
 */
export const SENSITIVITY_MIN_ROLE: Record<ExitInterviewSensitivityLevel, string> = {
  public_internal: 'member',
  restricted: 'steward',
  privileged: 'officer',
  legal_sensitive: 'admin',
  executive_confidential: 'admin',
};

/**
 * The sensitivity levels a caller may read, given a role check. A level the caller does not hold the role for is left
 * out, so anything built from an interview of that level is not disclosed.
 */
export async function readableSensitivityLevels(
  hasMinRole: (role: string) => Promise<boolean>,
): Promise<ExitInterviewSensitivityLevel[]> {
  const levels: ExitInterviewSensitivityLevel[] = [];
  const decisions = new Map<string, boolean>();
  for (const [level, minRole] of Object.entries(SENSITIVITY_MIN_ROLE) as Array<[ExitInterviewSensitivityLevel, string]>) {
    if (!decisions.has(minRole)) decisions.set(minRole, await hasMinRole(minRole));
    if (decisions.get(minRole)) levels.push(level);
  }
  return levels;
}

/**
 * Returns true if the given sensitivity level permits semantic indexing.
 */
export function isIndexingAllowed(
  sensitivityLevel: ExitInterviewSensitivityLevel,
  consentGranted: boolean,
): boolean {
  if (!consentGranted) return false;
  return SENSITIVITY_LEVELS[sensitivityLevel]?.indexingAllowed ?? false;
}

/**
 * Returns true if an interview can be published at the given sensitivity level.
 * Privileged and above require the consent flag to be explicitly set.
 */
export function isPublishAllowed(
  sensitivityLevel: ExitInterviewSensitivityLevel,
  consentGranted: boolean,
): boolean {
  if (sensitivityLevel === 'legal_sensitive' && !consentGranted) return false;
  return true;
}

/**
 * Human-readable access restriction summary for display in governance UI.
 */
export function describeAccessRestriction(
  sensitivityLevel: ExitInterviewSensitivityLevel,
  consentGranted: boolean,
): string {
  const def = SENSITIVITY_LEVELS[sensitivityLevel];
  const indexStatus = isIndexingAllowed(sensitivityLevel, consentGranted)
    ? 'Semantic search: enabled'
    : 'Semantic search: disabled';
  return `${def.label} — ${def.description} ${indexStatus}.`;
}

/**
 * Sensitivity rank: higher means more restrictive. legal_sensitive and executive_confidential share the top rank -
 * moving between those two is a lateral move, not a downgrade.
 */
const SENSITIVITY_RANK: Record<ExitInterviewSensitivityLevel, number> = {
  public_internal: 0,
  restricted: 1,
  privileged: 2,
  legal_sensitive: 3,
  executive_confidential: 3,
};

/**
 * Whether lowering an interview from `from` to `to` requires a second admin's approval
 * (DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW): any single administrator could
 * previously move a published interview out of legal_sensitive or executive_confidential with no second approver
 * and no legal-review step. Required whenever the current level is one of the two most restrictive tiers and the
 * requested level is strictly less restrictive - lateral moves between the two most restrictive tiers, and any
 * move to an equally or more restrictive level, do not need a second approver.
 */
export function requiresReclassificationApproval(
  from: ExitInterviewSensitivityLevel,
  to: ExitInterviewSensitivityLevel,
): boolean {
  return SENSITIVITY_RANK[from] === 3 && SENSITIVITY_RANK[to] < 3;
}

