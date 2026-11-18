import {
  AUTH_FUNCTION_EXPECTATIONS as canonicalFunctionExpectations,
  buildAuthBusinessFunctionCatalogQuery,
} from '../../../../packages/db/src/auth-storage-authority'
import { EXTERNAL_READ_OWNER } from '../../lib/external-resource-read/source'

// The private reader consumes the organization predicate and the same-org
// qualification membership companion; generic cross-product defaults stay fixed.
export const AUTH_FUNCTION_EXPECTATIONS = canonicalFunctionExpectations.map(expected =>
  ['auth_business_org_authorized', 'ue_authority_membership_rows'].includes(expected.name)
    ? { ...expected, callers: [...expected.callers, EXTERNAL_READ_OWNER] }
    : expected)
export const AUTH_BUSINESS_FUNCTION_CATALOG_QUERY = buildAuthBusinessFunctionCatalogQuery({
  auth_business_org_authorized: [EXTERNAL_READ_OWNER],
})

export {
  compileAuthBootstrapSql,
  AUTH_EXECUTION_ROLES,
  AUTH_BOUNDARY_GAPS,
  authContextSettings,
  authExecutionRole,
  AUTH_PRIVILEGE_EXPECTATIONS,
  authColumnPrivilegeAllowed,
  authSystemColumnPrivilegeAllowed,
  authTablePrivilegeAllowed,
  AUTH_PUBLIC_BINDING_EXPECTATIONS,
  AUTH_ROLE_MEMBERSHIP_EXPECTATIONS,
  AUTH_BUSINESS_ORG_PREDICATE,
  AUTH_BUSINESS_USER_PARENT_PREDICATE,
  AUTH_BUSINESS_MEMBER_PARENT_PREDICATE,
  AUTH_BUSINESS_CONTEXT_KEYS,
  authBusinessContextSettings,
  compileAuthOrgBindingSql,
  authBusinessFunctionViolations,
  type AuthExecutionContext,
} from '../../../../packages/db/src/auth-storage-authority'
