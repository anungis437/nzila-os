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
 *
 * Round 5 correction: the SYSTEM_ONLY/LATENT_UNREACHABLE invariants below
 * previously used an `opsOf()` helper that mapped the literal string
 * 'TBD' to an empty array `[]` before checking privilege-count invariants
 * — meaning an UNRESOLVED privilege declaration silently satisfied a
 * "zero privileges" assertion. That conflated "unknown" with "explicitly
 * none": a SYSTEM_ONLY entry that had never been reviewed for its actual
 * requiredRuntimePrivileges would pass the same check as one that was
 * reviewed and genuinely has none. The invariants below now require the
 * literal value `[]` (not `'TBD'`) wherever a privilege/authority field
 * must be "none" — TBD is treated as a distinct, failing state. A new
 * blanket invariant also requires every CLOSED (non-NEEDS_REVIEW)
 * classification to have fully resolved authority (no field may be
 * 'TBD') — 'TBD' is only a legitimate value for entries still classified
 * NEEDS_REVIEW.
 */
import { describe, expect, it } from 'vitest';
import {
  CLOSED_CLASSIFICATIONS,
  storageAuthorityManifest,
} from '../rls-storage-authority-manifest';

const RUNTIME_OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
const INVOCATION_AUTHORITIES = [
  'TENANT_USER', 'PLATFORM_ADMIN', 'SYSTEM_SCHEDULE', 'WEBHOOK', 'WORKER', 'MIXED', 'NONE', 'TBD',
] as const;
const DB_EXECUTION_PRINCIPALS = ['TENANT_RUNTIME', 'SYSTEM_RUNTIME', 'MIXED', 'NONE', 'TBD'] as const;
const CLOSED = new Set<string>(CLOSED_CLASSIFICATIONS as readonly string[]);

// Deliberately DOES NOT map 'TBD' to []. Only use this where a field is
// already known not to be 'TBD' (e.g. after an explicit invariant asserts
// it isn't) — unlike the round-4 helper this replaces, 'TBD' must never
// be silently treated as "explicitly zero".
function opsOf(value: readonly string[] | 'TBD'): string[] {
  if (value === 'TBD') {
    throw new Error("opsOf() called with 'TBD' — check requiredRuntimePrivileges/requiredSystemPrivileges !== 'TBD' before calling opsOf(), do not let TBD silently mean []");
  }
  return [...value];
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
      if (entry.requiredRuntimePrivileges !== 'TBD') {
        const runtimeOps = opsOf(entry.requiredRuntimePrivileges);
        if (new Set(runtimeOps).size !== runtimeOps.length) offenders.push(`${entry.table} (runtime)`);
      }
      if (entry.requiredSystemPrivileges !== 'TBD') {
        const systemOps = opsOf(entry.requiredSystemPrivileges);
        if (new Set(systemOps).size !== systemOps.length) offenders.push(`${entry.table} (system)`);
      }
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

  it('PERMANENT INVARIANT: every CLOSED (non-NEEDS_REVIEW) classification has fully resolved authority — no TBD in invocationAuthority, dbExecutionPrincipal, requiredRuntimePrivileges, or requiredSystemPrivileges', () => {
    // 'TBD' is a legitimate value ONLY for NEEDS_REVIEW entries. A table
    // that has been assigned a closed classification (TENANT_RLS_REQUIRED,
    // SYSTEM_ONLY, LATENT_UNREACHABLE, etc.) but still carries an
    // unresolved authority field is a contradiction: the classification
    // claims the table has been fully reasoned about, but the authority
    // model — the actual input to GRANT generation — has not been. See
    // scripts/rls-verify.ts's checkClosedClassificationAuthorityResolved
    // for the equivalent live/deployment-time enforcement of this rule.
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (!CLOSED.has(entry.classification)) continue;
      if (entry.invocationAuthority === 'TBD') offenders.push(`${entry.table} (invocationAuthority)`);
      if (entry.dbExecutionPrincipal === 'TBD') offenders.push(`${entry.table} (dbExecutionPrincipal)`);
      if (entry.requiredRuntimePrivileges === 'TBD') offenders.push(`${entry.table} (requiredRuntimePrivileges)`);
      if (entry.requiredSystemPrivileges === 'TBD') offenders.push(`${entry.table} (requiredSystemPrivileges)`);
    }
    expect(offenders).toEqual([]);
  });

  it('PERMANENT INVARIANT: SYSTEM_ONLY entries never have dbExecutionPrincipal TENANT_RUNTIME, MIXED, or TBD, regardless of invocationAuthority', () => {
    // No exception for PLATFORM_ADMIN or any other invoker — a privileged
    // request authorizer never justifies giving union_eyes_runtime access
    // to a SYSTEM_ONLY table. See organization_billing_config and
    // clc_organization_sync_log for the corrected pattern (PLATFORM_ADMIN
    // invokes, SYSTEM_RUNTIME executes). TBD is rejected here too — an
    // unresolved dbExecutionPrincipal on a SYSTEM_ONLY table is exactly
    // as unsafe an unknown as TENANT_RUNTIME would be explicit.
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'SYSTEM_ONLY') continue;
      if (
        entry.dbExecutionPrincipal === 'TENANT_RUNTIME' ||
        entry.dbExecutionPrincipal === 'MIXED' ||
        entry.dbExecutionPrincipal === 'TBD'
      ) {
        offenders.push(`${entry.table} (dbExecutionPrincipal=${entry.dbExecutionPrincipal})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('PERMANENT INVARIANT: SYSTEM_ONLY entries carry zero union_eyes_runtime privileges, unconditionally — the literal value must be [], not the unresolved literal \'TBD\'', () => {
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'SYSTEM_ONLY') continue;
      if (entry.requiredRuntimePrivileges === 'TBD') {
        offenders.push(`${entry.table} (requiredRuntimePrivileges is unresolved 'TBD', not the required explicit [])`);
        continue;
      }
      if (opsOf(entry.requiredRuntimePrivileges).length > 0) offenders.push(entry.table);
    }
    expect(offenders).toEqual([]);
  });

  it('PERMANENT INVARIANT: LATENT_UNREACHABLE entries have explicit [] privileges on both roles (never unresolved TBD) and NONE/NONE authority', () => {
    const offenders: string[] = [];
    for (const entry of storageAuthorityManifest) {
      if (entry.classification !== 'LATENT_UNREACHABLE') continue;
      if (entry.requiredRuntimePrivileges === 'TBD') {
        offenders.push(`${entry.table} (requiredRuntimePrivileges is unresolved 'TBD')`);
      } else if (opsOf(entry.requiredRuntimePrivileges).length > 0) {
        offenders.push(`${entry.table} (runtime privileges)`);
      }
      if (entry.requiredSystemPrivileges === 'TBD') {
        offenders.push(`${entry.table} (requiredSystemPrivileges is unresolved 'TBD')`);
      } else if (opsOf(entry.requiredSystemPrivileges).length > 0) {
        offenders.push(`${entry.table} (system privileges)`);
      }
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

  it("notification_history is reclassified LATENT_UNREACHABLE with no reachable code path (round 5 correction — formerly TENANT_RLS_REQUIRED with a nullable-org-id policy-wording requirement that is now moot)", () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'notification_history');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('LATENT_UNREACHABLE');
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
    expect(opsOf(entry!.requiredRuntimePrivileges)).toEqual([]);
    expect(opsOf(entry!.requiredSystemPrivileges)).toEqual([]);
  });
});

