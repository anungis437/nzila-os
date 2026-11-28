/**
 * The mapped shape an inbound case must have before anything is written (INT-02).
 *
 * The mapping turns a source payload into this shape; this decides whether the result can become a case. Every check is
 * explicit: a value is accepted, or the delivery is rejected with the field and a code. Nothing is defaulted, truncated or
 * guessed (an unknown priority is not "medium", a missing filed date is not today).
 */

export const INBOUND_CASE_TYPES = [
  'individual', 'group', 'policy', 'contract', 'harassment', 'discrimination',
  'safety', 'seniority', 'discipline', 'termination', 'other',
] as const
export const INBOUND_CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export interface InboundCase {
  readonly externalCaseId: string
  readonly title: string
  readonly description: string
  readonly type: (typeof INBOUND_CASE_TYPES)[number]
  readonly priority: (typeof INBOUND_CASE_PRIORITIES)[number]
  readonly filedDate: string
  readonly memberExternalId: string | null
}

export interface ContractIssue {
  readonly field: string
  readonly code: 'REQUIRED' | 'NOT_A_STRING' | 'TOO_LONG' | 'NOT_ALLOWED' | 'INVALID_DATE' | 'FUTURE_DATE' | 'UNEXPECTED_FIELD'
}

export type ContractResult = { ok: true; value: InboundCase } | { ok: false; issues: ContractIssue[] }

const KNOWN = new Set(['externalCaseId', 'title', 'description', 'type', 'priority', 'filedDate', 'memberExternalId'])
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2}))?$/

export function validateInboundCase(mapped: Record<string, unknown>, now: Date): ContractResult {
  const issues: ContractIssue[] = []
  const text = (field: string, max: number, required = true): string | null => {
    const value = mapped[field]
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      if (required) issues.push({ field, code: 'REQUIRED' })
      return null
    }
    if (typeof value !== 'string') {
      issues.push({ field, code: 'NOT_A_STRING' })
      return null
    }
    if (value.trim().length > max) {
      issues.push({ field, code: 'TOO_LONG' })
      return null
    }
    return value.trim()
  }
  const oneOf = <T extends string>(field: string, allowed: readonly T[]): T | null => {
    const value = text(field, 50)
    if (value === null) return null
    if (!(allowed as readonly string[]).includes(value)) {
      issues.push({ field, code: 'NOT_ALLOWED' })
      return null
    }
    return value as T
  }

  for (const field of Object.keys(mapped)) if (!KNOWN.has(field)) issues.push({ field, code: 'UNEXPECTED_FIELD' })
  const externalCaseId = text('externalCaseId', 255)
  const title = text('title', 500)
  const description = text('description', 10_000)
  const type = oneOf('type', INBOUND_CASE_TYPES)
  const priority = oneOf('priority', INBOUND_CASE_PRIORITIES)
  const memberExternalId = text('memberExternalId', 255, false)
  const filed = text('filedDate', 40)
  let filedDate: string | null = null
  if (filed !== null) {
    const parsed = DATE.test(filed) ? new Date(filed) : null
    if (!parsed || Number.isNaN(parsed.getTime())) issues.push({ field: 'filedDate', code: 'INVALID_DATE' })
    else if (parsed.getTime() > now.getTime()) issues.push({ field: 'filedDate', code: 'FUTURE_DATE' })
    else filedDate = parsed.toISOString()
  }

  if (issues.length || !externalCaseId || !title || !description || !type || !priority || !filedDate) {
    return { ok: false, issues: issues.length ? issues : [{ field: 'payload', code: 'REQUIRED' }] }
  }
  return { ok: true, value: { externalCaseId, title, description, type, priority, filedDate, memberExternalId } }
}
