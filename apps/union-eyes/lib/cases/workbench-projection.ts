export type WorkbenchAccess = 'case' | 'triage'
type Row = Record<string, unknown>
const TRIAGE_FIELDS = ['claimId','claimNumber','organizationId','claimType','status','priority','assignedTo','createdAt','updatedAt'] as const

/** Projection only. The caller must obtain access and assignment decisions from the live kernel on the same transaction. */
export function projectWorkbenchRow(row: Row, access: WorkbenchAccess, canAssign: boolean): Row {
  if (access === 'case') return { ...row, access, canAssign }
  const projected: Row = { access, canAssign }
  for (const field of TRIAGE_FIELDS) projected[field] = row[field] ?? null
  return projected
}
export function workbenchCapabilities(rows: Row[]) {
  return { canAssign: rows.some(row => row.canAssign === true) }
}
