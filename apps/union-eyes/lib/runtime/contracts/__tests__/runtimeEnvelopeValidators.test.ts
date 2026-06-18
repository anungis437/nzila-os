import { describe, expect, it } from 'vitest';

import { RUNTIME_CONTRACT_VERSION } from '../runtimeContracts';
import {
  validateContinuityEventEnvelope,
  validateGovernanceMemoryReference,
  validateLineageReference,
  validateOnboardingSurvivabilityRecord,
  validateRuntimeContinuitySignal,
  validateStewardshipTransferRecord,
} from '../runtimeEnvelopeValidators';

const ISO = '2026-01-02T03:04:05.000Z';

describe('lib/runtime/contracts/runtimeEnvelopeValidators', () => {
  describe('validateLineageReference', () => {
    it('passes a complete reference', () => {
      expect(
        validateLineageReference({ refKind: 'k', refId: 'id', institutionScope: 's', statedAt: ISO } as never).valid,
      ).toBe(true);
    });
    it('reports all missing fields and bad date', () => {
      const r = validateLineageReference({ refKind: '', refId: '', institutionScope: '', statedAt: 'nope' } as never);
      expect(r.valid).toBe(false);
      expect(r.violations).toHaveLength(4);
    });
  });

  describe('validateGovernanceMemoryReference', () => {
    it('passes and fails appropriately', () => {
      expect(
        validateGovernanceMemoryReference({
          memoryId: 'm',
          institutionScope: 's',
          reviewerRefId: 'r',
          subjectKind: 'k',
          recordedAt: ISO,
        } as never).valid,
      ).toBe(true);
      expect(validateGovernanceMemoryReference({} as never).violations.length).toBeGreaterThan(0);
    });
  });

  describe('validateContinuityEventEnvelope', () => {
    it('passes a valid envelope', () => {
      expect(
        validateContinuityEventEnvelope({
          contractVersion: RUNTIME_CONTRACT_VERSION,
          eventId: 'e',
          kind: 'k',
          severity: 'high',
          institutionScope: 's',
          statement: 'x',
          observedAt: ISO,
          lineage: [],
          memoryReferences: [],
        } as never).valid,
      ).toBe(true);
    });
    it('flags version mismatch and non-array fields', () => {
      const r = validateContinuityEventEnvelope({
        contractVersion: '9.9.9',
        eventId: '',
        kind: '',
        severity: '',
        institutionScope: '',
        statement: '',
        observedAt: 'bad',
        lineage: null,
        memoryReferences: null,
      } as never);
      expect(r.valid).toBe(false);
      expect(r.violations).toContain('event.contractVersion_mismatch');
      expect(r.violations).toContain('event.lineage_not_array');
    });
  });

  describe('validateStewardshipTransferRecord', () => {
    it('passes and fails', () => {
      expect(
        validateStewardshipTransferRecord({
          contractVersion: RUNTIME_CONTRACT_VERSION,
          transferId: 't',
          institutionScope: 's',
          originRoleState: 'a',
          destinationRoleState: 'b',
          statedAt: ISO,
        } as never).valid,
      ).toBe(true);
      expect(validateStewardshipTransferRecord({ contractVersion: 'x' } as never).valid).toBe(false);
    });
  });

  describe('validateOnboardingSurvivabilityRecord', () => {
    it('flags negative completions', () => {
      const r = validateOnboardingSurvivabilityRecord({
        contractVersion: RUNTIME_CONTRACT_VERSION,
        recordId: 'r',
        institutionScope: 's',
        workflowRefId: 'w',
        completionsRecorded: -1,
        statedAt: ISO,
      } as never);
      expect(r.valid).toBe(false);
      expect(r.violations).toContain('onboarding.completionsRecorded_negative');
    });
    it('passes valid record', () => {
      expect(
        validateOnboardingSurvivabilityRecord({
          contractVersion: RUNTIME_CONTRACT_VERSION,
          recordId: 'r',
          institutionScope: 's',
          workflowRefId: 'w',
          completionsRecorded: 0,
          statedAt: ISO,
        } as never).valid,
      ).toBe(true);
    });
  });

  describe('validateRuntimeContinuitySignal', () => {
    it('passes and fails', () => {
      expect(
        validateRuntimeContinuitySignal({
          contractVersion: RUNTIME_CONTRACT_VERSION,
          signalId: 's',
          severity: 'high',
          category: 'c',
          statement: 'x',
        } as never).valid,
      ).toBe(true);
      expect(validateRuntimeContinuitySignal({} as never).valid).toBe(false);
    });
  });
});
