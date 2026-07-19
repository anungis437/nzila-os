/**
 * ARTIFACT TYPE: Runtime Validator
 * MODULE: OCI Runtime Infrastructure
 * DOCTRINE_VERSION: 1.0.0
 *
 * Refusal-first envelope validators. These validators report what is missing.
 * They never coerce, never fill in defaults, and never authorise an envelope
 * that fails any structural check.
 */

import type {
  ContinuityEventEnvelope,
  GovernanceMemoryReference,
  OnboardingSurvivabilityRecord,
  RuntimeContinuitySignal,
  RuntimeLineageReference,
  StewardshipTransferRecord,
} from './runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from './runtimeContracts';

export interface ValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

function ok(): ValidationResult {
  return { valid: true, violations: [] };
}

function fail(...violations: string[]): ValidationResult {
  return { valid: false, violations };
}

function isIso8601(s: string): boolean {
  if (typeof s !== 'string' || s.length === 0) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && /T/.test(s);
}

function nonEmpty(s: any): s is string {
  return typeof s === 'string' && s.length > 0;
}

export function validateLineageReference(ref: RuntimeLineageReference): ValidationResult {
  const v: string[] = [];
  if (!nonEmpty(ref.refKind)) v.push('lineage.refKind_missing');
  if (!nonEmpty(ref.refId)) v.push('lineage.refId_missing');
  if (!nonEmpty(ref.institutionScope)) v.push('lineage.institutionScope_missing');
  if (!isIso8601(ref.statedAt)) v.push('lineage.statedAt_not_iso8601');
  return v.length === 0 ? ok() : fail(...v);
}

export function validateGovernanceMemoryReference(
  ref: GovernanceMemoryReference,
): ValidationResult {
  const v: string[] = [];
  if (!nonEmpty(ref.memoryId)) v.push('memory.memoryId_missing');
  if (!nonEmpty(ref.institutionScope)) v.push('memory.institutionScope_missing');
  if (!nonEmpty(ref.reviewerRefId)) v.push('memory.reviewerRefId_missing');
  if (!nonEmpty(ref.subjectKind)) v.push('memory.subjectKind_missing');
  if (!isIso8601(ref.recordedAt)) v.push('memory.recordedAt_not_iso8601');
  return v.length === 0 ? ok() : fail(...v);
}

export function validateContinuityEventEnvelope(
  env: ContinuityEventEnvelope,
): ValidationResult {
  const v: string[] = [];
  if (env.contractVersion !== RUNTIME_CONTRACT_VERSION) v.push('event.contractVersion_mismatch');
  if (!nonEmpty(env.eventId)) v.push('event.eventId_missing');
  if (!nonEmpty(env.kind)) v.push('event.kind_missing');
  if (!nonEmpty(env.severity)) v.push('event.severity_missing');
  if (!nonEmpty(env.institutionScope)) v.push('event.institutionScope_missing');
  if (!nonEmpty(env.statement)) v.push('event.statement_missing');
  if (!isIso8601(env.observedAt)) v.push('event.observedAt_not_iso8601');
  if (!Array.isArray(env.lineage)) v.push('event.lineage_not_array');
  if (!Array.isArray(env.memoryReferences)) v.push('event.memoryReferences_not_array');
  return v.length === 0 ? ok() : fail(...v);
}

export function validateStewardshipTransferRecord(
  rec: StewardshipTransferRecord,
): ValidationResult {
  const v: string[] = [];
  if (rec.contractVersion !== RUNTIME_CONTRACT_VERSION) v.push('transfer.contractVersion_mismatch');
  if (!nonEmpty(rec.transferId)) v.push('transfer.transferId_missing');
  if (!nonEmpty(rec.institutionScope)) v.push('transfer.institutionScope_missing');
  if (!nonEmpty(rec.originRoleState)) v.push('transfer.originRoleState_missing');
  if (!nonEmpty(rec.destinationRoleState)) v.push('transfer.destinationRoleState_missing');
  if (!isIso8601(rec.statedAt)) v.push('transfer.statedAt_not_iso8601');
  return v.length === 0 ? ok() : fail(...v);
}

export function validateOnboardingSurvivabilityRecord(
  rec: OnboardingSurvivabilityRecord,
): ValidationResult {
  const v: string[] = [];
  if (rec.contractVersion !== RUNTIME_CONTRACT_VERSION) v.push('onboarding.contractVersion_mismatch');
  if (!nonEmpty(rec.recordId)) v.push('onboarding.recordId_missing');
  if (!nonEmpty(rec.institutionScope)) v.push('onboarding.institutionScope_missing');
  if (!nonEmpty(rec.workflowRefId)) v.push('onboarding.workflowRefId_missing');
  if (rec.completionsRecorded < 0) v.push('onboarding.completionsRecorded_negative');
  if (!isIso8601(rec.statedAt)) v.push('onboarding.statedAt_not_iso8601');
  return v.length === 0 ? ok() : fail(...v);
}

export function validateRuntimeContinuitySignal(
  sig: RuntimeContinuitySignal,
): ValidationResult {
  const v: string[] = [];
  if (sig.contractVersion !== RUNTIME_CONTRACT_VERSION) v.push('signal.contractVersion_mismatch');
  if (!nonEmpty(sig.signalId)) v.push('signal.signalId_missing');
  if (!nonEmpty(sig.severity)) v.push('signal.severity_missing');
  if (!nonEmpty(sig.category)) v.push('signal.category_missing');
  if (!nonEmpty(sig.statement)) v.push('signal.statement_missing');
  return v.length === 0 ? ok() : fail(...v);
}
