export type DeployEnvironment = 'development' | 'staging' | 'pilot' | 'production'

export type DeployAppConfig = {
  releaseStatus: 'prod-approved' | 'staging-only' | 'internal-only' | 'frozen' | 'incubating' | 'blocked'
  prodPromotionEligible?: boolean
  requiresExplicitProdOverride?: boolean
}

export const GITOPS_DEPLOYABLE_APPS = new Set([
  'web',
  'console',
  'partners',
  'orchestrator-api',
  'cfo',
  'zonga',
  'abr',
  'flow',
  'agrimo',
  'cora',
  'trade',
  'mobility',
  'mobility-client-portal',
  'control-plane',
  'platform-admin',
  'nacp-exams',
])

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export function appsFromChangedFiles(files: string[]): string[] {
  return unique(files.flatMap((file) => {
    const match = file.replaceAll('\\', '/').match(/^apps\/([^/]+)\//)
    if (!match || !GITOPS_DEPLOYABLE_APPS.has(match[1]) || match[1] === 'union-eyes') return []
    return [match[1]]
  }))
}

export function eligibleForEnv(
  app: string,
  env: DeployEnvironment,
  cfg: DeployAppConfig,
  zongaOverride: boolean,
  explicitSelection: boolean,
): boolean {
  if (env === 'development') {
    if (cfg.releaseStatus === 'incubating') return explicitSelection
    return cfg.releaseStatus !== 'frozen' && cfg.releaseStatus !== 'blocked'
  }

  if (env === 'staging') {
    if (cfg.releaseStatus === 'incubating') return explicitSelection
    return cfg.releaseStatus === 'prod-approved' || cfg.releaseStatus === 'staging-only' || cfg.releaseStatus === 'internal-only'
  }

  if (env === 'pilot') {
    return app === 'union-eyes' && (
      cfg.releaseStatus === 'prod-approved'
      || cfg.releaseStatus === 'staging-only'
      || cfg.releaseStatus === 'internal-only'
      || cfg.releaseStatus === 'incubating'
    )
  }

  if (app === 'zonga') return zongaOverride

  return cfg.prodPromotionEligible === true || cfg.releaseStatus === 'prod-approved'
}
