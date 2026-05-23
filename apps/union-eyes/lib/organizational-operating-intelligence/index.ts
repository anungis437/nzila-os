/**
 * Institutional Operating Intelligence — Unified Public Surface
 *
 * Single import surface for the application:
 *
 *   import {
 *     runFullInstitutionalCognition,
 *     runAdvancedInstitutionalCognition, // T8/T9 only
 *     runFoundationalInstitutionalCognition, // T1–T7 only
 *   } from '@/lib/organizational-operating-intelligence';
 *
 * Application code does not import individual engines. Always go through
 * one of these orchestrated entrypoints — failures are isolated, every
 * payload arrives wrapped in an `InstitutionalExplainabilityEnvelope`,
 * and labor-safety is enforced uniformly.
 */

import {
  orchestrateCognition,
  type OrchestrationResult,
} from '@nzila/institutional-cognition-core';

import {
  ADVANCED_ORCHESTRATION_STEPS,
  runInstitutionalOperatingIntelligence as runAdvanced,
} from './kernel-bridge';
import { FOUNDATIONAL_ORCHESTRATION_STEPS } from './kernel-bridge-foundational';

export {
  buildExplainabilityEnvelope,
  confidenceBandFromScore,
} from '@nzila/institutional-cognition-core';

export type {
  InstitutionalExplainabilityEnvelope,
  OrchestrationResult,
} from '@nzila/institutional-cognition-core';

/** All canonical orchestratable engines (T1–T9). */
export const ALL_ORCHESTRATION_STEPS = [
  ...FOUNDATIONAL_ORCHESTRATION_STEPS,
  ...ADVANCED_ORCHESTRATION_STEPS,
] as const;

/** T8/T9 systems dynamics + multi-domain orchestration. */
export const runAdvancedInstitutionalCognition = runAdvanced;

/** T1–T7 foundational cognition orchestration. */
export async function runFoundationalInstitutionalCognition(
  organizationId: string,
): Promise<OrchestrationResult> {
  return orchestrateCognition({
    organizationId,
    steps: FOUNDATIONAL_ORCHESTRATION_STEPS as unknown as Parameters<
      typeof orchestrateCognition
    >[0]['steps'],
  });
}

/**
 * Full T1–T9 institutional operating intelligence orchestration.
 * This is the canonical application entrypoint.
 */
export async function runFullInstitutionalCognition(
  organizationId: string,
): Promise<OrchestrationResult> {
  return orchestrateCognition({
    organizationId,
    steps: ALL_ORCHESTRATION_STEPS as unknown as Parameters<
      typeof orchestrateCognition
    >[0]['steps'],
  });
}

// Re-export individual engines for advanced use (typed callers, tests).
export * from './kernel-bridge';
export * from './kernel-bridge-foundational';
