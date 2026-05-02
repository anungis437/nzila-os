import { getSecret } from '@nzila/os-core/secrets'

const SIGNING_SECRET_ENV = 'NAR_SIGNING_SECRET'

export async function getNarSigningSecret(): Promise<string> {
  const envSecret = process.env[SIGNING_SECRET_ENV]
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret
  }

  if (process.env.NODE_ENV === 'test') {
    return 'nar-test-signing-secret'
  }

  if (process.env.NODE_ENV === 'production' && process.env.KEY_VAULT_URI) {
    // Production hook: this resolves through os-core's Key Vault integration when available.
    const secret = await getSecret('nar-signing-secret')
    if (secret.value.trim().length > 0) {
      return secret.value
    }
  }

  throw new Error(
    'Missing NAR signing secret. Set NAR_SIGNING_SECRET (or configure nar-signing-secret in Key Vault for production).',
  )
}
