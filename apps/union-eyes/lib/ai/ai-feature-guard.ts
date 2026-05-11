/**
 * Governance Intelligence Feature Guard
 *
 * Wraps every institutional intelligence endpoint with:
 * 1. Feature flag check  → 403 if disabled
 * 2. Audit event         → logs all intelligence invocations
 * 3. Fallback response   → structured "unavailable" payload
 *
 * @module lib/ai/ai-feature-guard
 */

import { NextResponse } from 'next/server';
import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/services/feature-flags';
import { auditLog, AuditSeverity } from '@/lib/audit-logger';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { logger } from '@/lib/logger';

/** Minimal AI response when the feature is disabled or unavailable. */
export interface AiFallbackResponse {
  available: false;
  reason: string;
  fallbackAdvice: string;
}

/**
 * Standard shape every AI endpoint must return alongside its payload.
 * Ensures explainability + confidence are always present.
 */
export interface AiResponseEnvelope<T = unknown> {
  available: true;
  data: T;
  confidence: number;          // 0-1
  explanation: string;         // human-readable
  modelVersion: string;
  disclaimer: string;
  auditRef: string;            // trace id for the audit log entry
}

const AI_DISCLAIMER =
  'This output is produced by bounded institutional intelligence. It is interpretive and advisory only — ' +
  'it does not constitute a binding decision, legal opinion, or operational directive. ' +
  'A human steward or administrator must review and confirm any action before it takes effect.';

/**
 * Check whether an AI feature is enabled for the given org context.
 * Returns a NextResponse with 403 if disabled, or null if the feature is available.
 */
export async function guardAiFeature(
  featureFlagName: string,
  context: FeatureFlagContext,
): Promise<NextResponse<AiFallbackResponse> | null> {
  try {
    const enabled = await isFeatureEnabled(featureFlagName, context);

    if (!enabled) {
      logger.info('AI feature disabled', { feature: featureFlagName, org: context.organizationId });
      return NextResponse.json<AiFallbackResponse>(
        {
          available: false,
          reason: `AI feature '${featureFlagName}' is not enabled for this organization.`,
          fallbackAdvice: 'Contact your administrator to enable this capability.',
        },
        { status: 403 },
      );
    }

    return null; // feature is available — proceed
  } catch (error) {
    logger.error('AI feature guard error', { error, feature: featureFlagName });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Unable to evaluate AI feature availability.',
    ) as unknown as NextResponse<AiFallbackResponse>;
  }
}

/**
 * Emit an audit event for an AI interaction.
 *
 * @returns The auditRef (trace id) to include in the response envelope.
 */
export async function auditAiInteraction(params: {
  featureName: string;
  userId?: string;
  organizationId?: string;
  resource: string;
  resourceId?: string;
  action: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  confidence?: number;
  modelVersion?: string;
}): Promise<string> {
  const auditRef = `ai-${params.featureName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await auditLog({
    eventType: `ai.${params.featureName}`,
    severity: AuditSeverity.LOW,
    userId: params.userId,
    organizationId: params.organizationId,
    resource: params.resource,
    resourceId: params.resourceId,
    action: params.action,
    outcome: 'success',
    details: {
      auditRef,
      confidence: params.confidence,
      modelVersion: params.modelVersion,
      // Never log raw input/output to audit — only summaries
      inputKeys: params.input ? Object.keys(params.input) : [],
      outputKeys: params.output ? Object.keys(params.output) : [],
    },
  });

  return auditRef;
}

/**
 * Build a complete AI response envelope with mandatory explainability fields.
 */
export function buildAiEnvelope<T>(
  data: T,
  meta: {
    confidence: number;
    explanation: string;
    modelVersion: string;
    auditRef: string;
  },
): AiResponseEnvelope<T> {
  return {
    available: true,
    data,
    confidence: meta.confidence,
    explanation: meta.explanation,
    modelVersion: meta.modelVersion,
    disclaimer: AI_DISCLAIMER,
    auditRef: meta.auditRef,
  };
}
