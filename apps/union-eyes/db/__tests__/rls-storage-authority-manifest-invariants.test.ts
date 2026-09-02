/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Structural invariants for db/rls-storage-authority-manifest.ts's
 * privilege model (requiredRuntimePrivileges/requiredSystemPrivileges) and
 * the two-axis authority model (invocationAuthority: who invokes;
 * dbExecutionPrincipal: which Postgres role executes), added across PR
 * #752 review rounds 3-4 to make this manifest a faithful input to
 * eventual least-privilege SQL GRANT generation for BOTH
 * union_eyes_runtime and union_eyes_system.
 *
 * Round 4 correction: a single `executionAuthority` field conflated "who
 * authorized this" (an application-level question) with "which DB role
 * executes it" (a Postgres-grant question) — organization_billing_config
 * and clc_organization_sync_log are both PLATFORM_ADMIN-invoked but
 * SYSTEM_RUNTIME-executed, which the old single field couldn't express
 * without treating PLATFORM_ADMIN as an exception to the SYSTEM_ONLY
 * privilege invariant. That exception is now removed: the invariant is
 * unconditional.
 */
import { describe, expect, it } from 'vitest';
import {
  storageAuthorityManifest,
} from '../rls-storage-authority-manifest';

const RUNTIME_OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
const INVOCATION_AUTHORITIES = [
  'TENANT_USER', 'PLATFORM_ADMIN', 'SYSTEM_SCHEDULE', 'WEBHOOK', 'WORKER', 'MIXED', 'NONE', 'TBD',
] as const;
const DB_EXECUTION_PRINCIPALS = ['TENANT_RUNTIME', 'SYSTEM_RUNTIME', 'MIXED', 'NONE', 'TBD'] as const;

function opsOf(value: readonly string[] | 'TBD'): string[] {
  return value === 'TBD' ? [] : [...value];
}

describe('rls-storage-authority-manifest privilege/authority invariants', () => {
  it('every entry declares a recognized requiredRuntimePrivileges value (array of valid operations, or the literal "TBD")', () => {
    for (const entry of storageAuthorityManifest) {
      if (entry.requiredRuntimePrivileges === 'TBD') continue;
      expect(Array.isArray(entry.requiredRuntimePrivileges), `${entry.table}: expected array or 'TBD'`).toBe(true);
      for (const op of entry.requiredRuntimePrivileges) {
        expect(RUNTIME_OPERATIONS as readonly string[], `${entry.table}: unrecognized runtime operation ${op}`).toContain(op);
      }
    }
  });

  it('every entry declares a recognized requiredSystemPrivileges value (array of valid operations, or the literal "TBD")', () => {
    for (const entry of storageAuthorityManifest) {
      if (entry.requiredSystemPrivileges === 'TBD') continue;
      expect(Array.isArray(entry.requiredSystemPrivileges), `${entry.table}: expected array or 'TBD'`).toBe(true);
      for (const op of entry.requiredSystemPrivileges) {
        expect(RUNTIME_OPERATIONS as readonly string[], `${entry.table}: unrecognized system operation ${op}`).toContain(op);
      }
    }
  });

  it('no entry lists a duplicate operation in requiredRuntimePrivileges or requiredSystemPrivileges', () => {
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      const runtimeOps = opsOf(entry.requiredRuntimePrivileges);
      const systemOps = opsOf(entry.requiredSystemPrivileges);
      if (new Set(runtimeOps).size !== runtimeOps.length) offenders.push(`${entry.table} (runtime)`);
      if (new Set(systemOps).size !== systemOps.length) offenders.push(`${entry.table} (system)`);
    }
    expect(offenders).toEqual([]);
  });

  it('every entry declares a recognized invocationAuthority and dbExecutionPrincipal value', () => {
    for (const entry of storageAuthorityManifest) {
      expect(INVOCATION_AUTHORITIES as readonly string[], `${entry.table}: unrecognized invocationAuthority ${entry.invocationAuthority}`).toContain(
        entry.invocationAuthority,
      );
      expect(DB_EXECUTION_PRINCIPALS as readonly string[], `${entry.table}: unrecognized dbExecutionPrincipal ${entry.dbExecutionPrincipal}`).toContain(
        entry.dbExecutionPrincipal,
      );
    }
  });

  it('PERMANENT INVARIANT: SYSTEM_ONLY entries never have dbExecutionPrincipal TENANT_RUNTIME or MIXED, regardless of invocationAuthority', () => {
    // No exception for PLATFORM_ADMIN or any other invoker — a privileged
    // request authorizer never justifies giving union_eyes_runtime access
    // to a SYSTEM_ONLY table. See organization_billing_config and
    // clc_organization_sync_log for the corrected pattern (PLATFORM_ADMIN
    // invokes, SYSTEM_RUNTIME executes).
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'SYSTEM_ONLY') continue;
      if (entry.dbExecutionPrincipal === 'TENANT_RUNTIME' || entry.dbExecutionPrincipal === 'MIXED') {
        offenders.push(`${entry.table} (dbExecutionPrincipal=${entry.dbExecutionPrincipal})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('PERMANENT INVARIANT: SYSTEM_ONLY entries carry zero union_eyes_runtime privileges, unconditionally', () => {
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'SYSTEM_ONLY') continue;
      if (opsOf(entry.requiredRuntimePrivileges).length > 0) offenders.push(entry.table);
    }
    expect(offenders).toEqual([]);
  });

  it('PERMANENT INVARIANT: LATENT_UNREACHABLE entries have zero privileges on both roles and NONE/NONE authority', () => {
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'LATENT_UNREACHABLE') continue;
      if (opsOf(entry.requiredRuntimePrivileges).length > 0) offenders.push(`${entry.table} (runtime privileges)`);
      if (opsOf(entry.requiredSystemPrivileges).length > 0) offenders.push(`${entry.table} (system privileges)`);
      if (entry.invocationAuthority !== 'NONE') offenders.push(`${entry.table} (invocationAuthority=${entry.invocationAuthority})`);
      if (entry.dbExecutionPrincipal !== 'NONE') offenders.push(`${entry.table} (dbExecutionPrincipal=${entry.dbExecutionPrincipal})`);
    }
    expect(offenders).toEqual([]);
  });

  it('every entry that explicitly claims a narrowed (non-FULL_DML-shaped) DML set names its evidence', () => {
    // Entries mechanically converted from the old FULL_DML enum are
    // explicitly NOT yet reviewed at the per-operation level and are
    // exempt — only entries whose reason text claims a deliberately
    // narrowed set (e.g. "not defaulted to FULL_DML") must actually
    // justify DELETE if they include it.
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

  it('organization_billing_config: PLATFORM_ADMIN invokes, SYSTEM_RUNTIME executes, zero tenant-runtime privileges (PR #752 round-4 correction)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'organization_billing_config');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('SYSTEM_ONLY');
    expect(opsOf(entry!.requiredRuntimePrivileges)).toEqual([]);
    expect(entry!.invocationAuthority).toBe('PLATFORM_ADMIN');
    expect(entry!.dbExecutionPrincipal).toBe('SYSTEM_RUNTIME');
    expect(opsOf(entry!.requiredSystemPrivileges)).toEqual(['SELECT']);
  });

  it('clc_organization_sync_log: PLATFORM_ADMIN invokes, SYSTEM_RUNTIME executes, zero tenant-runtime privileges (PR #752 round-4 fix — was previously read via ordinary db despite the role gate)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'clc_organization_sync_log');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('SYSTEM_ONLY');
    expect(opsOf(entry!.requiredRuntimePrivileges)).toEqual([]);
    expect(entry!.invocationAuthority).toBe('PLATFORM_ADMIN');
    expect(entry!.dbExecutionPrincipal).toBe('SYSTEM_RUNTIME');
    expect(opsOf(entry!.requiredSystemPrivileges)).toEqual(['SELECT']);
  });

  it("notification_history's reason explicitly prohibits the OR organization_id IS NULL policy pattern (not merely mentions nullability)", () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'notification_history');
    expect(entry).toBeTruthy();
    expect(entry!.reason).toMatch(/must NOT be written as organization_id = current_org OR organization_id IS NULL/i);
    expect(entry!.reason).toMatch(/fail closed/i);
  });
});

