/**
 * Retention governance layer.
 *
 * Maps telemetry categories and sensitivity tiers to retention classes.
 * This is a **metadata-only** layer — it classifies events for future
 * retention enforcement but does NOT delete or archive anything in Wave 8.
 *
 * Retention classes are governance metadata that travel with each
 * `GovernanceObservabilityEvent` and appear in the evidence ledger.
 *
 * @module lib/governance-observability/retention
 */

import type { TelemetryCategory, TelemetrySensitivity } from './types';

// ── Retention class ───────────────────────────────────────────────────────────

/**
 * Retention class for a governance telemetry event.
 *
 * - `ephemeral`    — not retained beyond the current deployment window
 * - `standard`     — standard operational log retention (typically 90 days)
 * - `governance`   — governance-grade retention (typically 2 years)
 * - `legal-hold`   — indefinite hold pending legal resolution
 * - `permanent`    — permanent organizational record (e.g. constitutional votes)
 */
export type RetentionClass =
  | 'ephemeral'
  | 'standard'
  | 'governance'
  | 'legal-hold'
  | 'permanent';

// ── Category → retention mapping ──────────────────────────────────────────────

/**
 * Map a telemetry category to its baseline retention class.
 *
 * These are conservative defaults. Sensitivity-based overrides may elevate
 * the retention class via `resolveRetentionClass()`.
 */
export function mapCategoryToRetention(
  category: TelemetryCategory,
): RetentionClass {
  const map: Record<TelemetryCategory, RetentionClass> = {
    auth: 'standard',
    governance: 'governance',
    'ai-operation': 'governance',
    publication: 'governance',
    'member-action': 'governance',
    export: 'governance',
    audit: 'governance',
    federation: 'governance',
    security: 'legal-hold',
  };
  return map[category];
}

// ── Sensitivity → retention mapping ───────────────────────────────────────────

/**
 * Map a telemetry sensitivity tier to its minimum required retention class.
 */
export function mapSensitivityToRetention(
  sensitivity: TelemetrySensitivity,
): RetentionClass {
  const map: Record<TelemetrySensitivity, RetentionClass> = {
    public: 'ephemeral',
    internal: 'standard',
    confidential: 'governance',
    restricted: 'legal-hold',
    regulated: 'legal-hold',
  };
  return map[sensitivity];
}

// ── Retention class ranking ───────────────────────────────────────────────────

const RETENTION_RANK: Record<RetentionClass, number> = {
  ephemeral: 0,
  standard: 1,
  governance: 2,
  'legal-hold': 3,
  permanent: 4,
};

/**
 * Return the more restrictive (higher-rank) of two retention classes.
 */
export function mostRestrictiveRetention(
  a: RetentionClass,
  b: RetentionClass,
): RetentionClass {
  return RETENTION_RANK[a] >= RETENTION_RANK[b] ? a : b;
}

/**
 * Resolve the effective retention class for an event given its category
 * and sensitivity. Returns the most restrictive of the two mappings.
 */
export function resolveRetentionClass(
  category: TelemetryCategory,
  sensitivity: TelemetrySensitivity,
): RetentionClass {
  const fromCategory = mapCategoryToRetention(category);
  const fromSensitivity = mapSensitivityToRetention(sensitivity);
  return mostRestrictiveRetention(fromCategory, fromSensitivity);
}
