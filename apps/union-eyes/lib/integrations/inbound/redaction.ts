/**
 * What a durable inbound failure may record (INT-13).
 *
 * A receipt, a quarantine reason and a log line are kept longer and read more widely than the payload they describe, so
 * none of them may carry a value from it: no name, e-mail, phone number, member number, credential or free text from the
 * source. A failure is stored as a code, the PostgreSQL SQLSTATE and constraint name when the database refused it, and
 * the names of the fields involved. Driver messages are never stored: PostgreSQL puts the offending values in them
 * ("Key (external_id)=(...) already exists").
 */

export interface RedactedFailure {
  readonly code: string
  readonly sqlstate?: string
  readonly constraint?: string
  readonly fields?: readonly string[]
}

const SQLSTATE = /^[0-9A-Z]{5}$/
// Identifier-shaped names only: a constraint or field name never needs more, and a value smuggled into one is cut off.
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.:[\]-]{0,99}$/

function databaseFields(error: unknown): { sqlstate?: string; constraint?: string } {
  let current = error as { code?: unknown; constraint?: unknown; constraint_name?: unknown; cause?: unknown } | undefined
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (typeof current.code === 'string' && SQLSTATE.test(current.code)) {
      const constraint = current.constraint ?? current.constraint_name
      return {
        sqlstate: current.code,
        ...(typeof constraint === 'string' && IDENTIFIER.test(constraint) ? { constraint } : {}),
      }
    }
    current = current.cause as typeof current
  }
  return {}
}

/** The guard triggers raise named reasons (UE_INTEGRATION_...): those, and only those, are kept from a message. */
function guardReason(error: unknown): string | undefined {
  let current = error as { message?: unknown; cause?: unknown } | undefined
  for (let depth = 0; current && depth < 6; depth += 1) {
    const match = typeof current.message === 'string' ? /\b(UE_INTEGRATION_[A-Z_]+)\b/.exec(current.message) : null
    if (match) return match[1]
    current = current.cause as typeof current
  }
  return undefined
}

export function redactFailure(code: string, error?: unknown, fields?: readonly string[]): RedactedFailure {
  const safeFields = fields?.filter((field) => IDENTIFIER.test(field)).slice(0, 50)
  const reason = error === undefined ? undefined : guardReason(error)
  return {
    code: reason ?? code,
    ...(error === undefined ? {} : databaseFields(error)),
    ...(safeFields && safeFields.length ? { fields: safeFields } : {}),
  }
}
