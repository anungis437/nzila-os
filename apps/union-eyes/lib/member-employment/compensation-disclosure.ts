/**
 * Individual compensation is a finance disclosure.
 *
 * `hourlyRate`, `baseSalary`, and `grossWages` are a member's own pay.
 * Employment administration does not include them. Negotiated job-classification
 * bands (`minimumRate`, `maximumRate`, `standardRate`) are a different record
 * and stay with classification management.
 *
 * History snapshots are unrestricted JSON. The same pay keys are removed
 * from those snapshots unless the caller has the finance disclosure.
 */

const COMPENSATION_KEYS = new Set([
  'hourlyrate',
  'basesalary',
  'grosswages',
  'salary',
  'wages',
  'compensation',
])

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/_/g, '')
}

export function snapshotContainsCompensation(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some((item) => snapshotContainsCompensation(item, seen))
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    return COMPENSATION_KEYS.has(canonicalKey(key)) || snapshotContainsCompensation(item, seen)
  })
}

export function redactCompensationTree(value: unknown, seen = new Set<unknown>()): unknown {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return null
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => redactCompensationTree(item, seen))
  const copy: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (COMPENSATION_KEYS.has(canonicalKey(key))) continue
    copy[key] = redactCompensationTree(item, seen)
  }
  return copy
}

const RECORD_COMPENSATION_FIELDS = ['hourlyRate', 'baseSalary', 'grossWages'] as const

export function compensationWriteAttempted(data: object): boolean {
  const record = data as Record<string, unknown>
  return RECORD_COMPENSATION_FIELDS.some((key) => record[key] !== undefined)
}

export function projectMemberEmployment<T>(row: T, discloseCompensation: boolean): T {
  if (discloseCompensation || row === null || typeof row !== 'object') return row
  const source = row as { customFields?: unknown }
  return {
    ...(row as object),
    hourlyRate: null,
    baseSalary: null,
    grossWages: null,
    customFields: 'customFields' in source ? redactCompensationTree(source.customFields) : source.customFields,
  } as T
}

export function projectEmploymentHistory<T extends { previousValues?: unknown; newValues?: unknown }>(
  row: T,
  discloseCompensation: boolean,
): T {
  if (discloseCompensation) return row
  return {
    ...row,
    previousValues: redactCompensationTree(row.previousValues ?? null),
    newValues: redactCompensationTree(row.newValues ?? null),
  }
}
