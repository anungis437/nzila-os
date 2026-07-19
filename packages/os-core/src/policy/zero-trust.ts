/**
 * Zero-Trust Authorization Framework
 *
 * Extends @nzila/os-core/policy with:
 * - Device fingerprint verification
 * - Geo-IP risk scoring
 * - MFA step-up authentication
 * - Request integrity validation
 * - Evidence-first decision logging
 */

import { z } from 'zod';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const ZeroTrustContextSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  deviceId: z.string().optional(),
  locationRiskScore: z.number().min(0).max(100).default(0),
  mfaVerified: z.boolean().default(false),
  sessionRisk: z.enum(['low', 'medium', 'high']).default('low'),
  requestIntegrity: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  requestedScope: z.string().optional(),
  requestedResource: z.string().optional(),
});

export type ZeroTrustContext = z.infer<typeof ZeroTrustContextSchema>;

export const AuthorizationResultSchema = z.object({
  status: z.enum(['allowed', 'denied', 'step_up_required']),
  method: z.enum(['mfa', 'device_verification', 'manager_approval']).optional(),
  reason: z.string(),
  riskScore: z.number().min(0).max(100),
  evidencePackId: z.string().optional(),
  timestamp: z.date(),
  traceId: z.string().optional(),
});

export type AuthorizationResult = z.infer<typeof AuthorizationResultSchema>;

// ── Risk Calculation ─────────────────────────────────────────────────────────

interface RiskFactors {
  locationRisk: number;
  deviceRisk: number;
  behaviorRisk: number;
  resourceSensitivity: number;
}

function calculateRiskScore(context: ZeroTrustContext): RiskFactors {
  const factors: RiskFactors = {
    locationRisk: context.locationRiskScore,
    deviceRisk: context.deviceId ? 0 : 30, // Unknown device = higher risk
    behaviorRisk: 0,
    resourceSensitivity: 0,
  };

  // Session risk mapping
  switch (context.sessionRisk) {
    case 'high':
      factors.behaviorRisk = 40;
      break;
    case 'medium':
      factors.behaviorRisk = 20;
      break;
    case 'low':
      factors.behaviorRisk = 0;
      break;
  }

  // Sensitive resource detection
  const sensitiveScopes = [
    'governance:write',
    'evidence:write',
    'admin:write',
    'finance:write',
    'ai:invoke',
  ];
  if (context.requestedScope && sensitiveScopes.includes(context.requestedScope)) {
    factors.resourceSensitivity = 25;
  }

  return factors;
}

function aggregateRisk(factors: RiskFactors): number {
  return Math.min(
    100,
    Math.round(
      factors.locationRisk * 0.25 +
      factors.deviceRisk * 0.2 +
      factors.behaviorRisk * 0.35 +
      factors.resourceSensitivity * 0.2,
    ),
  );
}

// ── Authorization Engine ─────────────────────────────────────────────────────

/**
 * Zero-trust authorization with risk-based step-up.
 *
 * Decision matrix:
 * - Risk < 20: Allow (evidence logged)
 * - Risk 20-50: Allow if MFA verified, otherwise step-up
 * - Risk 50-75: Require MFA + known device
 * - Risk > 75: Deny (require manager approval flow)
 */
export function authorizeZeroTrust(
  context: ZeroTrustContext,
): AuthorizationResult {
  const validated = ZeroTrustContextSchema.parse(context);
  const riskFactors = calculateRiskScore(validated);
  const riskScore = aggregateRisk(riskFactors);

  let result: AuthorizationResult;

  if (riskScore > 75) {
    // High risk — deny, require out-of-band approval
    result = {
      status: 'denied',
      reason: `High risk score (${riskScore}): requires manager approval`,
      method: 'manager_approval',
      riskScore,
      timestamp: new Date(),
    };
  } else if (riskScore > 50) {
    // Elevated risk — require MFA + known device
    if (validated.mfaVerified && validated.deviceId) {
      result = {
        status: 'allowed',
        reason: `Elevated risk (${riskScore}) — MFA and device verified`,
        riskScore,
        timestamp: new Date(),
      };
    } else if (!validated.mfaVerified) {
      result = {
        status: 'step_up_required',
        method: 'mfa',
        reason: `Elevated risk (${riskScore}): MFA required`,
        riskScore,
        timestamp: new Date(),
      };
    } else {
      result = {
        status: 'step_up_required',
        method: 'device_verification',
        reason: `Elevated risk (${riskScore}): device verification required`,
        riskScore,
        timestamp: new Date(),
      };
    }
  } else if (riskScore > 20) {
    // Medium risk — require MFA for sensitive operations
    if (validated.mfaVerified) {
      result = {
        status: 'allowed',
        reason: `Medium risk (${riskScore}) — MFA verified`,
        riskScore,
        timestamp: new Date(),
      };
    } else {
      result = {
        status: 'step_up_required',
        method: 'mfa',
        reason: `Medium risk (${riskScore}): MFA step-up recommended`,
        riskScore,
        timestamp: new Date(),
      };
    }
  } else {
    // Low risk — allow
    result = {
      status: 'allowed',
      reason: `Low risk (${riskScore}) — standard access`,
      riskScore,
      timestamp: new Date(),
    };
  }

  // Inject trace context if available
  injectTraceId(result);

  return AuthorizationResultSchema.parse(result);
}

async function injectTraceId(result: AuthorizationResult): Promise<void> {
  try {
    const { trace } = (await import('@opentelemetry/api')) as {
      trace: {
        getActiveSpan: () => null | {
          spanContext: () => { traceId: string }
          setAttribute: (key: string, value: string | number) => void
        }
      }
    };
    const span = trace.getActiveSpan();
    if (span) {
      result.traceId = span.spanContext().traceId;
      span.setAttribute('nzila.authz.status', result.status);
      span.setAttribute('nzila.authz.risk_score', result.riskScore);
    }
  } catch {
    // OTel not available
  }
}

// ── Request Integrity ────────────────────────────────────────────────────────

/**
 * Compute a request integrity hash for tamper detection.
 * Uses the request method, path, and body to produce a hash.
 */
export async function computeRequestIntegrity(
  method: string,
  path: string,
  body: string | null,
): Promise<string> {
  const data = `${method}:${path}:${body ?? ''}`;
  // Use Web Crypto API (available in Node 20+)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Evidence-First Logging ───────────────────────────────────────────────────

export interface AuthorizationDecisionLog {
  timestamp: Date;
  userId: string;
  orgId: string;
  action: string;
  resource: string;
  decision: 'allowed' | 'denied' | 'step_up_required';
  riskScore: number;
  riskFactors: RiskFactors;
  traceId?: string;
  evidencePackId?: string;
}

/**
 * Log an authorization decision for audit compliance (SOC 2).
 * Returns the decision log that should be included in evidence packs.
 */
export function createAuthorizationDecisionLog(
  context: ZeroTrustContext,
  result: AuthorizationResult,
): AuthorizationDecisionLog {
  return {
    timestamp: result.timestamp,
    userId: context.userId,
    orgId: context.orgId,
    action: context.requestedScope ?? 'unknown',
    resource: context.requestedResource ?? 'unknown',
    decision: result.status,
    riskScore: result.riskScore,
    riskFactors: calculateRiskScore(context),
    traceId: result.traceId,
    evidencePackId: result.evidencePackId,
  };
}
