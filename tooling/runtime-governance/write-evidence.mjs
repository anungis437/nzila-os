#!/usr/bin/env node
/** Append a canonical evidence ledger record; never replace an existing record. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  computeContentHash, ledgerRecordSchema, safeIdentifier, validateAttestation, verifyCitedEvidence,
} from './contracts.mjs'

const FORBIDDEN_KEYS = new Set([
  'userId', 'user_id', 'employeeId', 'employee_id', 'email', 'phone', 'ip', 'ipAddress', 'sessionId', 'session_id',
])

function rejectPrivateIdentifiers(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`forbidden payload key "${key}"`)
    rejectPrivateIdentifiers(child)
  }
}

function arg(name) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readSource() {
  const attestationFile = arg('from-attestation')
  if (!attestationFile) return JSON.parse(readFileSync(arg('from-file') || 0, 'utf8'))
  const attestation = validateAttestation(JSON.parse(readFileSync(attestationFile, 'utf8')))
  verifyCitedEvidence(attestation)
  return {
    id: `evidence.${attestation.id}`,
    type: 'runtime_attestation_recorded',
    scope: { environment: attestation.environment },
    subject: { kind: 'attestation', id: attestation.id },
    releaseId: attestation.releaseId,
    payload: { attestation },
    retentionClass: 'standard',
    accessClass: 'platform-only',
    writtenAt: new Date().toISOString(),
  }
}

try {
  const source = readSource()
  rejectPrivateIdentifiers(source.payload)
  const contentHash = computeContentHash(source.payload)
  if (source.contentHash && source.contentHash !== contentHash) throw new Error('payload content hash mismatch')
  const record = ledgerRecordSchema.parse({ ...source, contentHash })
  safeIdentifier(record.id, 'evidence id')
  const date = new Date(record.writtenAt).toISOString().slice(0, 10)
  const directory = resolve(process.cwd(), 'proof-artifacts', 'evidence', date)
  mkdirSync(directory, { recursive: true })
  const path = resolve(directory, `${record.id}.json`)
  // Exclusive creation is the write boundary, including concurrent writers.
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  process.stdout.write(`runtime-governance/write-evidence: wrote ${path} contentHash=${contentHash}\n`)
} catch (error) {
  process.stderr.write(`runtime-governance/write-evidence: ${error.message}\n`)
  process.exitCode = 2
}
