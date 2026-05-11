/**
 * Production Guard (ESM JS mirror of lib/runtime/production-guard.ts)
 *
 * Used by .mjs seed scripts that cannot import the TS module directly.
 * Keep behavior identical to production-guard.ts.
 */

const PRODUCTION_TOKENS = new Set(['production', 'prod'])

export function resolveEnvironment() {
  const ue = (process.env.UE_ENVIRONMENT ?? '').trim().toLowerCase()
  if (ue) return { environment: ue, source: 'UE_ENVIRONMENT' }

  const pub = (process.env.NEXT_PUBLIC_APP_ENV ?? '').trim().toLowerCase()
  if (pub) return { environment: pub, source: 'NEXT_PUBLIC_APP_ENV' }

  const node = (process.env.NODE_ENV ?? '').trim().toLowerCase().split(/\s+/)[0]
  if (node) return { environment: node, source: 'NODE_ENV' }

  return { environment: '', source: 'unset' }
}

export function isProduction() {
  return PRODUCTION_TOKENS.has(resolveEnvironment().environment)
}

export function assertNotProduction(scriptName) {
  const resolved = resolveEnvironment()

  if (!PRODUCTION_TOKENS.has(resolved.environment)) {
    return
  }

  if (process.env.ALLOW_PRODUCTION_SEED === '1') {
    process.stderr.write(
      `[production-guard] ALLOW_PRODUCTION_SEED=1 override active. Continuing ${scriptName} against production. This action is auditable.\n`,
    )
    return
  }

  const message =
    `[production-guard] Refusing to run "${scriptName}" against environment="${resolved.environment}" ` +
    `(resolved from ${resolved.source}). ` +
    `Demo, test and reset scripts are blocked in production. ` +
    `If this is an intentional one-time recovery, re-run with ALLOW_PRODUCTION_SEED=1.`

  process.stderr.write(message + '\n')
  throw new Error(message)
}
