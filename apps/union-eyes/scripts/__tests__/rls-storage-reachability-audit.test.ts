/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * Regression coverage for scripts/rls-storage-reachability-audit.ts,
 * anchored on the real false-classification bug found during PR #752 round
 * 6: a table with a same-named services/financial-service declaration must
 * NOT be proposed SEPARATE_DATABASE_BOUNDARY if a real, unused union-eyes-
 * native pgTable() declaration also exists elsewhere in db/schema/** — the
 * correct proposal in that case is LATENT_UNREACHABLE.
 */
import { describe, expect, it } from 'vitest';
import { analyzeTable } from '../rls-storage-reachability-audit';

describe('rls-storage-reachability-audit', () => {
  // NOTE (round 7): every table previously believed to be a "true, verified"
  // SEPARATE_DATABASE_BOUNDARY example in this manifest (organizing_contacts,
  // stripe_webhook_events) turned out to ALSO have a real, hidden multi-line
  // union-eyes-native pgTable() declaration once searched with this tool's
  // full-repo, multi-line-aware method — both were corrected to
  // LATENT_UNREACHABLE. As of this test file's date, no confirmed-correct
  // SEPARATE_DATABASE_BOUNDARY example is known to exist in this codebase;
  // this test suite therefore only asserts the REGRESSION behavior (the tool
  // must never collapse "has a financial-service declaration" into
  // SEPARATE_DATABASE_BOUNDARY without first proving no union-eyes-native
  // declaration exists anywhere), not a specific positive example.

  it('REGRESSION: does not propose SEPARATE_DATABASE_BOUNDARY for a table with a real (unused) union-eyes-native declaration that also happens to share a name with a financial-service table', () => {
    // room_bookings: has a genuine union-eyes-native declaration
    // (db/schema/domains/scheduling/calendar.ts + db/schema/calendar-schema.ts,
    // duplicate-schema pattern) that is currently unreachable from
    // production code, AND a same-named table in services/financial-service.
    // The naive "supportingCapability only shows financial-service" signal
    // must not collapse this into SEPARATE_DATABASE_BOUNDARY.
    const result = analyzeTable('room_bookings');
    expect(result.declarations.some((d) => !d.isFinancialService)).toBe(true);
    expect(result.proposedClassification).not.toBe('SEPARATE_DATABASE_BOUNDARY');
    expect(result.proposedClassification).toBe('LATENT_UNREACHABLE');
  });

  it('REGRESSION: same pattern for ue_governance_job_execution_state (has its own organization_id column)', () => {
    const result = analyzeTable('ue_governance_job_execution_state');
    const nativeDecl = result.declarations.find((d) => !d.isFinancialService);
    expect(nativeDecl).toBeDefined();
    expect(nativeDecl?.hasOrganizationIdColumn).toBe(true);
    expect(result.proposedClassification).not.toBe('SEPARATE_DATABASE_BOUNDARY');
  });

  it('proposes LATENT_UNREACHABLE for a table with zero declarations and zero usage', () => {
    const result = analyzeTable('this_table_definitely_does_not_exist_anywhere_xyz');
    expect(result.declarations).toEqual([]);
    expect(result.proposedClassification).toBe('LATENT_UNREACHABLE');
  });

  it('proposes UNKNOWN_REQUIRES_REVIEW (never a specific authority class) when real usage is found', () => {
    const result = analyzeTable('deadline_reminders');
    expect(result.usageFiles.length).toBeGreaterThan(0);
    expect(result.proposedClassification).toBe('UNKNOWN_REQUIRES_REVIEW');
    // Must never propose a specific authority classification — that always
    // requires human review of ownership/minimum-privilege.
    expect(result.proposalReason).toContain('Requires human review');
  });

  it('never returns a proposal that itself claims to be a final TENANT_RLS_REQUIRED/SYSTEM_ONLY/USER_RLS_REQUIRED disposition', () => {
    const tables = ['organizing_contacts', 'room_bookings', 'deadline_reminders', 'icra_assessments'];
    for (const table of tables) {
      const result = analyzeTable(table);
      expect(['LATENT_UNREACHABLE', 'SEPARATE_DATABASE_BOUNDARY', 'UNKNOWN_REQUIRES_REVIEW']).toContain(
        result.proposedClassification,
      );
    }
  });
});
