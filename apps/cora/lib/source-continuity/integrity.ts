import { createHash } from 'node:crypto'
import { safeJsonValueSchema, type SafeJsonValue } from './contracts'

export const INTEGRITY_ALGORITHM = 'SHA-256' as const
export const CANONICALIZATION_VERSION = 'CORAJCS-1' as const

export function canonicalizeJson(value: unknown): string {
  const parsed = safeJsonValueSchema.parse(value)

  const serialize = (current: SafeJsonValue): string => {
    if (current === null || typeof current !== 'object') {
      return JSON.stringify(current)
    }

    if (Array.isArray(current)) {
      return `[${current.map(serialize).join(',')}]`
    }

    const fields = Object.keys(current)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serialize(current[key])}`)

    return `{${fields.join(',')}}`
  }

  return serialize(parsed)
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalizeJson(value), 'utf8').digest('hex')
}
