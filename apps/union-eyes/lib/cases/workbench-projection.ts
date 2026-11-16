export type WorkbenchAccess = 'case' | 'triage'
type Row = Record<string, unknown>
/** Stable keys in both projections. SQL values remain unknown until a client validates them. */
export interface WorkbenchRow extends Row {
  access: WorkbenchAccess
  canAssign: boolean
  claimId?: unknown
  organizationId?: unknown
}
const TRIAGE_FIELDS = ['claimId','claimNumber','organizationId','claimType','status','priority','assignedTo','createdAt','updatedAt'] as const

/** Projection only. The caller must obtain access and assignment decisions from the live kernel on the same transaction. */
export function projectWorkbenchRow(row: Row, access: WorkbenchAccess, canAssign: boolean): WorkbenchRow {
  if (access === 'case') return { ...row, access, canAssign }
  const projected: WorkbenchRow = { access, canAssign }
  for (const field of TRIAGE_FIELDS) projected[field] = row[field] ?? null
  return projected
}
export function workbenchCapabilities(rows: Row[]) {
  return { canAssign: rows.some(row => row.canAssign === true) }
}
