/**
 * ARTIFACT TYPE: Runtime Reporting
 * MODULE: OCI Runtime Continuity Reporting
 * DOCTRINE_VERSION: 1.0.0
 *
 * Composes a runtime continuity narrative suitable for an optional appendix
 * to an executive reading. The narrative is reviewer-led, refusal-first, and
 * statement-led. No charts. No scores. No rankings. No automation.
 *
 * The narrative is intentionally not wired into the icra-pdf engine at this
 * layer; the report mapper may choose to consume `composeRuntimeContinuityNarrative`
 * under reviewer-led configuration.
 */

import type { LedgerSummary } from '../ledger/continuityLedgerReader';
import type { MemoryReadingSummary } from '../governance-memory/governanceMemoryRuntime';
import type { OnboardingSurvivabilityReading } from '../onboarding/onboardingRuntime';
import type { SuccessorStewardshipReading } from '../onboarding/successorStewardshipRuntime';
import type { StewardshipConcentrationReading } from '../stewardship/runtimeStewardshipEngine';
import type { TraceabilityReading } from '../traceability/runtimeGovernanceTraceability';
import type { RuntimeReadinessReading } from '../readiness/runtimeReadinessEngine';

export const RUNTIME_CONTINUITY_REPORTING_VERSION = '1.0.0' as const;

export interface RuntimeContinuityReportingInput {
  readonly institutionScope: string;
  readonly memory: MemoryReadingSummary;
  readonly ledger: LedgerSummary;
  readonly onboarding: OnboardingSurvivabilityReading;
  readonly successor: SuccessorStewardshipReading;
  readonly stewardship: StewardshipConcentrationReading;
  readonly traceability: TraceabilityReading;
  readonly readiness: RuntimeReadinessReading;
}

export interface RuntimeContinuityNarrative {
  readonly engineVersion: typeof RUNTIME_CONTINUITY_REPORTING_VERSION;
  readonly institutionScope: string;
  readonly paragraphs: readonly string[];
  readonly readableForExecutive: boolean;
}

export function composeRuntimeContinuityNarrative(
  input: RuntimeContinuityReportingInput,
): RuntimeContinuityNarrative {
  const paragraphs: string[] = [];

  paragraphs.push(
    `This appendix reports the runtime continuity reading for the institution scope ${input.institutionScope}. The reading is reviewer-led; it does not interpret on the institution's behalf.`,
  );

  paragraphs.push(input.memory.statement);
  paragraphs.push(input.ledger.statement);
  paragraphs.push(input.onboarding.statement);
  paragraphs.push(input.successor.statement);
  paragraphs.push(input.stewardship.statement);
  paragraphs.push(input.traceability.statement);
  paragraphs.push(input.readiness.statement);

  paragraphs.push(
    'The runtime makes no recommendation. Where a reading is not yet readable, the institution may choose to record additional reviewer-led rationale before the next executive reading.',
  );

  const readableForExecutive =
    input.readiness.overall !== 'not_yet_readable' || input.ledger.totalEntries > 0;

  return {
    engineVersion: RUNTIME_CONTINUITY_REPORTING_VERSION,
    institutionScope: input.institutionScope,
    paragraphs,
    readableForExecutive,
  };
}
