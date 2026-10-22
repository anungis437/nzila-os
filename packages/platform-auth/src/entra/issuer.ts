export interface EntraIssuerEnvironment {
  AZURE_AD_STAGING_SINGLE_TENANT?: string
  AZURE_AD_TENANT_ID?: string
  TARGET_ENVIRONMENT?: string
}

const COMMON_ISSUER = 'https://login.microsoftonline.com/common/v2.0'
const TENANT_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Explicit staging opt-in; existing multi-tenant applications keep /common. */
export function resolveEntraIssuer(env: EntraIssuerEnvironment): string {
  const optIn = env.AZURE_AD_STAGING_SINGLE_TENANT
  if (optIn === undefined || optIn === '' || optIn === 'false') return COMMON_ISSUER
  if (optIn !== 'true') {
    throw new Error('AZURE_AD_STAGING_SINGLE_TENANT must be true or false')
  }
  if (env.TARGET_ENVIRONMENT !== 'staging') {
    throw new Error('Single-tenant staging issuer requires TARGET_ENVIRONMENT=staging')
  }
  const tenantId = env.AZURE_AD_TENANT_ID
  if (!tenantId || tenantId.length !== 36 || !TENANT_GUID.test(tenantId) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(tenantId)) {
    throw new Error('Single-tenant staging issuer requires a nonzero AZURE_AD_TENANT_ID GUID')
  }
  return `https://login.microsoftonline.com/${tenantId.toLowerCase()}/v2.0`
}
