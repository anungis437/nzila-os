/**
 * Direct unit coverage for the node identity module (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-
 * FROM-TAG-CO-OCCURRENCE, Family 1 final correction). Every evidence, lookup and consumer path resolves node
 * references through resolveNodeReference; its refusal to guess is proven here directly.
 */
import { describe, expect, it } from 'vitest';
import {
  IDENTITY_KEY_VERSION,
  canonicalNodeIdentityKey,
  legacyIdentityKeyV1,
  legacyReferenceIsUnambiguous,
  resolveConceptLabel,
  resolveNodeReference,
} from '../graph-identity';
import { computeSourceFingerprint } from '../graph-fingerprint';

describe('canonicalNodeIdentityKey (version 2)', () => {
  it('tolerates only underscores-for-spaces, case, Unicode composition and whitespace runs', () => {
    expect(IDENTITY_KEY_VERSION).toBe(2);
    expect(canonicalNodeIdentityKey('Payroll_System')).toBe('payroll system');
    expect(canonicalNodeIdentityKey('  PAYROLL___SYSTEM ')).toBe('payroll system');
    // NFC: a precomposed and a decomposed "é" name the same label.
    expect(canonicalNodeIdentityKey('Côté')).toBe(canonicalNodeIdentityKey('Côté'));
  });

  it('keeps apart labels that version 1 collapsed into one concept', () => {
    expect(canonicalNodeIdentityKey('C++')).not.toBe(canonicalNodeIdentityKey('C'));
    expect(canonicalNodeIdentityKey('Côté')).not.toBe(canonicalNodeIdentityKey('Cote'));
    expect(canonicalNodeIdentityKey('Re-hire')).not.toBe(canonicalNodeIdentityKey('Rehire'));
    expect(legacyIdentityKeyV1('C++')).toBe(legacyIdentityKeyV1('C'));
    expect(legacyIdentityKeyV1('Côté')).toBe(legacyIdentityKeyV1('Cote'));
  });

  it('returns an empty string for non-string or empty input rather than throwing', () => {
    expect(canonicalNodeIdentityKey('')).toBe('');
    expect(canonicalNodeIdentityKey(undefined as unknown as string)).toBe('');
    expect(legacyIdentityKeyV1(null as unknown as string)).toBe('');
  });
});

describe('resolveNodeReference', () => {
  const current = ['Payroll_System', 'Bylaw_Amendment_Procedure', 'Vendor_X'];

  it('resolves an exact or cosmetically-different reference to the CURRENT id', () => {
    expect(resolveNodeReference([], current, 'Payroll_System')).toEqual({ status: 'resolved', nodeId: 'Payroll_System', via: 'direct' });
    expect(resolveNodeReference([], current, 'payroll   system')).toEqual({ status: 'resolved', nodeId: 'Payroll_System', via: 'direct' });
  });

  it('never guesses a close match', () => {
    expect(resolveNodeReference([], current, 'Payroll_Systems')).toEqual({ status: 'not_found' });
    expect(resolveNodeReference([], [], 'Payroll_System')).toEqual({ status: 'not_found' });
    expect(resolveNodeReference([], current, '')).toEqual({ status: 'not_found' });
  });

  it('reports two current nodes matching one reference as ambiguous - never first-match-wins', () => {
    const colliding = ['Payroll_System', 'payroll system'];
    expect(resolveNodeReference([], colliding, 'PAYROLL_SYSTEM')).toEqual({ status: 'ambiguous', candidates: colliding });
    expect(resolveConceptLabel([], colliding, 'PAYROLL_SYSTEM')).toBeNull();
  });

  it('follows exactly one alias for a semantic rename', () => {
    const aliases = [{ aliasLabel: 'Old_Payroll', canonicalConceptLabel: 'Payroll_System' }];
    expect(resolveNodeReference(aliases, current, 'old payroll')).toEqual({ status: 'resolved', nodeId: 'Payroll_System', via: 'alias' });
  });

  it('a direct match always wins over an alias with the same label', () => {
    const aliases = [{ aliasLabel: 'Vendor_X', canonicalConceptLabel: 'Payroll_System' }];
    expect(resolveNodeReference(aliases, current, 'Vendor_X')).toEqual({ status: 'resolved', nodeId: 'Vendor_X', via: 'direct' });
  });

  it('reports two aliases with one key pointing at different concepts as ambiguous', () => {
    const aliases = [
      { aliasLabel: 'Pay', canonicalConceptLabel: 'Payroll_System' },
      { aliasLabel: 'pay', canonicalConceptLabel: 'Vendor_X' },
    ];
    expect(resolveNodeReference(aliases, current, 'Pay').status).toBe('ambiguous');
  });

  it('does not follow alias chains, and reports an alias to a missing or ambiguous target honestly', () => {
    const chain = [
      { aliasLabel: 'A', canonicalConceptLabel: 'B' },
      { aliasLabel: 'B', canonicalConceptLabel: 'Payroll_System' },
    ];
    expect(resolveNodeReference(chain, current, 'A')).toEqual({ status: 'not_found' });
    expect(resolveNodeReference([{ aliasLabel: 'Pay', canonicalConceptLabel: 'Retired' }], current, 'Pay')).toEqual({ status: 'not_found' });
    expect(resolveNodeReference([{ aliasLabel: 'Pay', canonicalConceptLabel: 'payroll system' }], ['Payroll_System', 'payroll_system'], 'Pay').status).toBe('ambiguous');
  });
});

describe('legacyReferenceIsUnambiguous', () => {
  it('is true only when the version-1 key names exactly one current node', () => {
    expect(legacyReferenceIsUnambiguous(['Côté', 'Payroll'], 'Côté')).toBe(true);
    expect(legacyReferenceIsUnambiguous(['Côté', 'Cote'], 'Côté')).toBe(false);
    expect(legacyReferenceIsUnambiguous(['Payroll'], 'Côté')).toBe(false);
  });
});

describe('computeSourceFingerprint', () => {
  const a = { label: 'Finance_Steward', category: 'operational', nodeType: 'role' };
  const b = { label: 'Payroll_System', category: 'operational', nodeType: 'system' };

  it('is directional: a reversed pair never matches', () => {
    expect(computeSourceFingerprint(a, b)).not.toBe(computeSourceFingerprint(b, a));
  });

  it('changes with category or node type, not with cosmetic label drift', () => {
    expect(computeSourceFingerprint(a, b)).toBe(computeSourceFingerprint({ ...a, label: 'finance steward' }, b));
    expect(computeSourceFingerprint(a, b)).not.toBe(computeSourceFingerprint(a, { ...b, category: 'vendor' }));
    expect(computeSourceFingerprint(a, b)).not.toBe(computeSourceFingerprint(a, { ...b, nodeType: 'process' }));
  });

  it('never lets a version-1 and a version-2 fingerprint coincide', () => {
    expect(computeSourceFingerprint(a, b, 1)).not.toBe(computeSourceFingerprint(a, b, 2));
  });

  it('reproduces the version-1 format byte for byte (so pre-version-2 rows can still be judged)', async () => {
    const { createHash } = await import('node:crypto');
    const side = (n: typeof a) => ({ key: legacyIdentityKeyV1(n.label), category: n.category, nodeType: n.nodeType });
    const expected = createHash('sha256').update(JSON.stringify({ dependent: side(a), dependsOn: side(b) })).digest('hex').slice(0, 32);
    expect(computeSourceFingerprint(a, b, 1)).toBe(expected);
  });
});
