/**
 * @nzila/os-core — Azure Key Vault Secrets Client
 *
 * Provides a unified `getSecret(name)` interface:
 *   - In production: fetches from Azure Key Vault (KEY_VAULT_URI env var)
 *   - In development/test: falls back to process.env (kebab-case → UPPER_SNAKE_CASE)
 *
 * Secrets are cached for 5 minutes to reduce Key Vault API calls.
 */

export interface SecretValue {
  value: string
  expiresOn?: Date
  version?: string
}

interface CacheEntry {
  value: SecretValue
  fetchedAt: number
}

const SECRET_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function envFallback(name: string): string | undefined {
  // kebab-case-secret-name → KEBAB_CASE_SECRET_NAME
  const envKey = name.toUpperCase().replace(/-/g, '_')
  return process.env[envKey]
}

/**
 * Retrieve a secret by name.
 * Throws if the secret is not found and no env fallback exists.
 */
export async function getSecret(name: string): Promise<SecretValue> {
  // Cache hit
  const cached = SECRET_CACHE.get(name)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value
  }

  const vaultUri = process.env.KEY_VAULT_URI

  if (vaultUri && process.env.NODE_ENV === 'production') {
    return fetchFromKeyVault(vaultUri, name)
  }

  // Development / test fallback to environment variables
  const envValue = envFallback(name)
  if (envValue !== undefined) {
    const secret: SecretValue = { value: envValue }
    SECRET_CACHE.set(name, { value: secret, fetchedAt: Date.now() })
    return secret
  }

  throw new Error(
    `Secret "${name}" not found. ` +
      `Set KEY_VAULT_URI for production or ${name.toUpperCase().replace(/-/g, '_')} env var for development.`,
  )
}

async function fetchFromKeyVault(vaultUri: string, name: string): Promise<SecretValue> {
  // Dynamic import keeps the package optional at install time
  let SecretClient: any
  try {
    const mod = await import('@azure/keyvault-secrets')
    SecretClient = mod.SecretClient
  } catch {
    throw new Error(
      '@azure/keyvault-secrets is not installed. ' +
        'Run: pnpm add @azure/keyvault-secrets @azure/identity',
    )
  }

  const { DefaultAzureCredential } = await import('@azure/identity')
  const client = new SecretClient(vaultUri, new DefaultAzureCredential())

  const response = await client.getSecret(name)
  if (!response.value) {
    throw new Error(`Secret "${name}" exists in Key Vault but has no value.`)
  }

  const secret: SecretValue = {
    value: response.value,
    expiresOn: response.properties.expiresOn,
    version: response.properties.version,
  }

  SECRET_CACHE.set(name, { value: secret, fetchedAt: Date.now() })
  return secret
}

/** Clear the in-process secret cache (useful in tests) */
export function clearSecretCache(): void {
  SECRET_CACHE.clear()
}

/** Pre-warm a secret into the cache (for apps that pre-load secrets at startup) */
export function prewarmSecret(name: string, value: string): void {
  SECRET_CACHE.set(name, {
    value: { value },
    fetchedAt: Date.now(),
  })
}
