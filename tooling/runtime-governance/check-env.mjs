#!/usr/bin/env node
/** Validate complete release identity; placeholders cannot establish provenance. */
import { releaseIdentity, requireEnv } from './contracts.mjs'

try {
  const identity = releaseIdentity()
  const environment = requireEnv('NZILA_ENVIRONMENT_CLASS')
  process.stdout.write(`runtime-governance/check-env: ok release=${identity.releaseId} env=${environment}\n`)
} catch (error) {
  process.stderr.write(`runtime-governance/check-env: ${error.message}\n`)
  process.exitCode = 2
}
