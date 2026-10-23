import { resolveEntraIssuer, type EntraIssuerEnvironment } from './issuer'

export interface EntraSessionEnvironment extends EntraIssuerEnvironment {
  AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS?: string
}

/** A shorter real session lifetime for the dedicated staging registration only. */
export function resolveEntraSessionMaxAge(env: EntraSessionEnvironment): number {
  const configured = env.AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS
  if (configured === undefined) return 24 * 60 * 60
  if (env.TARGET_ENVIRONMENT !== 'staging' || env.AZURE_AD_STAGING_SINGLE_TENANT !== 'true')
    throw new Error('Staging session lifetime requires the dedicated single-tenant staging registration')
  resolveEntraIssuer(env)
  const seconds = Number(configured)
  if (!/^[1-9]\d*$/.test(configured) || !Number.isSafeInteger(seconds) || seconds < 60 || seconds > 86400)
    throw new Error('AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS must be an integer from 60 through 86400')
  return seconds
}
