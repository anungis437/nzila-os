/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Structural invariants for db/rls-storage-authority-manifest.ts's
 * privilege model (requiredRuntimePrivileges) and execution-authority
 * dimension (executionAuthority), added PR #752 review round 3 to make
 * this manifest a faithful input to eventual least-privilege SQL GRANT
 * generation.
 */
import { describe, expect, it } from 'vitest';
import {
  storageAuthorityManifest,
  type StorageAuthorityEntry,
} from '../rls-storage-authority-manifest';

const RUNTIME_OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
const EXECUTION_AUTHORITIES = [
  'TENANT', 'SYSTEM', 'PLATFORM_ADMIN', 'WEBHOOK', 'WORKER', 'MIXED', 'NONE', 'TBD',
] as const;

function privilegesOf(entry: StorageAuthorityEntry): string[] {
  return entry.requiredRuntimePrivileges === 'TBD' ? [] : [...entry.requiredRuntimePrivileges];
}

describe('rls-storage-authority-manifest privilege/execution-authority invariants', () => {
  it('every entry declares a recognized requiredRuntimePrivileges value (array of valid operations, or the literal "TBD")', () => {
    for (const entry of storageAuthorityManifest) {
      if (entry.requiredRuntimePrivileges === 'TBD') continue;
      expect(Array.isArray(entry.requiredRuntimePrivileges), `${entry.table}: expected array or 'TBD'`).toBe(true);
      for (const op of entry.requiredRuntimePrivileges) {
        expect(RUNTIME_OPERATIONS as readonly string[], `${entry.table}: unrecognized operation ${op}`).toContain(op);
      }
    }
  });

  it('no entry lists a duplicate operation in requiredRuntimePrivileges', () => {
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      const ops = privilegesOf(entry);
      if (new Set(ops).size !== ops.length) offenders.push(entry.table);
    }
    expect(offenders).toEqual([]);
  });

  it('every entry declares a recognized executionAuthority value', () => {
    for (const entry of storageAuthorityManifest) {
      expect(EXECUTION_AUTHORITIES as readonly string[], `${entry.table}: unrecognized executionAuthority ${entry.executionAuthority}`).toContain(
        entry.executionAuthority,
      );
    }
  });

  it('SYSTEM_ONLY entries executed purely via SYSTEM context carry no tenant runtime privileges (union_eyes_runtime must have [])', () => {
    // A SYSTEM_ONLY table executed by a PLATFORM_ADMIN-gated caller through
    // the ordinary db connection (not withSystemContext) legitimately needs
    // real union_eyes_runtime grants — the invariant only holds when
    // executionAuthority is 'SYSTEM' (pure withSystemContext execution).
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'SYSTEM_ONLY') continue;
      if (entry.executionAuthority !== 'SYSTEM') continue;
      if (privilegesOf(entry).length > 0) offenders.push(entry.table);
    }
    expect(offenders).toEqual([]);
  });

  it('LATENT_UNREACHABLE entries carry no tenant runtime privileges and executionAuthority NONE', () => {
    const privilegeOffenders: string[] = [];
    const authorityOffenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'LATENT_UNREACHABLE') continue;
      if (privilegesOf(entry).length > 0) privilegeOffenders.push(entry.table);
      if (entry.executionAuthority !== 'NONE') authorityOffenders.push(entry.table);
    }
    expect(privilegeOffenders).toEqual([]);
    expect(authorityOffenders).toEqual([]);
  });

  it('every entry that explicitly claims a narrowed (non-FULL_DML-shaped) DML set names its evidence', () => {
    // Entries mechanically converted from the old FULL_DML enum (see the
    // 2026-09 privilege-model migration) are explicitly NOT yet reviewed at
    // the per-operation level and are exempt — only entries whose reason
    // text claims a deliberately narrowed set (e.g. "not defaulted to
    // FULL_DML") must actually justify DELETE if they include it.
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.requiredRuntimePrivileges === 'TBD') continue;
      if (!entry.requiredRuntimePrivileges.includes('DELETE')) continue;
      const claimsNarrowedReview = /not defaulted to FULL_DML|narrowed|least-privilege/i.test(entry.reason);
      if (!claimsNarrowedReview) continue; // legacy mechanical conversion, not yet reviewed — exempt
      const reasonMentionsDelete = /delet/i.test(entry.reason);
      if (!reasonMentionsDelete) offenders.push(entry.table);
    }
    expect(offenders).toEqual([]);
  });

  it('organization_billing_config is SYSTEM_ONLY with empty tenant runtime privileges (PR #752 round-3 correction)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'organization_billing_config');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('SYSTEM_ONLY');
    expect(privilegesOf(entry!)).toEqual([]);
    expect(entry!.executionAuthority).toBe('PLATFORM_ADMIN');
  });

  it("notification_history's reason explicitly prohibits the OR organization_id IS NULL policy pattern (not merely mentions nullability)", () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'notification_history');
    expect(entry).toBeTruthy();
    expect(entry!.reason).toMatch(/must NOT be written as organization_id = current_org OR organization_id IS NULL/i);
    expect(entry!.reason).toMatch(/fail closed/i);
  });
});
