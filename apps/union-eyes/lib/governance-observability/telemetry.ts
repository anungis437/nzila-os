/**
 * Governed telemetry adapter functions.
 *
 * These are the public API of the governance-observability layer.
 * All functions are:
 *   - async (never block)
 *   - fail-safe (never throw to caller)
 *   - fire-and-forget
 *
 * They classify the event, create correlation metadata, resolve the
 * retention class, and write to the in-process ledger.
 *
 * USAGE:
 *   import { recordGovernedTelemetry } from '@/lib/governance-observability/telemetry';
 *
 *   // Fire-and-forget — no await needed
 *   void recordGovernedTelemetry({ ... });
 *
 * @module lib/governance-observability/telemetry
 */

import type {
  GovernanceCorrelationContext,
  GovernanceObservabilityEvent,
  AIGovernanceTrace,
  FederationGovernanceTrace,
  TelemetryCategory,
  TelemetrySensitivity,
} from './types';
import type { GovernanceSensitivity } from '../governance-policy/types';
import type { AIActionRisk } from '../governance-policy/types';
import type { FederationTier } from '../governance-policy/types';
import { classifyRoute, classifyAIAction, classifyPublicationEvent, governanceSensitivityToTelemetry } from './classification';
import { createCorrelationContext } from './correlation';
import { resolveRetentionClass } from './retention';
import { recordObservabilityEvent } from './ledger';

// ── ID generation ─────────────────────────────────────────────────────────────

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `gevt_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `gevt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── Base event builder ────────────────────────────────────────────────────────

function buildEvent(
  operationId: string,
  category: TelemetryCategory,
  sensitivity: TelemetrySensitivity,
  correlation: GovernanceCorrelationContext,
  opts?: {
    contractId?: string;
    metadata?: Record<string, unknown>;
    governanceMode?: 'shadow' | 'enforce';
  },
): GovernanceObservabilityEvent {
  return {
    eventId: generateEventId(),
    category,
    sensitivity,
    operationId,
    correlation,
    timestamp: new Date().toISOString(),
    retentionClass: resolveRetentionClass(category, sensitivity),
    contractId: opts?.contractId,
    governanceMode: opts?.governanceMode ?? 'shadow',
    metadata: opts?.metadata,
  };
}

// ── Adapter functions ─────────────────────────────────────────────────────────

/**
 * Record a general governed telemetry event.
 *
 * @param opts.operationId  Stable operation identifier
 * @param opts.category     Telemetry category
 * @param opts.sensitivity  Governance sensitivity (policy-derived)
 * @param opts.correlation  Correlation context (pass from request context when available)
 */
export async function recordGovernedTelemetry(opts: {
  operationId: string;
  category: TelemetryCategory;
  sensitivity?: TelemetrySensitivity;
  governanceSensitivity?: GovernanceSensitivity;
  correlation?: GovernanceCorrelationContext;
  contractId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sensitivity: TelemetrySensitivity =
      opts.sensitivity ??
      (opts.governanceSensitivity
        ? governanceSensitivityToTelemetry(opts.governanceSensitivity)
        : 'internal');

    const correlation = opts.correlation ?? createCorrelationContext();

    const event = buildEvent(
      opts.operationId,
      opts.category,
      sensitivity,
      correlation,
      { contractId: opts.contractId, metadata: opts.metadata },
    );

    recordObservabilityEvent(event);
  } catch {
    // fail-safe
  }
}

/**
 * Record a governance policy decision event (evaluation result).
 */
export async function recordGovernanceDecision(opts: {
  operationId: string;
  contractId: string;
  allowed: boolean;
  unmetRequirements: string[];
  governanceSensitivity: GovernanceSensitivity;
  correlation?: GovernanceCorrelationContext;
}): Promise<void> {
  try {
    const correlation = opts.correlation ?? createCorrelationContext();
    const sensitivity = governanceSensitivityToTelemetry(opts.governanceSensitivity);

    const event = buildEvent(
      opts.operationId,
      'governance',
      sensitivity,
      correlation,
      {
        contractId: opts.contractId,
        metadata: {
          allowed: opts.allowed,
          unmetRequirements: opts.unmetRequirements,
        },
      },
    );

    recordObservabilityEvent(event);
  } catch {
    // fail-safe
  }
}

/**
 * Record an AI action telemetry event with governance trace.
 */
export async function recordAIActionTrace(opts: {
  operationId: string;
  risk: AIActionRisk;
  humanReviewTriggered: boolean;
  sensitiveOperationEscalated?: boolean;
  publicOutput?: boolean;
  memberDataAccessed?: boolean;
  correlation?: GovernanceCorrelationContext;
}): Promise<void> {
  try {
    const { sensitivity, category } = classifyAIAction(opts.risk);
    const correlation = opts.correlation ?? createCorrelationContext();

    const trace: AIGovernanceTrace = {
      aiOperationId: opts.operationId,
      risk: opts.risk,
      humanReviewTriggered: opts.humanReviewTriggered,
      sensitiveOperationEscalated: opts.sensitiveOperationEscalated ?? false,
      publicOutput: opts.publicOutput ?? false,
      memberDataAccessed: opts.memberDataAccessed ?? false,
    };

    const event = buildEvent(opts.operationId, category, sensitivity, correlation, {
      contractId: opts.risk === 'sensitive' || opts.risk === 'restricted'
        ? 'ai-operation.sensitive'
        : 'ai-operation.assistive',
      metadata: { aiTrace: trace },
    });

    recordObservabilityEvent(event);
  } catch {
    // fail-safe
  }
}

/**
 * Record a federation governance event.
 */
export async function recordFederationEvent(opts: {
  orgId: string;
  parentOrgId?: string;
  tier: FederationTier;
  contractId: string;
  operationId: string;
  overrideRejected?: boolean;
  escalatedToParent?: boolean;
  publicationDenied?: boolean;
  correlation?: GovernanceCorrelationContext;
}): Promise<void> {
  try {
    const correlation = opts.correlation ?? createCorrelationContext({ orgId: opts.orgId });
    const sensitivity: TelemetrySensitivity =
      opts.publicationDenied || opts.overrideRejected ? 'restricted' : 'confidential';

    const trace: FederationGovernanceTrace = {
      orgId: opts.orgId,
      parentOrgId: opts.parentOrgId,
      tier: opts.tier,
      contractId: opts.contractId,
      overrideRejected: opts.overrideRejected ?? false,
      escalatedToParent: opts.escalatedToParent ?? false,
      publicationDenied: opts.publicationDenied ?? false,
    };

    const event = buildEvent(
      opts.operationId,
      'federation',
      sensitivity,
      correlation,
      { contractId: opts.contractId, metadata: { federationTrace: trace } },
    );

    recordObservabilityEvent(event);
  } catch {
    // fail-safe
  }
}

/**
 * Record a route-level governed telemetry event.
 * Convenience wrapper around `recordGovernedTelemetry` that auto-classifies
 * the route path.
 */
export async function recordRouteTelemetry(opts: {
  routePath: string;
  correlation?: GovernanceCorrelationContext;
  contractId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { sensitivity, category } = classifyRoute(opts.routePath);
    const correlation = opts.correlation ?? createCorrelationContext();

    const event = buildEvent(
      opts.routePath,
      category,
      sensitivity,
      correlation,
      { contractId: opts.contractId, metadata: opts.metadata },
    );

    recordObservabilityEvent(event);
  } catch {
    // fail-safe
  }
}

/**
 * Record a public-experience publication event.
 */
export async function recordPublicationEvent(opts: {
  surfaceId: string;
  isPublic: boolean;
  isFederation: boolean;
  targetStatus: string;
  actorId: string;
  allowed: boolean;
  correlation?: GovernanceCorrelationContext;
}): Promise<void> {
  try {
    const { sensitivity, category } = classifyPublicationEvent({
      isPublic: opts.isPublic,
      isFederation: opts.isFederation,
    });
    const correlation =
      opts.correlation ?? createCorrelationContext({ actorId: opts.actorId });

    const contractId = opts.isFederation
      ? 'public-experience.federation'
      : 'public-experience.surface';

    const event = buildEvent(
      `publication.${opts.surfaceId}`,
      category,
      sensitivity,
      correlation,
      {
        contractId,
        metadata: {
          targetStatus: opts.targetStatus,
          actorId: opts.actorId,
          allowed: opts.allowed,
        },
      },
    );

    recordObservabilityEvent(event);
  } catch {
    // fail-safe
  }
}
