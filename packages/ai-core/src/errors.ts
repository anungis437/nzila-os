/**
 * @nzila/ai-core — Standard error taxonomy
 *
 * All AI Control Plane errors use AiControlPlaneError with a typed
 * AiErrorCode. This module provides helper factories and ensures
 * consistent error reporting across the gateway, actions, and SDK.
 */
import { AiControlPlaneError } from './types'
import type { AiErrorCode } from './types'

// ── Error factories ─────────────────────────────────────────────────────────

export function profileNotFound(profileKey: string, appKey: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'profile_not_found',
    `Capability profile not found: ${appKey}/${profileKey}`,
    404,
  )
}

export function profileDisabled(profileKey: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'profile_disabled',
    `Capability profile is disabled: ${profileKey}`,
    403,
  )
}

export function featureNotAllowed(feature: string, profileKey: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'feature_not_allowed',
    `Feature "${feature}" not allowed for profile ${profileKey}`,
    403,
  )
}

export function modalityNotAllowed(modality: string, profileKey: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'modality_not_allowed',
    `Modality "${modality}" not allowed for profile ${profileKey}`,
    403,
  )
}

export function dataClassNotAllowed(dataClass: string, profileKey: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'data_class_not_allowed',
    `Data class "${dataClass}" not allowed for profile ${profileKey}`,
    403,
  )
}

export function streamingNotAllowed(profileKey: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'streaming_not_allowed',
    `Streaming not allowed for profile ${profileKey}`,
    403,
  )
}

export function budgetExceeded(appKey: string, profileKey: string, month: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'budget_exceeded',
    `AI budget exceeded for ${appKey}/${profileKey} in ${month}`,
    429,
  )
}

export function policyDenied(reason: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'policy_denied',
    `Policy denied: ${reason}`,
    403,
  )
}

export function schemaInvalid(message: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'schema_invalid',
    `Schema validation failed: ${message}`,
    400,
  )
}

export function providerError(message: string): AiControlPlaneError {
  return new AiControlPlaneError(
    'provider_error',
    message,
    502,
  )
}

export function rateLimited(): AiControlPlaneError {
  return new AiControlPlaneError(
    'rate_limited',
    'Too many requests — rate limit exceeded',
    429,
  )
}

// ── Error classification helpers ────────────────────────────────────────────

export function isRetryable(err: unknown): boolean {
  if (err instanceof AiControlPlaneError) {
    return err.code === 'rate_limited' || err.code === 'provider_error'
  }
  return false
}

export function isPolicyError(err: unknown): boolean {
  if (err instanceof AiControlPlaneError) {
    const policyCodes: AiErrorCode[] = [
      'feature_not_allowed',
      'modality_not_allowed',
      'data_class_not_allowed',
      'streaming_not_allowed',
      'budget_exceeded',
      'policy_denied',
      'profile_not_found',
      'profile_disabled',
    ]
    return policyCodes.includes(err.code)
  }
  return false
}

export function toErrorResponse(err: unknown): {
  code: AiErrorCode
  message: string
  statusCode: number
} {
  if (err instanceof AiControlPlaneError) {
    return {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    }
  }
  return {
    code: 'unknown',
    message: err instanceof Error ? err.message : 'Unknown error',
    statusCode: 500,
  }
}
