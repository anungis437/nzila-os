/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 49: IMMUTABLE_SECURITY_AND_AUDIT_EVIDENCE_AUTHORITY —
 * establishes IMMUTABLE_SECURITY_EVIDENCE as a reusable doctrine: audit/
 * security evidence has fundamentally different authority semantics from
 * ordinary CRUD. The actor recorded in an event is not automatically
 * authorized to write it; the subject of an event is not automatically
 * authorized to read it; evidence should normally be append-only; tenant
 * and parent/subject attribution must be immutable; privileged readers
 * must be separately proven; system-generated evidence must use the
 * correct execution principal.
 *
 * Investigation universe (the 13 tables named by the round spec):
 *   deadline_audit_events, certification_audit_log, conflict_audit_log,
 *   firewall_compliance_audit, location_tracking_audit,
 *   correspondence_audit_trail, signature_audit_log, signature_audit_trail,
 *   employer_access_attempts, break_glass_activations,
 *   access_justification_requests, security_events,
 *   security_posture_checks.
 *
 * CLOSED this round (13 tables):
 *   TENANT_RLS_REQUIRED: deadline_audit_events, signature_audit_trail,
 *     security_events, security_posture_checks
 *   PARENT_OWNED_RLS_REQUIRED: correspondence_audit_trail
 *   USER_RLS_REQUIRED: location_tracking_audit
 *   CONTAINED_NO_AUTHORITY: certification_audit_log, conflict_audit_log,
 *     firewall_compliance_audit, signature_audit_log,
 *     employer_access_attempts, break_glass_activations,
 *     access_justification_requests
 *
 * SECURITY DEFECTS FOUND AND FIXED (real, exploitable):
 *   1. location_tracking_audit's sibling table location tracking —
 *      app/api/location/track/route.ts took userId from the client body
 *      (actor/subject confusion), letting any authenticated caller submit
 *      fabricated GPS coordinates attributed to another consenting
 *      member. Fixed: userId now always derives from getCurrentUser().
 *   2. signature_audit_trail — app/api/signatures/audit/[documentId]/route.ts
 *      had zero document-ownership verification, a cross-tenant IDOR
 *      letting any authenticated user read any organization's signature
 *      document audit trail. Fixed: added the same
 *      SignatureService.verifyDocumentAccess() check already used by the
 *      sibling documents/[id]/route.ts.
 *   3. security_events — app/api/security/events/route.ts's crudRoutes
 *      config used readRole:'member'/writeRole:'steward', far more
 *      permissive than the security dashboard's own
 *      hasMinRole('security_manager') gate: any member could read all
 *      security events directly via the API, and any steward could
 *      fabricate self-authored security event records. Fixed: both roles
 *      tightened to 'security_manager'.
 *   4. deadline_audit_events — app/api/cron/deadline-overdue/route.ts
 *      wrote via the ambient db import outside its own withSystemContext
 *      block (system-job-writes-via-tenant-runtime mismatch). Fixed:
 *      writeDeadlineAuditEvent() now accepts an optional explicit `tx`,
 *      and the cron route threads it through withSystemContext.
 *
 * DJANGO CONTAINMENT: 11 ViewSets across compliance/content/core apps and
 * 4 standalone services/api ViewSets (EmployerNonInterferenceService,
 * FounderConflictService, BreakGlassService, CertificationManagementService)
 * were switched to DenyAllPermission — see
 * backend/compliance/tests_round49_evidence_containment.py.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';

const APP_ROOT = resolve(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

function entryFor(table: string) {
  const entry = storageAuthorityManifest.find((e) => e.table === table);
  expect(entry, `${table}: no manifest entry found`).toBeTruthy();
  return entry!;
}

/* ── Closed cohort: manifest shape assertions ─────────────────────────── */

describe('round 49 closed cohort classifications', () => {
  const expected: Record<string, string> = {
    deadline_audit_events: 'TENANT_RLS_REQUIRED',
    signature_audit_trail: 'TENANT_RLS_REQUIRED',
    security_events: 'TENANT_RLS_REQUIRED',
    security_posture_checks: 'TENANT_RLS_REQUIRED',
    correspondence_audit_trail: 'PARENT_OWNED_RLS_REQUIRED',
    location_tracking_audit: 'USER_RLS_REQUIRED',
    certification_audit_log: 'CONTAINED_NO_AUTHORITY',
    conflict_audit_log: 'CONTAINED_NO_AUTHORITY',
    firewall_compliance_audit: 'CONTAINED_NO_AUTHORITY',
    signature_audit_log: 'CONTAINED_NO_AUTHORITY',
    employer_access_attempts: 'CONTAINED_NO_AUTHORITY',
    break_glass_activations: 'CONTAINED_NO_AUTHORITY',
    access_justification_requests: 'CONTAINED_NO_AUTHORITY',
  };

  it.each(Object.entries(expected))('%s is closed as %s with fully resolved authority', (table, classification) => {
    const entry = entryFor(table);
    expect(entry.classification).toBe(classification);
    expect(entry.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry.invocationAuthority).not.toBe('TBD');
    expect(entry.dbExecutionPrincipal).not.toBe('TBD');
  });
});

describe('round 49 append-only doctrine: evidence tables carry no UPDATE/DELETE unless justified', () => {
  const appendOnlyTables = ['deadline_audit_events', 'location_tracking_audit'];

  it.each(appendOnlyTables)('%s requires only SELECT/INSERT at the runtime layer', (table) => {
    const entry = entryFor(table);
    const ops = Array.isArray(entry.requiredRuntimePrivileges) ? entry.requiredRuntimePrivileges : [];
    expect(ops).not.toContain('UPDATE');
    expect(ops).not.toContain('DELETE');
  });

  it('deadline_audit_events documents DB-layer immutability enforcement', () => {
    const entry = entryFor('deadline_audit_events');
    expect(entry.reason).toMatch(/trigger/i);
    expect(entry.reason).toMatch(/immutable/i);
  });
});

/* ── Security defect regression ratchets ────────────────────────────────── */

describe('round 49 actor/subject ratchet: location tracking self-service only', () => {
  it('POST /api/location/track no longer accepts userId in the request body schema', () => {
    const src = source('app/api/location/track/route.ts');
    const schemaMatch = src.match(/const locationTrackSchema = z\.object\(\{[\s\S]*?\}\);/);
    expect(schemaMatch, 'locationTrackSchema not found').toBeTruthy();
    expect(schemaMatch![0]).not.toContain('userId');
  });

  it('POST /api/location/track derives userId from getCurrentUser()', () => {
    const src = source('app/api/location/track/route.ts');
    expect(src).toContain('getCurrentUser');
    expect(src).toContain('userId: user.id');
  });
});

describe('round 49 cross-tenant IDOR ratchet: signature audit trail', () => {
  it('GET /api/signatures/audit/[documentId] verifies document access before returning evidence', () => {
    const src = source('app/api/signatures/audit/[documentId]/route.ts');
    expect(src).toContain('SignatureService.verifyDocumentAccess');
    expect(src).toMatch(/FORBIDDEN/);
  });
});

describe('round 49 privileged-reader ratchet: security events', () => {
  it('security/events crud route requires security_manager for both read and write', () => {
    const src = source('app/api/security/events/route.ts');
    expect(src).toContain("readRole: 'security_manager'");
    expect(src).toContain("writeRole: 'security_manager'");
  });
});

describe('round 49 system-principal ratchet: deadline-overdue cron', () => {
  it('writeDeadlineAuditEvent accepts an explicit tx and prefers it over the ambient db import', () => {
    const src = source('lib/deadline-engine/audit.ts');
    expect(src).toMatch(/tx\?:/);
    expect(src).toContain('const executor = tx ?? db;');
  });

  it('the deadline-overdue cron route threads tx from withSystemContext into writeDeadlineAuditEvent', () => {
    const src = source('app/api/cron/deadline-overdue/route.ts');
    expect(src).toMatch(/withSystemContext\(\(tx\)\s*=>\s*writeDeadlineAuditEvent/);
  });
});

/* ── Parent-chain and provenance documentation ratchet ──────────────────── */

describe('round 49 parent-chain ratchet: correspondence audit trail', () => {
  it('all correspondence lifecycle routes guard cross-tenant attachment before appending audit entries', () => {
    const routes = [
      'app/api/correspondence/[id]/sign/route.ts',
      'app/api/correspondence/[id]/approve/route.ts',
      'app/api/correspondence/[id]/dispatch/route.ts',
      'app/api/correspondence/[id]/cancel/route.ts',
      'app/api/correspondence/[id]/revision/route.ts',
      'app/api/correspondence/[id]/submit/route.ts',
    ];
    for (const route of routes) {
      const src = source(route);
      expect(src, `${route} missing cross-tenant guard`).toContain('existing.organizationId !== organizationId');
      expect(src, `${route} missing trusted actor provenance`).toContain('actorUserId: userId!');
    }
  });
});
