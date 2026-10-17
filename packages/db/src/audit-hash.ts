import { createHash } from 'node:crypto'

export const CANONICAL_HASH_VERSION = 'canonical-v1' as const

export interface CanonicalAuditPayload {
  action: string
  actorClerkUserId: string
  actorRole: string | null
  afterJson: Record<string, unknown> | null
  hashTimestamp: string
  hashVersion: typeof CANONICAL_HASH_VERSION
  orgId: string
  targetId: string | null
  targetType: string
}

export const CANONICAL_KEY_ORDER: readonly (keyof CanonicalAuditPayload)[] = [
  'action',
  'actorClerkUserId',
  'actorRole',
  'afterJson',
  'hashTimestamp',
  'hashVersion',
  'orgId',
  'targetId',
  'targetType',
] as const

export type CanonicalPayloadInput = Omit<CanonicalAuditPayload, 'hashVersion'>

export function buildCanonicalPayload(input: CanonicalPayloadInput): CanonicalAuditPayload {
  const payload = {} as CanonicalAuditPayload
  payload.action = input.action
  payload.actorClerkUserId = input.actorClerkUserId
  payload.actorRole = input.actorRole
  payload.afterJson = input.afterJson
  payload.hashTimestamp = input.hashTimestamp
  payload.hashVersion = CANONICAL_HASH_VERSION
  payload.orgId = input.orgId
  payload.targetId = input.targetId
  payload.targetType = input.targetType
  return payload
}

export function computeCanonicalHash(
  payload: CanonicalAuditPayload,
  previousHash: string | null,
): string {
  const wrapper = { payload, previousHash }
  return createHash('sha256').update(canonicalStringify(wrapper), 'utf8').digest('hex')
}

export function canonicalStringify(value: unknown): string {
  if (value === undefined) {
    throw new Error('canonicalStringify: undefined is not a valid canonical value')
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item ?? null)).join(',')}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalStringify(entryValue)}`)
      .join(',')}}`
  }
  throw new Error(`canonicalStringify: unsupported value type ${typeof value}`)
}
