export type CatalogQuery = { name: string; sql: string }

export type CatalogRow = Record<string, unknown>

export type CatalogAdmissionReport = {
  ok: boolean
  applicationReady: false
  environment: string
  source: string
  violations: string[]
}

export const admissionQueries: CatalogQuery[]

export function catalogContractDigest(payload: unknown): string

export function assessCatalogAdmission(
  contract: { digest?: string; payload?: unknown },
  snapshots: Record<string, CatalogRow[]>,
  environment?: string,
): CatalogAdmissionReport

export function privilegesInOrder(value: unknown): string[] | 'TBD'
