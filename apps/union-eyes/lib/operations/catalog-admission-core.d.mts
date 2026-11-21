export type CatalogQuery = { name: string; sql: string }

export type CatalogRow = Record<string, unknown>

export type ContainedParentPolicy = {
  schema: 'public'
  table: string
  name: string
  command: 'INSERT' | 'UPDATE'
  permissive: false
  roles: ('union_eyes_runtime' | 'union_eyes_system')[]
  using: null | 'true'
  predicate: string
}

export type CatalogAdmissionReport = {
  ok: boolean
  applicationReady: false
  environment: string
  source: string
  violations: string[]
}

export const PRIVATE_ROLE_ISOLATED_SQL: string
export const admissionQueries: CatalogQuery[]

export function externalReadRoleViolations(expectedFunctions: unknown, snapshots: Record<string, CatalogRow[]>): string[]
export function physicalTriggerViolations(expected: unknown, actual: CatalogRow[], functions: unknown): string[]

export function catalogContractDigest(payload: unknown): string

export function assessCatalogAdmission(
  contract: { digest?: string; payload?: unknown },
  snapshots: Record<string, CatalogRow[]>,
  environment?: string,
): CatalogAdmissionReport

export function privilegesInOrder(value: unknown): string[] | 'TBD'

export function currentFunctionViolations(
  expected: unknown,
  actual: CatalogRow[],
): string[]

export function containedParentPolicyViolations(
  expected: unknown,
  actual: CatalogRow[],
): string[]
