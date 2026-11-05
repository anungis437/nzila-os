import { z } from 'zod'

function withinDepth(value: unknown, remaining: number): boolean {
  if (value === null || typeof value !== 'object') return true
  if (remaining <= 0) return false
  const entries = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)
  return entries.every((entry) => withinDepth(entry, remaining - 1))
}

export interface JsonBounds {
  /** Serialized size in UTF-8 bytes. */
  maxBytes: number
  /** Top-level keys. */
  maxKeys: number
  /** Nesting depth of objects and arrays below the top level. */
  maxDepth: number
}

/**
 * A free-form JSON object an anonymous caller supplies is stored and read back later, so its size, key count and depth are
 * bounded before it reaches a JSONB column.
 */
export function boundedJsonRecord({ maxBytes, maxKeys, maxDepth }: JsonBounds) {
  return z
    .record(z.string().max(100), z.unknown())
    .refine((value) => Object.keys(value).length <= maxKeys, `at most ${maxKeys} keys`)
    .refine((value) => withinDepth(value, maxDepth + 1), `nested at most ${maxDepth} levels deep`)
    .refine((value) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes, `at most ${maxBytes} bytes`)
}
