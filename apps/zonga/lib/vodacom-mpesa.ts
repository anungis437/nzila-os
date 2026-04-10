/**
 * Zonga — Vodacom M-Pesa Provider Wiring
 *
 * Feature-gated provider initialization for Vodacom M-Pesa.
 * Reads config from environment variables and returns a configured adapter
 * or null when disabled/unconfigured.
 *
 * Env vars:
 *   ZONGA_ENABLE_VODACOM_MPESA  — "true" to enable (default: disabled)
 *   VODACOM_MPESA_API_KEY       — API key from OpenAPI portal
 *   VODACOM_MPESA_PUBLIC_KEY    — RSA public key (PEM, base64, or raw)
 *   VODACOM_MPESA_BASE_URL      — Gateway URL (defaults to sandbox)
 *   VODACOM_MPESA_SP_CODE       — Service provider short code
 *   VODACOM_MPESA_MARKET        — Market code: TZ | MZ | LS | CD (default: TZ)
 *   VODACOM_MPESA_CALLBACK_URL  — Callback URL for async notifications
 */

import {
  createVodacomMpesaAdapter,
  type VodacomMpesaConfig,
  type PaymentProviderAdapter,
} from '@nzila/zonga-payments'
import { logger } from '@/lib/logger'

const SANDBOX_URL = 'https://openapi.m-pesa.com/sandbox'
const PRODUCTION_URL = 'https://openapi.m-pesa.com'

/**
 * Check if Vodacom M-Pesa is enabled via feature flag.
 */
export function isVodacomMpesaEnabled(): boolean {
  return process.env.ZONGA_ENABLE_VODACOM_MPESA === 'true'
}

/**
 * Load Vodacom M-Pesa config from environment.
 * Returns null if the feature flag is disabled or required vars are missing.
 */
export function loadVodacomMpesaConfig(): VodacomMpesaConfig | null {
  if (!isVodacomMpesaEnabled()) {
    return null
  }

  const apiKey = process.env.VODACOM_MPESA_API_KEY
  const publicKey = process.env.VODACOM_MPESA_PUBLIC_KEY
  const serviceProviderCode = process.env.VODACOM_MPESA_SP_CODE

  if (!apiKey || !publicKey || !serviceProviderCode) {
    logger.warn('Vodacom M-Pesa enabled but missing required env vars', {
      hasApiKey: !!apiKey,
      hasPublicKey: !!publicKey,
      hasSpCode: !!serviceProviderCode,
    })
    return null
  }

  const market = (process.env.VODACOM_MPESA_MARKET ?? 'TZ') as VodacomMpesaConfig['market']
  const baseUrl = process.env.VODACOM_MPESA_BASE_URL
    ?? (process.env.NODE_ENV === 'production' ? PRODUCTION_URL : SANDBOX_URL)

  return {
    baseUrl,
    apiKey,
    publicKey,
    serviceProviderCode,
    market,
    callbackUrl: process.env.VODACOM_MPESA_CALLBACK_URL,
  }
}

/**
 * Create the Vodacom M-Pesa adapter if enabled and configured.
 * Returns null if disabled or config is incomplete.
 */
export function getVodacomMpesaAdapter(): PaymentProviderAdapter | null {
  const config = loadVodacomMpesaConfig()
  if (!config) {
    return null
  }

  try {
    const adapter = createVodacomMpesaAdapter(config)
    logger.info('Vodacom M-Pesa adapter initialized', { market: config.market })
    return adapter
  } catch (err) {
    logger.error('Failed to initialize Vodacom M-Pesa adapter', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
