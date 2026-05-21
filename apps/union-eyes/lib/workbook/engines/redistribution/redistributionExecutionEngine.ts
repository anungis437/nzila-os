/**
 * OCI Redistribution Execution Engine — composition layer that turns
 * the Stewardship Redistribution playbook into a deterministic
 * executable plan with canonical signal envelopes.
 *
 * Composes:
 *   - reciprocityRatificationGate
 *   - carrierConsentLedger
 *   - residualConcentrationReader
 *
 * Pure. No DB writes. No actions.
 *
 * Doctrine:
 *   docs/oci/stabilization/playbooks/STEWARDSHIP_REDISTRIBUTION.md
 *   docs/oci/stabilization/workflows/STEWARDSHIP_REDISTRIBUTION_WORKFLOW.md
 */

import {
  deriveCarrierConsentLedger,
  type CarrierConsentLedgerInput,
  type DerivedCarrierConsentLedger,
} from './carrierConsentLedger';
import {
  evaluateReciprocityRatification,
  type ReciprocityRatificationInput,
  type ReciprocityRatificationResult,
} from './reciprocityRatificationGate';
import {
  readResidualConcentration,
  type ResidualConcentrationInput,
  type ResidualConcentrationResult,
} from './residualConcentrationReader';

export const ENGINE_VERSION = '2.0.0';

export type ExecutionSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type ExecutionSignalCategory =
  | 'execution_refused_reciprocity_missing'
  | 'execution_refused_no_consented_carrier'
  | 'execution_offered'
  | 'carrier_consent_withdrawn_recorded'
  | 'residual_concentration_reading'
  | 'consent_ledger_event_rejected';

export interface ExecutionSignal {
  readonly signalId: string;
  readonly severity: ExecutionSignalSeverity;
  readonly category: ExecutionSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export type ExecutionDisposition = 'offered' | 'refused' | 'deferred';

export interface RedistributionExecutionInput {
  readonly reciprocity: ReciprocityRatificationInput;
  readonly consentLedger: CarrierConsentLedgerInput;
  readonly residual: ResidualConcentrationInput;
}

export interface RedistributionExecutionResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly disposition: ExecutionDisposition;
  readonly reciprocity: ReciprocityRatificationResult;
  readonly consent: DerivedCarrierConsentLedger;
  readonly residual: ResidualConcentrationResult;
  readonly signals: readonly ExecutionSignal[];
  readonly preview: string;
}

function severityFor(category: ExecutionSignalCategory): ExecutionSignalSeverity {
  switch (category) {
    case 'execution_refused_reciprocity_missing':
      return 'critical';
    case 'execution_refused_no_consented_carrier':
      return 'critical';
    case 'execution_offered':
      return 'observation';
    case 'carrier_consent_withdrawn_recorded':
      return 'warning';
    case 'residual_concentration_reading':
      return 'note';
    case 'consent_ledger_event_rejected':
      return 'warning';
  }
}

export function runRedistributionExecutionEngine(
  input: RedistributionExecutionInput,
): RedistributionExecutionResult {
  const reciprocity = evaluateReciprocityRatification(input.reciprocity);
  const consent = deriveCarrierConsentLedger(input.consentLedger);
  const residual = readResidualConcentration(input.residual);

  const signals: ExecutionSignal[] = [];

  let disposition: ExecutionDisposition;
  if (reciprocity.disposition === 'refused') {
    disposition = 'refused';
    signals.push({
      signalId: 'execution:refused_reciprocity',
      severity: severityFor('execution_refused_reciprocity_missing'),
      category: 'execution_refused_reciprocity_missing',
      statement:
        'Execution refused. Section 11 reciprocity terms are not fully ratified.',
      evidence: { missingTerms: reciprocity.missingTerms },
    });
  } else if (consent.consentedIds.length === 0) {
    disposition = 'refused';
    signals.push({
      signalId: 'execution:refused_no_consent',
      severity: severityFor('execution_refused_no_consented_carrier'),
      category: 'execution_refused_no_consented_carrier',
      statement:
        'Execution refused. No carrier candidate has consented. Consent is non-substitutable.',
      evidence: {
        pendingIds: consent.pendingIds,
        declinedIds: consent.declinedIds,
        withdrawnIds: consent.withdrawnIds,
      },
    });
  } else {
    disposition = 'offered';
    signals.push({
      signalId: 'execution:offered',
      severity: severityFor('execution_offered'),
      category: 'execution_offered',
      statement: `Execution offered. ${consent.consentedIds.length} carrier(s) have consented. Governance ratification required to enter the reversibility window.`,
      evidence: {
        consentedIds: consent.consentedIds,
        residualOverall: residual.overall,
      },
    });
  }

  for (const w of consent.perCandidate.filter((s) => s.hasBeenWithdrawn)) {
    signals.push({
      signalId: `execution:withdrawn:${w.candidate.carrierId}`,
      severity: severityFor('carrier_consent_withdrawn_recorded'),
      category: 'carrier_consent_withdrawn_recorded',
      statement: `Carrier ${w.candidate.carrierId} previously consented and then withdrew. Withdrawal is honoured per OCI_INTERVENTION_ETHICS §2.5.`,
      evidence: { carrierId: w.candidate.carrierId, subject: w.candidate.subjectSummary },
    });
  }

  signals.push({
    signalId: 'execution:residual_reading',
    severity: severityFor('residual_concentration_reading'),
    category: 'residual_concentration_reading',
    statement: `Residual concentration reading: ${residual.overall}.`,
    evidence: {
      overall: residual.overall,
      perProcess: residual.perProcess.map((p) => ({
        processId: p.processId,
        reading: p.reading,
        pre: p.preCarrierCount,
        post: p.postCarrierCount,
      })),
    },
  });

  for (const rej of consent.rejections) {
    signals.push({
      signalId: `execution:consent_rejection:${rej.eventId}`,
      severity: severityFor('consent_ledger_event_rejected'),
      category: 'consent_ledger_event_rejected',
      statement: `Consent ledger event ${rej.eventId} for carrier ${rej.carrierId} rejected: ${rej.reason}.`,
      evidence: rej,
    });
  }

  // Merge reciprocity-gate signals (already canonical envelope shape).
  for (const r of reciprocity.signals) {
    signals.push({
      signalId: `execution:${r.signalId}`,
      severity: r.severity,
      category:
        r.category === 'reciprocity_terms_missing'
          ? 'execution_refused_reciprocity_missing'
          : 'execution_offered',
      statement: r.statement,
      evidence: r.evidence,
    });
  }

  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: ENGINE_VERSION,
    disposition,
    reciprocity,
    consent,
    residual,
    signals,
    preview: `Stewardship redistribution execution — disposition ${disposition}; residual ${residual.overall}; ${consent.consentedIds.length} consented carrier(s).`,
  };
}
