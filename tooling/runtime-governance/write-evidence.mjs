#!/usr/bin/env node
/**
 * write-evidence.mjs — Append a governance evidence record.
 *
 * Usage:
 *   echo '{"id":"...","type":"...",...}' | node tooling/runtime-governance/write-evidence.mjs
 *   node tooling/runtime-governance/write-evidence.mjs --from-file=path/to/envelope.json
 *   node tooling/runtime-governance/write-evidence.mjs --from-attestation=path/to/attestation.json
 *
 * Validates the structural shape, computes a content hash, and appends
 * to proof-artifacts/evidence/<date>/<id>.json. Refuses to mutate
 * existing records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const FORBIDDEN_KEYS = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'ip',
  'ipAddress',
  'sessionId',
  'session_id',
])

function arg(name) {
  const prefix = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found ? found.slice(prefix.length) : undefined
}

function readSource() {
  const file = arg('from-file')
  if (file) return readFileSync(file, 'utf8')

  const att = arg('from-attestation')
  if (att) {
    // Wrap an attestation in an evidence envelope.
    const attestation = JSON.parse(readFileSync(att, 'utf8'))
    return JSON.stringify({
      id: `evidence.attestation.${attestation.attestationId}`,
      schemaVersion: '1.0.0',
      type: 'runtime_attestation_recorded',
      severity: 'info',
      scope: {
        product: attestation.environment?.product ?? 'platform',
        environment: attestation.environment?.environmentClass ?? 'unknown',
        environmentClass: attestation.environment?.environmentClass ?? 'unknown',
      },
      subject: {
        kind: 'attestation',
        id: attestation.attestationId,
      },
      doctrineCitations: attestation.doctrineCitations ?? [],
      decision: attestation.verdict,
      releaseId: attestation.release?.releaseId ?? 'unknown',
      emittedAt: attestation.emittedAt ?? new Date().toISOString(),
      payload: {
        attestationClass: attestation.attestationClass,
        verdict: attestation.verdict,
      },
    })
  }

  return readFileSync(0, 'utf8')
}

let envelope
try {
  envelope = JSON.parse(readSource())
} catch (err) {
  process.stderr.write(
    `runtime-governance/write-evidence: cannot parse envelope: ${err.message}\n`,
  )
  process.exit(2)
}

const required = ['id', 'type', 'severity', 'scope', 'subject', 'releaseId', 'emittedAt', 'payload']
const missing = required.filter((k) => envelope[k] === undefined)
if (missing.length > 0) {
  process.stderr.write(
    `runtime-governance/write-evidence: envelope missing fields: ${missing.join(', ')}\n`,
  )
  process.exit(2)
}

for (const k of Object.keys(envelope.payload)) {
  if (FORBIDDEN_KEYS.has(k)) {
    process.stderr.write(
      `runtime-governance/write-evidence: forbidden payload key "${k}"; refusing\n`,
    )
    process.exit(2)
  }
}

const canonical = JSON.stringify(envelope.payload)
const contentHash =
  'sha256:' + createHash('sha256').update(canonical).digest('hex')

const date = envelope.emittedAt.slice(0, 10) // YYYY-MM-DD
const dir = resolve(process.cwd(), 'proof-artifacts', 'evidence', date)
mkdirSync(dir, { recursive: true })
const path = resolve(dir, `${envelope.id}.json`)
if (existsSync(path)) {
  process.stderr.write(
    `runtime-governance/write-evidence: refusing to mutate existing record ${path}\n`,
  )
  process.exit(2)
}

const record = {
  ...envelope,
  contentHash,
  recordedAt: new Date().toISOString(),
}
writeFileSync(path, JSON.stringify(record, null, 2) + '\n', 'utf8')

process.stdout.write(
  `runtime-governance/write-evidence: wrote ${path} contentHash=${contentHash}\n`,
)
