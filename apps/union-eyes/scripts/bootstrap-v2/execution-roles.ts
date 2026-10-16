import { AUTH_EXECUTION_ROLES } from './auth-sql'
import { FRAMEWORK_ROLES } from './framework-contract'

export const INSTALLER_FUNCTION_OWNER_ROLES = [
  AUTH_EXECUTION_ROLES.riskReader,
  AUTH_EXECUTION_ROLES.providerReader,
  AUTH_EXECUTION_ROLES.orgAuthorityReader,
  FRAMEWORK_ROLES.reader,
] as const

export const CANONICAL_BOOTSTRAP_ROLES = [
  'ue_v2_owner',
  'union_eyes_runtime',
  'union_eyes_system',
  ...Object.values(AUTH_EXECUTION_ROLES),
  ...Object.values(FRAMEWORK_ROLES),
]
export const canonicalRoleSqlList = CANONICAL_BOOTSTRAP_ROLES.map(
  (role) => `'${role.replaceAll("'", "''")}'`,
).join(',')
