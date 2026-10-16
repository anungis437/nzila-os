import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('../', import.meta.url))
export const lineage = 'PROSPECTIVE_G3R2'
export const azureExecutionAllowed = false
const actions = ['PLAN', 'LOCAL_VALIDATE', 'PROOF_MANIFEST', 'ROLLBACK_PLAN', 'RECONCILIATION_PLAN']
const read = (name) => JSON.parse(readFileSync(path.join(directory, name), 'utf8'))
export function activationGate(input) {
  assert(input && typeof input === 'object', 'EXPLICIT_ACTIVATION_EVIDENCE_REQUIRED')
  return input.explicitHumanWorkloadAuthority === true &&
    input.environmentId === input.quotaEnvironmentId &&
    typeof input.environmentId === 'string' &&
    input.environmentId.length > 0 &&
    typeof input.quotaEvidenceId === 'string' &&
    input.quotaEvidenceId.length > 0 &&
    Number.isFinite(input.availableConsumptionMilliCores) &&
    input.availableConsumptionMilliCores >= 250 &&
    input.imageSourceQualified === true &&
    /^nzilag2tzo75uuozprbo\.azurecr\.io\/g3-synthetic-runtime@sha256:[a-f0-9]{64}$/.test(
      input.immutableImage ?? '',
    )
    ? 'ELIGIBLE_FOR_SEPARATE_FUTURE_AUTHORIZATION_NOT_EXECUTION'
    : 'DENY'
}
export function validateParameters(input, schema = read('parameters.schema.json')) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'PARAMETERS_OBJECT_REQUIRED')
  assert(
    Object.keys(input).every((name) => name in schema.properties),
    'UNKNOWN_PARAMETER',
  )
  for (const key of schema.required) assert(key in input, `REQUIRED_PARAMETER:${key}`)
  for (const [key, value] of Object.entries(input)) {
    const property = schema.properties[key]
    if (property.const !== undefined)
      assert.deepEqual(value, property.const, `GOVERNED_PARAMETER:${key}`)
    if (property.type === 'array') assert(Array.isArray(value), `ARRAY_PARAMETER:${key}`)
    else if (property.type === 'object')
      assert(value && typeof value === 'object' && !Array.isArray(value), `OBJECT_PARAMETER:${key}`)
    else if (property.type === 'integer')
      assert(Number.isInteger(value), `INTEGER_PARAMETER:${key}`)
    else assert.equal(typeof value, property.type, `PARAMETER_TYPE:${key}`)
    if (property.pattern)
      assert(new RegExp(property.pattern).test(value), `PARAMETER_PATTERN:${key}`)
    if (property.items?.pattern)
      assert(
        value.every(
          (item) =>
            typeof item === 'string' &&
            new RegExp(property.items.pattern).test(item) &&
            item !== '0.0.0.0/0',
        ),
        `BOUNDED_ADDRESS_PARAMETER:${key}`,
      )
    if (property.type === 'array') {
      for (const address of value) {
        const [ip, prefixText] = address.split('/')
        const octets = ip.split('.').map(Number)
        assert(
          octets.length === 4 &&
            octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255),
          `INVALID_IPV4_PARAMETER:${key}`,
        )
        if (prefixText !== undefined) {
          const prefix = Number(prefixText)
          assert(
            key === 'approvedPlatformPrefixes' &&
              Number.isInteger(prefix) &&
              prefix >= 24 &&
              prefix <= 32,
            `EXCESSIVE_OR_INVALID_PREFIX:${key}`,
          )
          const numericIp = octets.reduce((result, octet) => result * 256 + octet, 0)
          assert(numericIp % 2 ** (32 - prefix) === 0, `NON_CANONICAL_PREFIX:${key}`)
        }
      }
    }
  }
  return { valid: true, executionAllowed: false, humanBindings: 'UNBOUND' }
}
export function localPlan(action, params = read('parameters.example.json').parameters) {
  assert(actions.includes(action), 'LOCAL_ACTION_ALLOWLIST_ONLY')
  validateParameters(params)
  if (action === 'LOCAL_VALIDATE') {
    const manifest = read('G3_SOURCE_AUTHORITY_MANIFEST.json')
    for (const entry of manifest.sourceFiles) {
      assert(
        !path.isAbsolute(entry.path) && !entry.path.includes('..'),
        'SOURCE_PATH_OUTSIDE_PACKAGE',
      )
      const actual = createHash('sha256')
        .update(readFileSync(path.join(directory, entry.path)))
        .digest('hex')
      assert.equal(actual, entry.sha256, `SOURCE_DIGEST_MISMATCH:${entry.path}`)
    }
    return { lineage, executionAllowed: false, manifestVerified: true }
  }
  const file = {
    PLAN: 'proof/G3_PROOF_MANIFEST.json',
    PROOF_MANIFEST: 'proof/G3_PROOF_MANIFEST.json',
    ROLLBACK_PLAN: 'proof/G3_ROLLBACK_PLAN.json',
    RECONCILIATION_PLAN: 'proof/G3_RECONCILIATION_PLAN.json',
  }[action]
  return { lineage, executionAllowed: false, specification: read(file) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length === 3, 'ONE_LOCAL_ACTION_ONLY')
  console.log(JSON.stringify(localPlan(process.argv[2]), null, 2))
}
