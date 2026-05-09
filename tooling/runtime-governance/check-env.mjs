#!/usr/bin/env node
/**
 * check-env.mjs — Validate that release identity environment variables
 * are present at build time.
 *
 * Refuses to proceed if any required variable is missing or empty.
 * Exits with a non-zero status to fail the CI step.
 */
const REQUIRED = [
  'NZILA_RELEASE_ID',
  'NZILA_COMMIT_SHA',
  'NZILA_MANIFEST_HASH',
  'NZILA_BUILT_AT',
  'NZILA_ENVIRONMENT_CLASS',
]

const missing = REQUIRED.filter((k) => {
  const v = process.env[k]
  return v === undefined || v === null || v === ''
})

if (missing.length > 0) {
  process.stderr.write(
    `runtime-governance/check-env: missing required release identity variables: ${missing.join(', ')}\n`,
  )
  process.exit(2)
}

process.stdout.write(
  `runtime-governance/check-env: ok release=${process.env.NZILA_RELEASE_ID} env=${process.env.NZILA_ENVIRONMENT_CLASS}\n`,
)
