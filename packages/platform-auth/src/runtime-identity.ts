/**
 * What kind of process this is, for the authentication package.
 *
 * A package cannot import apps/union-eyes/lib/runtime/production-guard.ts, so the rules the escape hatches of authentication ask are kept here. They are the
 * same rules: identity comes from the identities the deployment states (UE_ENVIRONMENT, NEXT_PUBLIC_APP_ENV, TARGET_ENVIRONMENT, NZILA_MODE and the deployment
 * type signals), and a process that runs production code and states none is production.
 *
 *   isProductionDeployment   production by any identity, or production code with no identity at all.
 *   isDeployedRuntime        production, staging, pilot or demo by any identity, or NODE_ENV=production.
 *   isLocalQaRuntime         the QA harness on a developer or acceptance machine: QA_TEST_ENV=true, the identity explicitly `local`, and no signal of a deployment.
 *                            NODE_ENV is not a signal here: a locally served production build is exactly what an acceptance machine runs.
 *
 * A QA or test bypass asks isLocalQaRuntime(); a setting that only makes sense outside a deployment asks isDeployedRuntime().
 */

const PRODUCTION = new Set(['production', 'prod'])
const DEPLOYED = new Set(['production', 'prod', 'staging', 'pilot', 'demo'])

type Source = Readonly<Record<string, string | undefined>>

const token = (value: string | undefined): string => (value ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''

const identities = (env: Source): string[] =>
  [env.UE_ENVIRONMENT, env.NEXT_PUBLIC_APP_ENV, env.TARGET_ENVIRONMENT, env.NZILA_MODE, env.UE_DEPLOYMENT_TYPE, env.NZILA_DEPLOYMENT_TYPE, env.DEPLOYMENT_ENVIRONMENT]
    .map(token)
    .filter(Boolean)

export function isProductionDeployment(env: Source = process.env): boolean {
  const named = identities(env)
  if (named.some((identity) => PRODUCTION.has(identity))) return true
  return named.length === 0 && token(env.NODE_ENV) === 'production'
}

export function isDeployedRuntime(env: Source = process.env): boolean {
  if (token(env.NODE_ENV) === 'production') return true
  return identities(env).some((identity) => DEPLOYED.has(identity))
}

export function isLocalQaRuntime(env: Source = process.env): boolean {
  if (token(env.QA_TEST_ENV) !== 'true') return false
  if (token(env.UE_ENVIRONMENT) !== 'local') return false
  return !identities(env).some((identity) => DEPLOYED.has(identity))
}
