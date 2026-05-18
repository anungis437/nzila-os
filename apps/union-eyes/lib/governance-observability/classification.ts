/**
 * Telemetry classification engine.
 *
 * Determines the sensitivity tier and category of a telemetry event
 * based on the operation type, route characteristics, or AI action risk.
 *
 * This module is pure (no side effects) and safe for use in CI, tests,
 * and runtime without any I/O dependencies.
 *
 * @module lib/governance-observability/classification
 */

import type { TelemetrySensitivity, TelemetryCategory } from './types';
import type { GovernanceSensitivity } from '../governance-policy/types';
import type { AIActionRisk } from '../governance-policy/types';

// ── Classification result ─────────────────────────────────────────────────────

export interface TelemetryClassification {
  sensitivity: TelemetrySensitivity;
  category: TelemetryCategory;
}

// ── Sensitivity mapping ───────────────────────────────────────────────────────

/**
 * Map a governance policy sensitivity to a telemetry sensitivity tier.
 */
export function governanceSensitivityToTelemetry(
  gs: GovernanceSensitivity,
): TelemetrySensitivity {
  const map: Record<GovernanceSensitivity, TelemetrySensitivity> = {
    low: 'internal',
    moderate: 'internal',
    high: 'confidential',
    critical: 'restricted',
  };
  return map[gs];
}

/**
 * Map an AI action risk tier to a telemetry sensitivity tier.
 */
export function aiRiskToTelemetrySensitivity(
  risk: AIActionRisk,
): TelemetrySensitivity {
  const map: Record<AIActionRisk, TelemetrySensitivity> = {
    assistive: 'internal',
    advisory: 'internal',
    sensitive: 'confidential',
    restricted: 'restricted',
  };
  return map[risk];
}

// ── Route classification ──────────────────────────────────────────────────────

const SECURITY_ROUTE_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/admin\//,
  /\/api\/system\//,
];

const MEMBER_ROUTE_PATTERNS = [
  /\/api\/members\//,
  /\/api\/dues\//,
  /\/api\/grievances?\//,
  /\/api\/cases?\//,
];

const EXPORT_ROUTE_PATTERNS = [/\/api\/export\//];
const FEDERATION_ROUTE_PATTERNS = [/\/api\/federation\//];

/**
 * Classify a route path into a telemetry category and sensitivity.
 *
 * Used by `withApi` and the governance observability adapter to classify
 * route-level telemetry without per-route annotations.
 */
export function classifyRoute(routePath: string): TelemetryClassification {
  if (SECURITY_ROUTE_PATTERNS.some((p) => p.test(routePath))) {
    return { sensitivity: 'confidential', category: 'auth' };
  }
  if (MEMBER_ROUTE_PATTERNS.some((p) => p.test(routePath))) {
    return { sensitivity: 'confidential', category: 'member-action' };
  }
  if (EXPORT_ROUTE_PATTERNS.some((p) => p.test(routePath))) {
    return { sensitivity: 'restricted', category: 'export' };
  }
  if (FEDERATION_ROUTE_PATTERNS.some((p) => p.test(routePath))) {
    return { sensitivity: 'confidential', category: 'federation' };
  }
  return { sensitivity: 'internal', category: 'governance' };
}

/**
 * Classify an AI action into a telemetry category and sensitivity.
 */
export function classifyAIAction(risk: AIActionRisk): TelemetryClassification {
  return {
    sensitivity: aiRiskToTelemetrySensitivity(risk),
    category: 'ai-operation',
  };
}

/**
 * Classify a public-experience publication event.
 */
export function classifyPublicationEvent(opts: {
  isPublic: boolean;
  isFederation: boolean;
}): TelemetryClassification {
  if (opts.isFederation) {
    return { sensitivity: 'restricted', category: 'federation' };
  }
  if (opts.isPublic) {
    return { sensitivity: 'confidential', category: 'publication' };
  }
  return { sensitivity: 'internal', category: 'publication' };
}

/**
 * General-purpose classification from a governance sensitivity + category hint.
 */
export function classifyTelemetry(
  gs: GovernanceSensitivity,
  category: TelemetryCategory,
): TelemetryClassification {
  return {
    sensitivity: governanceSensitivityToTelemetry(gs),
    category,
  };
}
