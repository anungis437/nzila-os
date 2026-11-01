import { ApiError } from '@/lib/api/errors'

export const SSO_PROVIDER_TYPES = ['saml', 'oidc'] as const

const text = (value: unknown, field: string, max: number, required: boolean): string | undefined => {
  if (value === undefined || value === null || value === '') {
    if (required) throw ApiError.badRequest(`${field} is required to enable this provider`)
    return undefined
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw ApiError.badRequest(`${field} must be text of at most ${max} characters`)
  }
  return value.trim()
}

const httpsUrl = (value: unknown, field: string, required: boolean): string | undefined => {
  const raw = text(value, field, 2048, required)
  if (raw === undefined) return undefined
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw ApiError.badRequest(`${field} must be a valid URL`)
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw ApiError.badRequest(`${field} must be an https URL without credentials`)
  }
  return parsed.toString()
}

export interface ValidatedSsoProvider {
  name: string
  providerType: (typeof SSO_PROVIDER_TYPES)[number]
  samlEntityId?: string
  samlSsoUrl?: string
  samlCertificate?: string
  oidcIssuer?: string
  oidcClientId?: string
  oidcClientSecret?: string
}

/**
 * An identity-provider configuration decides who may sign in, so its shape is checked before it is stored: a known type,
 * endpoints that are https URLs, and bounded text. A provider that is to be enabled must also carry every field its type
 * needs; a draft (not enabled) may be incomplete.
 */
export function validateSsoProviderInput(input: Record<string, unknown>, enabling: boolean): ValidatedSsoProvider {
  const name = text(input.name, 'name', 200, true)!
  const providerType = input.providerType
  if (typeof providerType !== 'string' || !(SSO_PROVIDER_TYPES as readonly string[]).includes(providerType)) {
    throw ApiError.badRequest(`providerType must be one of ${SSO_PROVIDER_TYPES.join(', ')}`)
  }
  if (providerType === 'saml') {
    return {
      name,
      providerType,
      samlEntityId: text(input.samlEntityId, 'samlEntityId', 1024, enabling),
      samlSsoUrl: httpsUrl(input.samlSsoUrl, 'samlSsoUrl', enabling),
      samlCertificate: text(input.samlCertificate, 'samlCertificate', 20_000, enabling),
    }
  }
  return {
    name,
    providerType: 'oidc',
    oidcIssuer: httpsUrl(input.oidcIssuer, 'oidcIssuer', enabling),
    oidcClientId: text(input.oidcClientId, 'oidcClientId', 512, enabling),
    oidcClientSecret: text(input.oidcClientSecret, 'oidcClientSecret', 4096, false),
  }
}
