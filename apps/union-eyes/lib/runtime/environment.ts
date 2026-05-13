/**
 * Phase A canonical environment-mode model.
 *
 * Single source of truth for runtime classification of UnionEyes deployments.
 * Read this from server code; never branch on raw `process.env.NODE_ENV`.
 *
 * Variables (set by deploy-union-eyes.yml `plan` step):
 *   UE_ENVIRONMENT       — 'local'|'dev'|'staging'|'demo'|'pilot'|'production'
 *   NZILA_MODE           — 'demo'|'pilot'|'staging'|'prod'
 *   UE_DEPLOYMENT_TYPE   — 'clc-demo'|'pilot'|'staging'|'prod'
 *   UE_FEATURE_PROFILE   — 'clc'|'executive'|'internal'
 *   NEXT_PUBLIC_APP_ENV  — public mirror of UE_ENVIRONMENT (rendered to client)
 *   NEXT_PUBLIC_SITE_URL — canonical marketing URL for the env
 */

export type UeEnvironment =
  | 'local'
  | 'dev'
  | 'staging'
  | 'demo'
  | 'pilot'
  | 'production'

export type NzilaMode = 'demo' | 'pilot' | 'staging' | 'prod'
export type UeDeploymentType = 'clc-demo' | 'pilot' | 'staging' | 'prod'
export type UeFeatureProfile = 'clc' | 'executive' | 'internal'

const VALID_ENVS: ReadonlySet<UeEnvironment> = new Set([
  'local',
  'dev',
  'staging',
  'demo',
  'pilot',
  'production',
])

function readEnvVar(name: string): string {
  // Tolerate the malformed legacy form "production NEXT_PUBLIC_APP_ENV=staging"
  // by taking the first whitespace-delimited token.
  return (process.env[name] ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''
}

export function getUeEnvironment(): UeEnvironment {
  const ue = readEnvVar('UE_ENVIRONMENT')
  if (VALID_ENVS.has(ue as UeEnvironment)) return ue as UeEnvironment

  const pub = readEnvVar('NEXT_PUBLIC_APP_ENV')
  if (VALID_ENVS.has(pub as UeEnvironment)) return pub as UeEnvironment

  const node = readEnvVar('NODE_ENV')
  if (node === 'production') return 'production'
  if (node === 'development') return 'local'

  return 'local'
}

export function getNzilaMode(): NzilaMode | undefined {
  const m = readEnvVar('NZILA_MODE')
  if (m === 'demo' || m === 'pilot' || m === 'staging' || m === 'prod') return m
  return undefined
}

export function getDeploymentType(): UeDeploymentType {
  const t = readEnvVar('UE_DEPLOYMENT_TYPE')
  if (t === 'clc-demo' || t === 'pilot' || t === 'staging' || t === 'prod') return t

  // Derive from environment when not explicitly set.
  const env = getUeEnvironment()
  if (env === 'production') return 'prod'
  if (env === 'demo') return 'clc-demo'
  if (env === 'pilot') return 'pilot'
  return 'staging'
}

export function getFeatureProfile(): UeFeatureProfile {
  const p = readEnvVar('UE_FEATURE_PROFILE')
  if (p === 'clc' || p === 'executive' || p === 'internal') return p

  const env = getUeEnvironment()
  if (env === 'demo') return 'clc'
  if (env === 'production' || env === 'pilot') return 'executive'
  return 'internal'
}

export function isPilotRuntime(): boolean {
  // Pilot UX is enabled when NZILA_MODE explicitly opts in.
  // Fail-closed: undefined NZILA_MODE never enables pilot routes.
  const mode = getNzilaMode()
  return mode === 'pilot' || mode === 'demo'
}

export function isProductionEnvironment(): boolean {
  return getUeEnvironment() === 'production'
}

export type EnvironmentSnapshot = {
  environment: UeEnvironment
  nzilaMode: NzilaMode | undefined
  deploymentType: UeDeploymentType
  featureProfile: UeFeatureProfile
  isPilotRuntime: boolean
  isProduction: boolean
}

export function getEnvironmentSnapshot(): EnvironmentSnapshot {
  return {
    environment: getUeEnvironment(),
    nzilaMode: getNzilaMode(),
    deploymentType: getDeploymentType(),
    featureProfile: getFeatureProfile(),
    isPilotRuntime: isPilotRuntime(),
    isProduction: isProductionEnvironment(),
  }
}
