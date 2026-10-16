import { PlaneError } from './types'

/**
 * High-confidence credential patterns aligned with packages/secrets/src/scanner.ts.
 * This is not universal DLP and it does not open a second vault.
 * Real secrets belong in @nzila/secrets KeyVaultClient.
 */
export const HIGH_CONFIDENCE_SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'clerk-or-stripe-live-key', pattern: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: 'stripe-webhook-secret', pattern: /whsec_[A-Za-z0-9]{20,}/ },
  { name: 'database-connection-string', pattern: /postgresql:\/\/[^\s:]+:[^@\s]+@(?!localhost)/ },
  { name: 'openai-api-key', pattern: /sk-[A-Za-z0-9]{20,}/ },
  { name: 'azure-storage-key', pattern: /AccountKey=[A-Za-z0-9+/=]{30,}/ },
  { name: 'pem-private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

export interface SecretIngestionResult {
  rejected: boolean
  routeTo: '@nzila/secrets KeyVaultClient'
  patternNames: string[]
  universalDetection: false
}

export function inspectSecretIngestion(text: string): SecretIngestionResult {
  const patternNames = HIGH_CONFIDENCE_SECRET_PATTERNS.filter((entry) => entry.pattern.test(text)).map(
    (entry) => entry.name,
  )
  return {
    rejected: patternNames.length > 0,
    routeTo: '@nzila/secrets KeyVaultClient',
    patternNames,
    universalDetection: false,
  }
}

export function rejectSecretIngestion(text: string): void {
  const result = inspectSecretIngestion(text)
  if (result.rejected) {
    throw new PlaneError(
      'SECRET_INGESTION_REJECTED',
      `High-confidence credential pattern (${result.patternNames.join(', ')}) rejected. Store the value in ${result.routeTo}. This guard does not claim universal detection.`,
    )
  }
}
