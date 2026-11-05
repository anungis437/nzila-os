/**
 * Production Guard
 *
 * What a running process is allowed to do depends on what it is: a developer's machine, a test run, a staging or pilot deployment, or production. This module
 * is the one place that says which, and the escape hatches (a role override, a default organization, a seed that may touch production, a test auth bypass)
 * ask it. A hatch is a convenience for the first two and a hole in the others, so none of them can be switched on by an environment variable where the code runs
 * as a deployment.
 *
 * Identity, in the order the deployment states it: UE_ENVIRONMENT (the canonical identity), NEXT_PUBLIC_APP_ENV (its public mirror), TARGET_ENVIRONMENT and
 * NZILA_MODE, then NODE_ENV. Two questions are asked of it:
 *
 *   isProductionDeployment()  production, by any of those identities, or a process that runs production code and names no identity at all (an unlabeled
 *                             container is production: the safe reading). One identity saying production is enough, whatever the others say.
 *   isDeployedRuntime()       any deployment (production, staging, pilot, demo), or NODE_ENV=production, which every deployed container sets. A development or
 *                             test escape hatch is refused here, so labelling a production container `development` does not open it.
 *
 * Usage at the top of any seed/reset script:
 *
 *     import { assertNotProduction } from '@/lib/runtime/production-guard'
 *     assertNotProduction('seed-clc-demo-environment')
 *
 * There is no override. A one-time recovery against production is not done with a seed script and an environment variable.
 *
 * `production-guard.mjs` mirrors this file for the `.mjs` scripts that cannot import TypeScript. Keep them identical (the test compares them).
 */

const PRODUCTION_TOKENS = new Set(['production', 'prod'])
const DEPLOYED_TOKENS = new Set(['production', 'prod', 'staging', 'pilot', 'demo'])

export type EnvironmentSource = Readonly<Record<string, string | undefined>>

export type ResolvedEnvironment = {
  environment: string
  source: 'UE_ENVIRONMENT' | 'NEXT_PUBLIC_APP_ENV' | 'NODE_ENV' | 'unset'
}

// NODE_ENV is malformed in some live containers (e.g. "production NEXT_PUBLIC_APP_ENV=staging"); split on whitespace.
const token = (value: string | undefined): string => (value ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''

export function resolveEnvironment(env: EnvironmentSource = process.env): ResolvedEnvironment {
  const ue = token(env.UE_ENVIRONMENT)
  if (ue) return { environment: ue, source: 'UE_ENVIRONMENT' }

  const pub = token(env.NEXT_PUBLIC_APP_ENV)
  if (pub) return { environment: pub, source: 'NEXT_PUBLIC_APP_ENV' }

  const node = token(env.NODE_ENV)
  if (node) return { environment: node, source: 'NODE_ENV' }

  return { environment: '', source: 'unset' }
}

const identities = (env: EnvironmentSource): string[] => [env.UE_ENVIRONMENT, env.NEXT_PUBLIC_APP_ENV, env.TARGET_ENVIRONMENT, env.NZILA_MODE].map(token).filter(Boolean)

export function isProduction(env: EnvironmentSource = process.env): boolean {
  return PRODUCTION_TOKENS.has(resolveEnvironment(env).environment)
}

export function isProductionDeployment(env: EnvironmentSource = process.env): boolean {
  const named = identities(env)
  if (named.some((identity) => PRODUCTION_TOKENS.has(identity))) return true
  return named.length === 0 && token(env.NODE_ENV) === 'production'
}

export function isDeployedRuntime(env: EnvironmentSource = process.env): boolean {
  if (token(env.NODE_ENV) === 'production') return true
  return identities(env).some((identity) => DEPLOYED_TOKENS.has(identity))
}

/** True when a development or test escape hatch is switched on (`true` or `1`, nothing looser) in a process that is not a deployment. */
export function escapeHatchActive(name: string, env: EnvironmentSource = process.env): boolean {
  if (isDeployedRuntime(env)) return false
  return ['1', 'true'].includes((env[name] ?? '').trim().toLowerCase())
}

/**
 * The QA harness of a developer or acceptance machine: QA_TEST_ENV=true, an identity that is explicitly `local`, and no signal of a deployment. NODE_ENV is not a
 * signal here: a locally served production build is exactly what an acceptance machine runs (the NAR sandbox and the QA sign-in make the same choice).
 */
export function isLocalQaRuntime(env: EnvironmentSource = process.env): boolean {
  if (token(env.QA_TEST_ENV) !== 'true') return false
  if (token(env.UE_ENVIRONMENT) !== 'local') return false
  return !identities(env).some((identity) => DEPLOYED_TOKENS.has(identity))
}

export function assertNotProduction(scriptName: string, env: EnvironmentSource = process.env): void {
  if (!isProductionDeployment(env)) return

  const resolved = resolveEnvironment(env)
  const message =
    `[production-guard] Refusing to run "${scriptName}" against a production deployment ` +
    `(environment="${resolved.environment || 'unlabeled'}", resolved from ${resolved.source}). ` +
    `Demo, test and reset scripts are blocked in production and there is no override.`

  process.stderr.write(message + '\n')
  throw new Error(message)
}
