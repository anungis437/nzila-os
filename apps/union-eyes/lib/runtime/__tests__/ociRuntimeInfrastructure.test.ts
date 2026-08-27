/**
 * Test suite for OCI Runtime Infrastructure™ (Product 4).
 *
 * Coverage:
 *   - Contract validators refuse missing fields.
 *   - Governance memory runtime: record, refusal-first read, cross-institution refusal, summary.
 *   - Continuity event runtime: ingest with validation, stable ordering, rejection signals.
 *   - Ledger runtime + reader: append-only, scope refusal, summary refusal-default.
 *   - Onboarding runtime, transfer runtime, successor stewardship runtime, scope mismatch refusal.
 *   - Workflow runtime: refused on continuity-critical with missing lineage/memory.
 *   - Workflow hooks emit ContinuityBreakpointIntroduced on refused, GovernanceRecoveryRatified on ratify.
 *   - Stewardship engine: concentration banding rules.
 *   - Dependency evolution: stabilizing / holding / regressing / not_yet_readable.
 *   - Governance traceability: traceable / partial / not_yet_traceable.
 *   - Runtime readiness: sufficient / not_yet_sufficient / not_yet_readable.
 *   - Runtime continuity reporting: composes paragraphs.
 *   - Tone discipline: no FORBIDDEN vocabulary in any statement.
 *   - Determinism: same input → same output across invocations.
 */

import { describe, it, expect } from 'vitest';

import {
  RUNTIME_CONTRACT_VERSION,
  type ContinuityEventEnvelope,
  type OnboardingSurvivabilityRecord,
  type StewardshipTransferRecord,
} from '../contracts/runtimeContracts';
import {
  validateContinuityEventEnvelope,
  validateGovernanceMemoryReference,
  validateLineageReference,
  validateOnboardingSurvivabilityRecord,
  validateRuntimeContinuitySignal,
  validateStewardshipTransferRecord,
} from '../contracts/runtimeEnvelopeValidators';

import {
  GOVERNANCE_MEMORY_ENVELOPE_VERSION,
  type RuntimeRationaleEnvelope,
} from '../governance-memory/runtimeRationaleEnvelope';
import { createInMemoryLineageStore } from '../governance-memory/governanceLineagePersistence';
import {
  readRationale,
  recordRationale,
  summarizeGovernanceMemory,
} from '../governance-memory/governanceMemoryRuntime';

import {
  composeContinuityRuntimeContext,
  isContinuityCritical,
  isContinuitySensitive,
} from '../primitives/continuityRuntimeContext';
import {
  readAnnotationCompleteness,
  readStewardshipSensitivity,
  readTraceability,
  type CriticalActionAnnotation,
} from '../primitives/platformContinuityPrimitives';

import { composeContinuityEvent } from '../events/continuityEventEnvelope';
import {
  CONTINUITY_EVENT_KINDS,
  CONTINUITY_EVENT_TYPE_DEFAULT_SEVERITY,
  isKnownContinuityEventKind,
} from '../events/continuityEventTypes';
import { ingestContinuityEvents } from '../events/continuityEventRuntime';

import { createContinuityLedger } from '../ledger/continuityLedgerRuntime';
import { readLedgerSummary } from '../ledger/continuityLedgerReader';

import { readOnboardingSurvivability } from '../onboarding/onboardingRuntime';
import { readTransferContinuity } from '../onboarding/continuityTransferRuntime';
import { readSuccessorStewardship } from '../onboarding/successorStewardshipRuntime';

import { evaluateWorkflowAdvance } from '../workflow/continuityWorkflowRuntime';
import {
  onAfterRatification,
  onBeforeAdvance,
} from '../workflow/governanceAwareWorkflowHooks';

import { readStewardshipConcentration } from '../stewardship/runtimeStewardshipEngine';
import { readDependencyEvolution } from '../stewardship/dependencyEvolutionRuntime';

import { readGovernanceTraceability } from '../traceability/runtimeGovernanceTraceability';

import { readRuntimeReadiness } from '../readiness/runtimeReadinessEngine';
import { composeRuntimeContinuityNarrative } from '../readiness/runtimeContinuityReporting';

// ─────────────────────────────────────────────────────────────────────────────
// Tone discipline
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

function assertTone(s: string): void {
  expect(s).not.toMatch(FORBIDDEN);
  expect(s).not.toMatch(BLAME);
}

const SCOPE = 'institution:test-scope';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function fxEvent(overrides: Partial<ContinuityEventEnvelope> = {}): ContinuityEventEnvelope {
  return {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    eventId: 'evt-1',
    kind: 'GovernanceInterpretationChanged',
    severity: 'observation',
    observedAt: '2026-01-01T00:00:00Z',
    institutionScope: SCOPE,
    statement: 'A governance body restated an interpretation.',
    lineage: [],
    memoryReferences: [],
    evidence: {},
    ...overrides,
  };
}

function fxTransfer(overrides: Partial<StewardshipTransferRecord> = {}): StewardshipTransferRecord {
  return {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    transferId: 't1',
    institutionScope: SCOPE,
    originRoleState: 'role:a',
    destinationRoleState: 'role:b',
    reversibilityWindowClosed: false,
    consentRecorded: true,
    continuityCarriedBand: 'holding',
    statedAt: '2026-01-01T00:00:00Z',
    lineage: [],
    ...overrides,
  };
}

function fxOnboarding(overrides: Partial<OnboardingSurvivabilityRecord> = {}): OnboardingSurvivabilityRecord {
  return {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    recordId: 'r1',
    institutionScope: SCOPE,
    workflowRefId: 'wf:1',
    completionsRecorded: 5,
    contextPreservedBand: 'stabilizing',
    reconstructionBurdenBand: 'stabilizing',
    statedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function fxRationale(memoryId: string, overrides: Partial<RuntimeRationaleEnvelope> = {}): RuntimeRationaleEnvelope {
  return {
    envelopeVersion: GOVERNANCE_MEMORY_ENVELOPE_VERSION,
    memoryId,
    institutionScope: SCOPE,
    subjectKind: 'governance_decision',
    subjectRefId: 'dec:1',
    rationaleStatement: 'The body recorded the rationale for this decision.',
    reviewerRefId: 'reviewer:001',
    recordedAt: '2026-01-02T00:00:00Z',
    lineage: [],
    ...overrides,
  };
}

function fxAnnotation(overrides: Partial<CriticalActionAnnotation> = {}): CriticalActionAnnotation {
  return {
    actionId: 'act:1',
    actionKind: 'governance_action',
    continuityContext: composeContinuityRuntimeContext({
      institutionScope: SCOPE,
      sensitivity: 'standard',
    }),
    governanceLineage: [
      { refKind: 'governance_ratification', refId: 'gov:1', institutionScope: SCOPE, statedAt: '2026-01-01T00:00:00Z' },
    ],
    memoryReferences: [],
    reviewerRefId: 'reviewer:001',
    statedAt: '2026-01-03T00:00:00Z',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract validators
// ─────────────────────────────────────────────────────────────────────────────

describe('runtime contract validators', () => {
  it('refuses an event envelope missing statement and observedAt', () => {
    const v = validateContinuityEventEnvelope(
      fxEvent({ statement: '', observedAt: 'not-a-date' }),
    );
    expect(v.valid).toBe(false);
    expect(v.violations).toContain('event.statement_missing');
    expect(v.violations).toContain('event.observedAt_not_iso8601');
  });

  it('accepts a complete event envelope', () => {
    expect(validateContinuityEventEnvelope(fxEvent()).valid).toBe(true);
  });

  it('refuses a lineage reference missing institution scope', () => {
    const v = validateLineageReference({
      refKind: 'governance_ratification',
      refId: 'r',
      institutionScope: '',
      statedAt: '2026-01-01T00:00:00Z',
    });
    expect(v.violations).toContain('lineage.institutionScope_missing');
  });

  it('refuses a governance memory reference with missing reviewer', () => {
    const v = validateGovernanceMemoryReference({
      memoryId: 'm',
      recordedAt: '2026-01-01T00:00:00Z',
      institutionScope: SCOPE,
      subjectKind: 'governance_decision',
      reviewerRefId: '',
    });
    expect(v.violations).toContain('memory.reviewerRefId_missing');
  });

  it('validates a stewardship transfer record', () => {
    expect(validateStewardshipTransferRecord(fxTransfer()).valid).toBe(true);
  });

  it('refuses an onboarding record with negative completions', () => {
    const v = validateOnboardingSurvivabilityRecord(fxOnboarding({ completionsRecorded: -1 }));
    expect(v.violations).toContain('onboarding.completionsRecorded_negative');
  });

  it('validates a runtime continuity signal', () => {
    const v = validateRuntimeContinuitySignal({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 's',
      severity: 'observation',
      category: 'cat',
      statement: 'reading',
      evidence: {},
    });
    expect(v.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Governance memory runtime
// ─────────────────────────────────────────────────────────────────────────────

describe('governance memory runtime', () => {
  it('records a rationale envelope and reads it back within scope', () => {
    const store = createInMemoryLineageStore();
    const env = fxRationale('mem-1');
    const rec = recordRationale(env, store);
    expect(rec.recorded).toBe(true);
    const read = readRationale('mem-1', store, { reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    expect(read.readable).toBe(true);
    expect(read.envelope?.memoryId).toBe('mem-1');
  });

  it('refuses cross-institution reads', () => {
    const store = createInMemoryLineageStore();
    recordRationale(fxRationale('mem-2'), store);
    const read = readRationale('mem-2', store, {
      reviewerRefId: 'reviewer:001',
      institutionScope: 'institution:other',
    });
    expect(read.readable).toBe(false);
    expect(read.reason).toBe('not_yet_readable');
  });

  it('rejects a rationale missing reviewer reference', () => {
    const store = createInMemoryLineageStore();
    const r = recordRationale(fxRationale('mem-3', { reviewerRefId: '' }), store);
    expect(r.recorded).toBe(false);
    expect(r.rejections).toContain('reviewerRefId_missing');
  });

  it('summarises governance memory as not_yet_readable when empty', () => {
    const store = createInMemoryLineageStore();
    const sum = summarizeGovernanceMemory(store, { reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    expect(sum.recordedRationaleCount).toBe(0);
    assertTone(sum.statement);
  });

  it('summarises recorded rationale count after appends', () => {
    const store = createInMemoryLineageStore();
    recordRationale(fxRationale('mem-4', { recordedAt: '2026-01-02T00:00:00Z' }), store);
    recordRationale(fxRationale('mem-5', { recordedAt: '2026-01-05T00:00:00Z' }), store);
    const sum = summarizeGovernanceMemory(store, { reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    expect(sum.recordedRationaleCount).toBe(2);
    expect(sum.oldestRecordedAt).toBe('2026-01-02T00:00:00Z');
    expect(sum.newestRecordedAt).toBe('2026-01-05T00:00:00Z');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Continuity primitives
// ─────────────────────────────────────────────────────────────────────────────

describe('continuity runtime primitives', () => {
  it('composes a context with refusal-friendly defaults', () => {
    const ctx = composeContinuityRuntimeContext({
      institutionScope: SCOPE,
      sensitivity: 'unknown',
    });
    expect(ctx.stewardshipConcentrationBand).toBe('not_yet_readable');
    expect(ctx.survivabilityBand).toBe('not_yet_readable');
    expect(ctx.readinessSufficient).toBe(false);
    expect(isContinuitySensitive(ctx)).toBe(false);
    expect(isContinuityCritical(ctx)).toBe(false);
  });

  it('reads stewardship sensitivity from a regressing band', () => {
    const ctx = composeContinuityRuntimeContext({
      institutionScope: SCOPE,
      sensitivity: 'standard',
      stewardshipConcentrationBand: 'regressing',
    });
    const reading = readStewardshipSensitivity(ctx);
    expect(reading.sensitive).toBe(true);
    assertTone(reading.statement);
  });

  it('reports annotation completeness gaps for continuity-critical actions', () => {
    const ann = fxAnnotation({
      continuityContext: composeContinuityRuntimeContext({
        institutionScope: SCOPE,
        sensitivity: 'continuity_critical',
      }),
      memoryReferences: [],
    });
    const c = readAnnotationCompleteness(ann);
    expect(c.complete).toBe(false);
    expect(c.missing).toContain('memoryReferences_required_for_continuity_critical');
  });

  it('reads traceability gaps when actionId is missing', () => {
    const t = readTraceability(fxAnnotation({ actionId: '' }));
    expect(t.traceable).toBe(false);
    expect(t.reasons).toContain('actionId_missing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Event runtime
// ─────────────────────────────────────────────────────────────────────────────

describe('continuity event runtime', () => {
  it('enumerates ten canonical event kinds with default severities', () => {
    expect(CONTINUITY_EVENT_KINDS).toHaveLength(10);
    for (const k of CONTINUITY_EVENT_KINDS) {
      expect(CONTINUITY_EVENT_TYPE_DEFAULT_SEVERITY[k]).toBeDefined();
    }
    expect(isKnownContinuityEventKind('GovernanceRecoveryRatified')).toBe(true);
    expect(isKnownContinuityEventKind('unknown_kind')).toBe(false);
  });

  it('ingests events, sorts by observedAt then eventId, and refuses invalid ones', () => {
    const a = fxEvent({ eventId: 'b', observedAt: '2026-01-02T00:00:00Z' });
    const b = fxEvent({ eventId: 'a', observedAt: '2026-01-01T00:00:00Z' });
    const invalid = fxEvent({ eventId: '', statement: '' });
    const result = ingestContinuityEvents([a, b, invalid]);
    expect(result.accepted.map((e) => e.eventId)).toEqual(['a', 'b']);
    expect(result.rejections).toHaveLength(1);
    for (const s of result.signals) assertTone(s.statement);
  });

  it('composes an event with default severity from catalogue', () => {
    const e = composeContinuityEvent({
      eventId: 'evt-c',
      kind: 'ContinuityBreakpointIntroduced',
      observedAt: '2026-01-01T00:00:00Z',
      institutionScope: SCOPE,
      statement: 'A breakpoint was introduced and recorded.',
    });
    expect(e.severity).toBe('critical');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ledger
// ─────────────────────────────────────────────────────────────────────────────

describe('continuity ledger', () => {
  it('refuses reads without authorisation', () => {
    const ledger = createContinuityLedger();
    const entries = ledger.listEntries({ reviewerRefId: '', institutionScope: '' });
    expect(entries).toHaveLength(0);
  });

  it('appends from event, scopes reads to institution, and excludes others', () => {
    const ledger = createContinuityLedger();
    const e1 = fxEvent({ eventId: 'e-here', institutionScope: SCOPE });
    const e2 = fxEvent({ eventId: 'e-elsewhere', institutionScope: 'institution:other' });
    ledger.appendFromEvent(e1, 'governance_lineage', 'entry-1');
    ledger.appendFromEvent(e2, 'governance_lineage', 'entry-2');
    const list = ledger.listEntries({ reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    expect(list).toHaveLength(1);
    expect(list[0].entryId).toBe('entry-1');
  });

  it('summarises ledger as not_yet_readable when empty', () => {
    const ledger = createContinuityLedger();
    const sum = readLedgerSummary(ledger, { reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    expect(sum.totalEntries).toBe(0);
    assertTone(sum.statement);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding + transfer + successor
// ─────────────────────────────────────────────────────────────────────────────

describe('onboarding runtime layers', () => {
  it('reads survivability as not_yet_readable when empty', () => {
    const r = readOnboardingSurvivability([], SCOPE);
    expect(r.survivabilityBand).toBe('not_yet_readable');
    assertTone(r.statement);
  });

  it('reads survivability band as the weakest input', () => {
    const r = readOnboardingSurvivability(
      [
        fxOnboarding({ recordId: 'r1', contextPreservedBand: 'holding', reconstructionBurdenBand: 'regressing' }),
      ],
      SCOPE,
    );
    expect(r.survivabilityBand).toBe('regressing');
  });

  it('reads transfer continuity as the weakest carried band', () => {
    const r = readTransferContinuity(
      [
        fxTransfer({ transferId: 't1', continuityCarriedBand: 'stabilizing' }),
        fxTransfer({ transferId: 't2', continuityCarriedBand: 'regressing' }),
      ],
      SCOPE,
    );
    expect(r.continuityCarriedBand).toBe('regressing');
  });

  it('refuses successor stewardship composition across institution scopes', () => {
    const a = readOnboardingSurvivability([fxOnboarding()], SCOPE);
    const b = readTransferContinuity([fxTransfer()], 'institution:other');
    const composed = readSuccessorStewardship(a, b);
    expect(composed.successorReadinessBand).toBe('not_yet_readable');
    assertTone(composed.statement);
  });

  it('composes successor stewardship from in-scope readings', () => {
    const a = readOnboardingSurvivability([fxOnboarding()], SCOPE);
    const b = readTransferContinuity([fxTransfer()], SCOPE);
    const composed = readSuccessorStewardship(a, b);
    expect(composed.successorReadinessBand).not.toBe('not_yet_readable');
  });
});

describe('LIUNA-style leadership transition fixture', () => {
  const LIUNA_SCOPE = 'institution:liuna-opdc-cecof-synthetic';

  it('composes a planned leadership transition as successor-readable institutional context', () => {
    const onboarding = readOnboardingSurvivability(
      [
        fxOnboarding({
          recordId: 'liuna-onboarding-1',
          institutionScope: LIUNA_SCOPE,
          workflowRefId: 'workflow:ontario-infrastructure-continuity-review',
          completionsRecorded: 8,
          contextPreservedBand: 'holding',
          reconstructionBurdenBand: 'stabilizing',
        }),
      ],
      LIUNA_SCOPE,
    );
    const transfer = readTransferContinuity(
      [
        fxTransfer({
          transferId: 'liuna-transfer-1',
          institutionScope: LIUNA_SCOPE,
          originRoleState: 'role:outgoing-senior-officer',
          destinationRoleState: 'role:authorized-successor-reviewer',
          continuityCarriedBand: 'holding',
        }),
      ],
      LIUNA_SCOPE,
    );

    const successor = readSuccessorStewardship(onboarding, transfer);

    expect(successor.institutionScope).toBe(LIUNA_SCOPE);
    expect(successor.survivabilityBand).toBe('stabilizing');
    expect(successor.continuityCarriedBand).toBe('holding');
    expect(successor.successorReadinessBand).toBe('stabilizing');
    expect(successor.statement).toContain('stabilizing');
    for (const signal of successor.signals) assertTone(signal.statement);
  });

  it('refuses to compose OPDC and local readings when institution scopes differ', () => {
    const opdcOnboarding = readOnboardingSurvivability(
      [
        fxOnboarding({
          recordId: 'opdc-onboarding-1',
          institutionScope: LIUNA_SCOPE,
          workflowRefId: 'workflow:opdc-review',
        }),
      ],
      LIUNA_SCOPE,
    );
    const localTransfer = readTransferContinuity(
      [
        fxTransfer({
          transferId: 'local-transfer-1',
          institutionScope: 'institution:local-900-synthetic',
          originRoleState: 'role:local-outgoing',
          destinationRoleState: 'role:local-successor',
        }),
      ],
      'institution:local-900-synthetic',
    );

    const successor = readSuccessorStewardship(opdcOnboarding, localTransfer);

    expect(successor.successorReadinessBand).toBe('not_yet_readable');
    expect(successor.signals[0]?.signalId).toBe('successor_stewardship:institution_scope_mismatch');
    assertTone(successor.statement);
  });

  it('builds a human-readable continuity narrative from synthetic transition evidence', () => {
    const store = createInMemoryLineageStore();
    recordRationale(
      fxRationale('liuna-memory-1', {
        institutionScope: LIUNA_SCOPE,
        subjectRefId: 'GRV-ONT-2041',
        rationaleStatement: 'The transition review team recorded why the next action remains assigned to the authorized successor.',
      }),
      store,
    );
    const memory = summarizeGovernanceMemory(store, {
      reviewerRefId: 'reviewer:authorized-successor',
      institutionScope: LIUNA_SCOPE,
    });

    const ledger = createContinuityLedger();
    ledger.appendFromEvent(
      fxEvent({
        eventId: 'liuna-event-1',
        institutionScope: LIUNA_SCOPE,
        statement: 'A leadership transition review was recorded for a synthetic matter.',
      }),
      'governance_lineage',
      'liuna-ledger-1',
    );
    const ledgerSum = readLedgerSummary(ledger, {
      reviewerRefId: 'reviewer:authorized-successor',
      institutionScope: LIUNA_SCOPE,
    });

    const onboarding = readOnboardingSurvivability(
      [
        fxOnboarding({
          recordId: 'liuna-onboarding-2',
          institutionScope: LIUNA_SCOPE,
          completionsRecorded: 8,
          contextPreservedBand: 'holding',
          reconstructionBurdenBand: 'holding',
        }),
      ],
      LIUNA_SCOPE,
    );
    const transfer = readTransferContinuity(
      [
        fxTransfer({
          transferId: 'liuna-transfer-2',
          institutionScope: LIUNA_SCOPE,
          continuityCarriedBand: 'holding',
        }),
      ],
      LIUNA_SCOPE,
    );
    const successor = readSuccessorStewardship(onboarding, transfer);
    const stewardship = readStewardshipConcentration(
      [
        fxTransfer({
          transferId: 'liuna-transfer-2',
          institutionScope: LIUNA_SCOPE,
          destinationRoleState: 'role:authorized-successor-reviewer',
        }),
        fxTransfer({
          transferId: 'liuna-transfer-3',
          institutionScope: LIUNA_SCOPE,
          destinationRoleState: 'role:central-review-backup',
        }),
        fxTransfer({
          transferId: 'liuna-transfer-4',
          institutionScope: LIUNA_SCOPE,
          destinationRoleState: 'role:local-review-backup',
        }),
      ],
      LIUNA_SCOPE,
    );
    const traceability = readGovernanceTraceability({
      institutionScope: LIUNA_SCOPE,
      events: [
        fxEvent({
          eventId: 'liuna-event-1',
          institutionScope: LIUNA_SCOPE,
        }),
      ],
      lineageReferences: [
        {
          refKind: 'governance_ratification',
          refId: 'transition-review-approval',
          institutionScope: LIUNA_SCOPE,
          statedAt: '2026-01-01T00:00:00Z',
        },
      ],
      memoryReferences: [
        {
          memoryId: 'liuna-memory-1',
          recordedAt: '2026-01-02T00:00:00Z',
          institutionScope: LIUNA_SCOPE,
          subjectKind: 'governance_decision',
          reviewerRefId: 'reviewer:authorized-successor',
        },
      ],
    });
    const readiness = readRuntimeReadiness(
      {
        stabilizationMaturity: 'sufficient',
        governanceRatification: 'sufficient',
        redistributionPathways: 'sufficient',
        continuityDebt: 'not_yet_sufficient',
        onboardingSurvivability: 'sufficient',
        runtimeEthicsAlignment: 'sufficient',
      },
      LIUNA_SCOPE,
    );

    const narrative = composeRuntimeContinuityNarrative({
      institutionScope: LIUNA_SCOPE,
      memory,
      ledger: ledgerSum,
      onboarding,
      successor,
      stewardship,
      traceability,
      readiness,
    });

    expect(narrative.readableForExecutive).toBe(true);
    expect(narrative.paragraphs.length).toBeGreaterThanOrEqual(8);
    expect(narrative.paragraphs.join('\n')).toContain(LIUNA_SCOPE);
    for (const paragraph of narrative.paragraphs) assertTone(paragraph);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workflow runtime + hooks
// ─────────────────────────────────────────────────────────────────────────────

describe('continuity workflow runtime', () => {
  it('refuses a continuity-critical step with missing memory references', () => {
    const ann = fxAnnotation({
      continuityContext: composeContinuityRuntimeContext({
        institutionScope: SCOPE,
        sensitivity: 'continuity_critical',
      }),
      memoryReferences: [],
    });
    const r = evaluateWorkflowAdvance(ann);
    expect(r.verdict).toBe('refused');
    expect(r.reasons).toContain('memoryReferences_required_for_continuity_critical');
    assertTone(r.statement);
  });

  it('returns safe_to_advance when all conditions are met for a standard action', () => {
    const r = evaluateWorkflowAdvance(fxAnnotation());
    expect(r.verdict).toBe('safe_to_advance');
  });

  it('emits a ContinuityBreakpointIntroduced event when the before-advance hook refuses', () => {
    const ann = fxAnnotation({
      continuityContext: composeContinuityRuntimeContext({
        institutionScope: SCOPE,
        sensitivity: 'continuity_critical',
      }),
      memoryReferences: [],
    });
    const obs = onBeforeAdvance(ann);
    expect(obs.verdict).toBe('refused');
    expect(obs.emittedEvents.some((e) => e.kind === 'ContinuityBreakpointIntroduced')).toBe(true);
  });

  it('emits GovernanceRecoveryRatified on after-ratification hook', () => {
    const obs = onAfterRatification(fxAnnotation());
    expect(obs.emittedEvents.some((e) => e.kind === 'GovernanceRecoveryRatified')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stewardship + dependency
// ─────────────────────────────────────────────────────────────────────────────

describe('runtime stewardship layers', () => {
  it('reports concentration as regressing when consent is not recorded on every transfer', () => {
    const r = readStewardshipConcentration(
      [
        fxTransfer({ transferId: 't1', consentRecorded: false }),
        fxTransfer({ transferId: 't2', destinationRoleState: 'role:c' }),
      ],
      SCOPE,
    );
    expect(r.concentrationBand).toBe('regressing');
  });

  it('reports concentration as holding when three distinct destinations and reversibility exist', () => {
    const r = readStewardshipConcentration(
      [
        fxTransfer({ transferId: 't1', destinationRoleState: 'role:b' }),
        fxTransfer({ transferId: 't2', destinationRoleState: 'role:c' }),
        fxTransfer({ transferId: 't3', destinationRoleState: 'role:d' }),
      ],
      SCOPE,
    );
    expect(r.concentrationBand).toBe('holding');
  });

  it('reports dependency evolution as stabilizing when the latest count is lower', () => {
    const r = readDependencyEvolution(
      [
        { institutionScope: SCOPE, functionRefId: 'f', singlePointDependencyCount: 5, statedAt: '2026-01-01T00:00:00Z' },
        { institutionScope: SCOPE, functionRefId: 'f', singlePointDependencyCount: 3, statedAt: '2026-02-01T00:00:00Z' },
      ],
      SCOPE,
    );
    expect(r.evolutionBand).toBe('stabilizing');
  });

  it('reports dependency evolution as not_yet_readable when only one observation exists', () => {
    const r = readDependencyEvolution(
      [{ institutionScope: SCOPE, functionRefId: 'f', singlePointDependencyCount: 5, statedAt: '2026-01-01T00:00:00Z' }],
      SCOPE,
    );
    expect(r.evolutionBand).toBe('not_yet_readable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Governance traceability
// ─────────────────────────────────────────────────────────────────────────────

describe('runtime governance traceability', () => {
  it('reports not_yet_traceable when all inputs are empty', () => {
    const r = readGovernanceTraceability({
      institutionScope: SCOPE,
      events: [],
      lineageReferences: [],
      memoryReferences: [],
    });
    expect(r.verdict).toBe('not_yet_traceable');
  });

  it('reports partial when only some inputs are present', () => {
    const r = readGovernanceTraceability({
      institutionScope: SCOPE,
      events: [fxEvent()],
      lineageReferences: [],
      memoryReferences: [],
    });
    expect(r.verdict).toBe('partial');
    assertTone(r.statement);
  });

  it('reports traceable when all inputs are present in scope', () => {
    const r = readGovernanceTraceability({
      institutionScope: SCOPE,
      events: [fxEvent()],
      lineageReferences: [
        { refKind: 'governance_ratification', refId: 'g', institutionScope: SCOPE, statedAt: '2026-01-01T00:00:00Z' },
      ],
      memoryReferences: [
        { memoryId: 'm', recordedAt: '2026-01-01T00:00:00Z', institutionScope: SCOPE, subjectKind: 'governance_decision', reviewerRefId: 'reviewer:001' },
      ],
    });
    expect(r.verdict).toBe('traceable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime readiness + reporting
// ─────────────────────────────────────────────────────────────────────────────

describe('runtime readiness + reporting', () => {
  it('reports readiness as not_yet_readable when every condition is not_yet_readable', () => {
    const r = readRuntimeReadiness(
      {
        stabilizationMaturity: 'not_yet_readable',
        governanceRatification: 'not_yet_readable',
        redistributionPathways: 'not_yet_readable',
        continuityDebt: 'not_yet_readable',
        onboardingSurvivability: 'not_yet_readable',
        runtimeEthicsAlignment: 'not_yet_readable',
      },
      SCOPE,
    );
    expect(r.overall).toBe('not_yet_readable');
  });

  it('reports readiness as sufficient when every condition is sufficient', () => {
    const r = readRuntimeReadiness(
      {
        stabilizationMaturity: 'sufficient',
        governanceRatification: 'sufficient',
        redistributionPathways: 'sufficient',
        continuityDebt: 'sufficient',
        onboardingSurvivability: 'sufficient',
        runtimeEthicsAlignment: 'sufficient',
      },
      SCOPE,
    );
    expect(r.overall).toBe('sufficient');
    expect(r.sufficientCount).toBe(6);
  });

  it('reports readiness as not_yet_sufficient when mixed', () => {
    const r = readRuntimeReadiness(
      {
        stabilizationMaturity: 'sufficient',
        governanceRatification: 'sufficient',
        redistributionPathways: 'not_yet_sufficient',
        continuityDebt: 'not_yet_readable',
        onboardingSurvivability: 'sufficient',
        runtimeEthicsAlignment: 'sufficient',
      },
      SCOPE,
    );
    expect(r.overall).toBe('not_yet_sufficient');
    for (const s of r.signals) assertTone(s.statement);
  });

  it('composes a runtime continuity narrative with tone discipline', () => {
    const store = createInMemoryLineageStore();
    recordRationale(fxRationale('mem-x'), store);
    const memory = summarizeGovernanceMemory(store, { reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    const ledger = createContinuityLedger();
    ledger.appendFromEvent(fxEvent(), 'governance_lineage', 'entry-x');
    const ledgerSum = readLedgerSummary(ledger, { reviewerRefId: 'reviewer:001', institutionScope: SCOPE });
    const onboarding = readOnboardingSurvivability([fxOnboarding()], SCOPE);
    const transfer = readTransferContinuity([fxTransfer()], SCOPE);
    const successor = readSuccessorStewardship(onboarding, transfer);
    const stewardship = readStewardshipConcentration([fxTransfer()], SCOPE);
    const traceability = readGovernanceTraceability({
      institutionScope: SCOPE,
      events: [fxEvent()],
      lineageReferences: [
        { refKind: 'governance_ratification', refId: 'g', institutionScope: SCOPE, statedAt: '2026-01-01T00:00:00Z' },
      ],
      memoryReferences: [
        { memoryId: 'm', recordedAt: '2026-01-01T00:00:00Z', institutionScope: SCOPE, subjectKind: 'governance_decision', reviewerRefId: 'reviewer:001' },
      ],
    });
    const readiness = readRuntimeReadiness(
      {
        stabilizationMaturity: 'sufficient',
        governanceRatification: 'sufficient',
        redistributionPathways: 'sufficient',
        continuityDebt: 'sufficient',
        onboardingSurvivability: 'sufficient',
        runtimeEthicsAlignment: 'sufficient',
      },
      SCOPE,
    );
    const narr = composeRuntimeContinuityNarrative({
      institutionScope: SCOPE,
      memory,
      ledger: ledgerSum,
      onboarding,
      successor,
      stewardship,
      traceability,
      readiness,
    });
    expect(narr.paragraphs.length).toBeGreaterThanOrEqual(8);
    for (const p of narr.paragraphs) assertTone(p);
    expect(narr.readableForExecutive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('runtime determinism', () => {
  it('returns identical ingestion results for identical inputs', () => {
    const input = [fxEvent({ eventId: 'a' }), fxEvent({ eventId: 'b' })];
    const r1 = ingestContinuityEvents(input);
    const r2 = ingestContinuityEvents(input);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('returns identical readiness readings for identical inputs', () => {
    const inputs = {
      stabilizationMaturity: 'sufficient' as const,
      governanceRatification: 'not_yet_sufficient' as const,
      redistributionPathways: 'sufficient' as const,
      continuityDebt: 'not_yet_readable' as const,
      onboardingSurvivability: 'sufficient' as const,
      runtimeEthicsAlignment: 'sufficient' as const,
    };
    const r1 = readRuntimeReadiness(inputs, SCOPE);
    const r2 = readRuntimeReadiness(inputs, SCOPE);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
