/**
 * Individual compensation is a finance disclosure.
 *
 * `hourlyRate`, `baseSalary`, and `grossWages` are a member's own pay.
 * Employment administration does not include them. Negotiated job-classification
 * bands (`minimumRate`, `maximumRate`, `standardRate`) are a different record
 * and stay with classification management.
 *
 * Employment-history `previousValues` and `newValues` are unrestricted JSON.
 * Removing known pay names does not cover `rateBefore`, `newRate`, or a
 * nested object. Non-finance responses keep only the operational allowlist,
 * and only when the value is a string, number, boolean, or null.
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

/**
 * Fields an employment administrator may see in a history snapshot.
 * These are operational facts already on the employment record. Individual
 * pay, free text, and `customFields` are absent because a snapshot can hide
 * an amount under any other name.
 */
export const OPERATIONAL_HISTORY_FIELDS = [
  'employmentStatus',
  'employmentType',
  'hireDate',
  'seniorityDate',
  'terminationDate',
  'expectedReturnDate',
  'adjustedSeniorityDate',
  'seniorityYears',
  'jobTitle',
  'jobCode',
  'jobClassification',
  'jobLevel',
  'department',
  'division',
  'employerId',
  'worksiteId',
  'bargainingUnitId',
  'payFrequency',
  'regularHoursPerWeek',
  'regularHoursPerPeriod',
  'shiftType',
  'shiftStartTime',
  'shiftEndTime',
  'operatesWeekends',
  'operates24Hours',
  'supervisorName',
  'supervisorId',
  'isProbationary',
  'probationEndDate',
  'checkoffAuthorized',
  'checkoffDate',
  'randExempt',
] as const

const OPERATIONAL_HISTORY_KEYS = new Set(OPERATIONAL_HISTORY_FIELDS.map(canonicalKey))

function isHistoryPrimitive(value: unknown): boolean {
  if (value === null) return true
  if (typeof value === 'string' || typeof value === 'boolean') return true
  return typeof value === 'number' && Number.isFinite(value)
}

export function projectOperationalHistorySnapshot(value: unknown): Record<string, unknown> | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const projected: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!OPERATIONAL_HISTORY_KEYS.has(canonicalKey(key)) || !isHistoryPrimitive(item)) continue
    projected[key] = item
  }
  return projected
}

export function historySnapshotExceedsOperationalDisclosure(value: unknown): boolean {
  if (value == null) return false
  if (typeof value !== 'object' || Array.isArray(value)) return true
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
    return !OPERATIONAL_HISTORY_KEYS.has(canonicalKey(key)) || !isHistoryPrimitive(item)
  })
}

export function projectEmploymentHistory<T extends { previousValues?: unknown; newValues?: unknown }>(
  row: T,
  discloseCompensation: boolean,
): T {
  if (discloseCompensation) return row
  return {
    ...row,
    previousValues: projectOperationalHistorySnapshot(row.previousValues),
    newValues: projectOperationalHistorySnapshot(row.newValues),
  }
}
