/**
 * @nzila/os-core — Policy module barrel export
 *
 * Import from '@nzila/os-core/policy'
 *
 * Usage in API routes:
 *   import { authorize, withAuth, AuthorizationError } from '@nzila/os-core/policy'
 *   import { ConsoleRole, PartnerRole } from '@nzila/os-core/policy'
 *   import { Scope } from '@nzila/os-core/policy'
 */
export { ConsoleRole, PartnerRole, UERole, SystemRole, roleIncludes } from './roles'
export type { NzilaRole } from './roles'
export { Scope, ROLE_DEFAULT_SCOPES } from './scopes'
export { authorize, withAuth, authorizeEntityAccess, AuthorizationError } from './authorize'
export type { AuthContext, AuthorizeOptions } from './authorize'

// Re-export legacy evaluateGovernanceRequirements from the old policy.ts
// This maintains backward compat until callers are updated.
export { evaluateGovernanceRequirements } from '../policy'
