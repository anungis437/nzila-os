/**
 * Production Guard (ESM JS mirror of lib/runtime/production-guard.ts)
 *
 * Used by .mjs seed scripts that cannot import the TS module directly.
 * Keep behavior identical to production-guard.ts (lib/runtime/__tests__/production-guard.test.ts runs the same cases against both).
 * There is no override: see production-guard.ts.
 */

const PRODUCTION_TOKENS = new Set(['production', 'prod'])
const DEPLOYED_TOKENS = new Set(['production', 'prod', 'staging', 'pilot', 'demo'])

const token = (value) => (value ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''

export function resolveEnvironment(env = process.env) {
  const ue = token(env.UE_ENVIRONMENT)
  if (ue) return { environment: ue, source: 'UE_ENVIRONMENT' }

  const pub = token(env.NEXT_PUBLIC_APP_ENV)
  if (pub) return { environment: pub, source: 'NEXT_PUBLIC_APP_ENV' }

  const node = token(env.NODE_ENV)
  if (node) return { environment: node, source: 'NODE_ENV' }

  return { environment: '', source: 'unset' }
}

const identities = (env) => [env.UE_ENVIRONMENT, env.NEXT_PUBLIC_APP_ENV, env.TARGET_ENVIRONMENT, env.NZILA_MODE].map(token).filter(Boolean)

export function isProduction(env = process.env) {
  return PRODUCTION_TOKENS.has(resolveEnvironment(env).environment)
}

export function isProductionDeployment(env = process.env) {
  const named = identities(env)
  if (named.some((identity) => PRODUCTION_TOKENS.has(identity))) return true
  return named.length === 0 && token(env.NODE_ENV) === 'production'
}

export function isDeployedRuntime(env = process.env) {
  if (token(env.NODE_ENV) === 'production') return true
  return identities(env).some((identity) => DEPLOYED_TOKENS.has(identity))
}

export function escapeHatchActive(name, env = process.env) {
  if (isDeployedRuntime(env)) return false
  return ['1', 'true'].includes((env[name] ?? '').trim().toLowerCase())
}

export function isLocalQaRuntime(env = process.env) {
  if (token(env.QA_TEST_ENV) !== 'true') return false
  if (token(env.UE_ENVIRONMENT) !== 'local') return false
  return !identities(env).some((identity) => DEPLOYED_TOKENS.has(identity))
}

export function assertNotProduction(scriptName, env = process.env) {
  if (!isProductionDeployment(env)) return

  const resolved = resolveEnvironment(env)
  const message =
    `[production-guard] Refusing to run "${scriptName}" against a production deployment ` +
    `(environment="${resolved.environment || 'unlabeled'}", resolved from ${resolved.source}). ` +
    `Demo, test and reset scripts are blocked in production and there is no override.`

  process.stderr.write(message + '\n')
  throw new Error(message)
}
