/**
 * Print the live tax-reference freshness audit.
 *
 * Exit 0 when the registry is current, or when a valid risk disposition
 * covers the actual non-current result. Exit 2 when release use is blocked.
 * Exit 1 when the invocation or disposition is invalid.
 * The command never rewrites lastVerified.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { auditTaxReferenceData, type TaxReleaseDisposition } from './freshness-audit'

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function readDisposition(path: string): TaxReleaseDisposition {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail('DISPOSITION_UNREADABLE')
  }
  if (!parsed || typeof parsed !== 'object') fail('DISPOSITION_UNREADABLE')
  const record = parsed as Record<string, unknown>
  if (record.acceptedCurrentness !== 'STALE' && record.acceptedCurrentness !== 'UNVERIFIED') {
    fail('DISPOSITION_CANNOT_CHANGE_CURRENTNESS')
  }
  return {
    decisionId: String(record.decisionId ?? ''),
    approver: String(record.approver ?? ''),
    acceptedCurrentness: record.acceptedCurrentness,
    expiresOn: String(record.expiresOn ?? ''),
    scope: Array.isArray(record.scope) ? record.scope.map((item) => String(item)) : [],
  }
}

const forwarded = process.argv.slice(2)
const args = forwarded[0] === '--' ? forwarded.slice(1) : forwarded
const { values } = parseArgs({
  args,
  options: {
    'as-of': { type: 'string' },
    out: { type: 'string' },
    'risk-disposition': { type: 'string' },
  },
  strict: true,
})

const asOf = values['as-of'] ? new Date(values['as-of']) : new Date()
if (Number.isNaN(asOf.getTime())) fail('AS_OF_INVALID')

let disposition: TaxReleaseDisposition | null = null
if (values['risk-disposition']) disposition = readDisposition(values['risk-disposition'])

let audit
try {
  audit = auditTaxReferenceData({ asOf, disposition })
} catch (error) {
  fail(error instanceof Error ? error.message : 'AUDIT_FAILED')
}

const body = `${JSON.stringify(audit, null, 2)}\n`
if (values.out) writeFileSync(values.out, body)
process.stdout.write(body)
process.stderr.write(
  `TAX_REFERENCE_DATA_CURRENTNESS=${audit.currentness} release=${audit.releaseEligibility} modules=${audit.modules.length}\n`,
)
process.exit(audit.releaseEligibility === 'BLOCKED' ? 2 : 0)
