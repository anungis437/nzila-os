/**
 * Direct unit coverage for the canonical node identity module (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-
 * SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE). Every consumer of verified-dependency evidence relies on this
 * module's collision-resistance; it must be proven directly, not only indirectly through consumer tests.
 */
import { describe, expect, it } from 'vitest';
import { canonicalNodeIdentityKey, resolveCurrentNodeId } from '../graph-identity';

describe('canonicalNodeIdentityKey', () => {
  it('reverses underscores to single spaces and lowercases', () => {
    expect(canonicalNodeIdentityKey('Payroll_System')).toBe('payroll system');
  });

  it('treats two ids that differ only in case or spacing run-length as the same key', () => {
    expect(canonicalNodeIdentityKey('Payroll_System')).toBe(canonicalNodeIdentityKey('PAYROLL___SYSTEM'));
    expect(canonicalNodeIdentityKey('Payroll_System')).toBe(canonicalNodeIdentityKey('payroll_system'));
  });

  it('strips surrounding and internal punctuation', () => {
    expect(canonicalNodeIdentityKey('Payroll_System!!')).toBe('payroll system');
    expect(canonicalNodeIdentityKey("Grievance's_Intake,_Desk")).toBe('grievances intake desk');
  });

  it('strips diacritics via NFKD normalization', () => {
    expect(canonicalNodeIdentityKey('Négociation_Collective')).toBe('negociation collective');
  });

  it('collapses internal whitespace runs to a single space and trims', () => {
    expect(canonicalNodeIdentityKey('  Bylaw   Amendment  ')).toBe('bylaw amendment');
  });

  it('never collapses two genuinely different labels to the same key', () => {
    expect(canonicalNodeIdentityKey('Payroll_System')).not.toBe(canonicalNodeIdentityKey('Payables_System'));
  });

  it('returns an empty string for non-string or empty input rather than throwing (defensive bound)', () => {
    expect(canonicalNodeIdentityKey('')).toBe('');
    expect(canonicalNodeIdentityKey(undefined as unknown as string)).toBe('');
    expect(canonicalNodeIdentityKey(null as unknown as string)).toBe('');
  });

  it('is deterministic: the same input always produces the same key', () => {
    const inputs = ['Payroll_System', 'Bylaw_Amendment_Procedure', ''];
    for (const input of inputs) {
      expect(canonicalNodeIdentityKey(input)).toBe(canonicalNodeIdentityKey(input));
    }
  });
});

describe('resolveCurrentNodeId', () => {
  const current = ['Payroll_System', 'Bylaw_Amendment_Procedure', 'Vendor_X'];

  it('resolves an exact match', () => {
    expect(resolveCurrentNodeId(current, 'Payroll_System')).toBe('Payroll_System');
  });

  it('resolves a candidate that only differs by formatting to the CURRENT id (not the candidate)', () => {
    expect(resolveCurrentNodeId(current, 'payroll system')).toBe('Payroll_System');
    expect(resolveCurrentNodeId(current, 'PAYROLL___SYSTEM!!')).toBe('Payroll_System');
  });

  it('returns null when no current node matches at all, rather than guessing a close match', () => {
    expect(resolveCurrentNodeId(current, 'Retired_Process')).toBeNull();
  });

  it('never matches across two different canonical keys even if textually similar', () => {
    expect(resolveCurrentNodeId(current, 'Payroll_Systems')).toBeNull();
  });

  it('returns null against an empty current-node list', () => {
    expect(resolveCurrentNodeId([], 'Payroll_System')).toBeNull();
  });
});
