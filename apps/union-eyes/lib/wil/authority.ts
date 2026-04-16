/**
 * WIL Authority Integration
 *
 * Bridges @nzila/workload-intelligence authority model with UE's
 * api-auth-guard role hierarchy. Provides route-level helpers
 * that enforce the union operating principle:
 *
 *   "A member may submit initial information, but ONLY a rep/LRO
 *    may create an official case or grievance work item."
 */

import {
  canCreateIntake,
  canCreateOfficialWorkItem,
  canConvertIntake,
  canAssignPriority,
  canOverridePriority,
  type AuthorityRole,
} from '@nzila/workload-intelligence';
import { type UserRole } from '@/lib/api-auth-guard';

/**
 * Map UE UserRole to WIL AuthorityRole.
 * The role names align 1:1 for all roles the WIL authority model defines.
 * Roles not in the WIL set (e.g. support_agent) are treated as 'member'.
 */
const WIL_AUTHORITY_ROLES = new Set<string>([
  'member', 'health_safety_rep', 'bargaining_committee', 'steward',
  'officer', 'chief_steward', 'secretary_treasurer', 'vice_president',
  'president', 'admin', 'national_officer', 'fed_staff', 'fed_executive',
  'clc_staff', 'clc_executive', 'system_admin', 'platform_lead',
  'cto', 'coo', 'app_owner',
]);

export function toAuthorityRole(ueRole: UserRole | string): AuthorityRole {
  if (WIL_AUTHORITY_ROLES.has(ueRole)) return ueRole as AuthorityRole;
  return 'member';
}

/**
 * Check if a UE user role has authority to create an official work item.
 */
export function userCanCreateOfficialWorkItem(role: UserRole | string): boolean {
  return canCreateOfficialWorkItem(toAuthorityRole(role));
}

/**
 * Check if a UE user role has authority to convert an intake to a case.
 */
export function userCanConvertIntake(role: UserRole | string): boolean {
  return canConvertIntake(toAuthorityRole(role));
}

/**
 * Check if a UE user role has authority to assign/modify priority.
 */
export function userCanAssignPriority(role: UserRole | string): boolean {
  return canAssignPriority(toAuthorityRole(role));
}

/**
 * Check if a UE user role has authority to override WIL-generated priority.
 */
export function userCanOverridePriority(role: UserRole | string): boolean {
  return canOverridePriority(toAuthorityRole(role));
}

/**
 * Check if role can create an intake (member+).
 */
export function userCanCreateIntake(role: UserRole | string): boolean {
  return canCreateIntake(toAuthorityRole(role));
}

export { type AuthorityRole } from '@nzila/workload-intelligence';
