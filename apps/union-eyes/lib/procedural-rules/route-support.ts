/**
 * Shared route policy for procedural rule administration. Role floors (not the case kernel) govern organization-level rule
 * administration: reading rules needs steward, drafting and reviewing needs officer, adopting/superseding/retiring needs the
 * organization administrator. The lifecycle itself (independent review and adoption, human actors) is enforced by the store
 * and the database, whatever the role.
 */
import type { RuleLifecycleStatus } from './types';

export const PROCEDURAL_RULES_READ_MIN_ROLE = 'steward' as const;
export const PROCEDURAL_RULES_DRAFT_MIN_ROLE = 'officer' as const;
export const PROCEDURAL_RULES_ADOPT_MIN_ROLE = 'admin' as const;

/** The role floor for moving a version to `target`. */
export function lifecycleMinRole(target: RuleLifecycleStatus): typeof PROCEDURAL_RULES_DRAFT_MIN_ROLE | typeof PROCEDURAL_RULES_ADOPT_MIN_ROLE {
  return target === 'reviewed' || target === 'draft' ? PROCEDURAL_RULES_DRAFT_MIN_ROLE : PROCEDURAL_RULES_ADOPT_MIN_ROLE;
}

export const PROCEDURAL_ENTITLEMENT = 'grievance_case_suite' as const;
