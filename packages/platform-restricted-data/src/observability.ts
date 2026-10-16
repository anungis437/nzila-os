/**
 * Default safe-logging boundary.
 * Stack frames may remain. Secret and Restricted values attached to them may not.
 * Pattern coverage is high-confidence, not universal.
 */

const ALWAYS_REDACT_KEYS = new Set([
  'email',
  'phone',
  'phonenumber',
  'ssn',
  'sin',
  'taxid',
  'bankaccount',
  'accountnumber',
  'routingnumber',
  'password',
  'passwd',
  'secret',
  'secretvalue',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'api_key',
  'apisecret',
  'privatekey',
  'private_key',
  'authorization',
  'databaseurl',
  'database_url',
  'connectionstring',
  'connection_string',
  'citizenship',
  'dateofbirth',
  'dob',
  'healthcard',
  'diagnosis',
  'address',
  'streetaddress',
  'postalcode',
  'will',
  'estate',
  'dependant',
  'dependent',
  'familymember',
  'seed',
  'mfasecret',
  'pin',
  'requestbody',
  'responsebody',
  'prompt',
  'messages',
  'restrictedpayload',
])

const RESTRICTED_PAYLOAD_KEYS = new Set([
  'payload',
  'body',
  'content',
  'input',
  'output',
  'data',
  'text',
  'graph',
  'family',
  'beforejson',
  'afterjson',
  'request',
  'response',
])

const STRING_PATTERNS: RegExp[] = [
  /Bearer\s+\S+/gi,
  /sk-[A-Za-z0-9]{20,}/g,
  /sk_(?:live|test)_[A-Za-z0-9]{20,}/g,
  /whsec_[A-Za-z0-9]{20,}/g,
  /postgresql:\/\/[^\s:]+:[^@\s]+@[^\s]+/gi,
  /AccountKey=[A-Za-z0-9+/=]{30,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{3}[\s-]\d{3}[\s-]\d{3}\b/g,
  /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  /(?:password|secret|token|api[_-]?key|sin|ssn)\s*[:=]\s*\S+/gi,
]

export function scrubSensitiveString(value: string): string {
  let next = value
  for (const pattern of STRING_PATTERNS) {
    next = next.replace(new RegExp(pattern.source, pattern.flags), '[REDACTED]')
  }
  return next
}

function isRestrictedMark(value: unknown): boolean {
  return value === 'RESTRICTED' || value === 'restricted'
}

export function redactObservabilityRecord<T>(value: T, parentRestricted = false): T {
  return redactValue(value, parentRestricted) as T
}

function redactValue(value: unknown, parentRestricted: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, parentRestricted))
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const restricted =
      parentRestricted ||
      isRestrictedMark(source.classification) ||
      isRestrictedMark(source.dataClassification)
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(source)) {
      const lowered = key.toLowerCase()
      if (ALWAYS_REDACT_KEYS.has(lowered) || (restricted && RESTRICTED_PAYLOAD_KEYS.has(lowered))) {
        out[key] = '[REDACTED]'
      } else {
        out[key] = redactValue(child, restricted)
      }
    }
    return out
  }
  if (typeof value === 'string') return scrubSensitiveString(value)
  return value
}
