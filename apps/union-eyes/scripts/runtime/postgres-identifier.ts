/**
 * PostgreSQL identifiers are limited to 63 UTF-8 bytes. Derive a deterministic,
 * collision-resistant name rather than relying on PostgreSQL's silent truncation.
 * The digest is for identifier uniqueness, not authentication or authorization.
 */
import { createHash } from 'node:crypto'

const POSTGRES_IDENTIFIER_MAX_BYTES = 63
const DIGEST_HEX_LENGTH = 16

export function fitPostgresIdentifier(identifier: string): string {
  if (Buffer.byteLength(identifier, 'utf8') <= POSTGRES_IDENTIFIER_MAX_BYTES) return identifier

  const digest = createHash('sha256').update(identifier, 'utf8').digest('hex').slice(0, DIGEST_HEX_LENGTH)
  const prefixBudget = POSTGRES_IDENTIFIER_MAX_BYTES - 1 - DIGEST_HEX_LENGTH
  let prefix = ''
  for (const character of identifier) {
    if (Buffer.byteLength(prefix + character, 'utf8') > prefixBudget) break
    prefix += character
  }
  return `${prefix}_${digest}`
}
