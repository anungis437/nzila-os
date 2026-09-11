/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 42: PARENT_OWNED:parent:HIGH — a mechanically derived
 * cohort of 19 candidates from the census's parent-owned lane (tables with
 * no direct organization_id column, whose tenant authority must instead be
 * proven through a parent-table relationship checked before every read,
 * create, update, or delete).
 *
 * Of the 19 candidates, 5 proved to be a clean archetype fit and are closed
 * here:
 *   - compliance_alerts: RECLASSIFIED to TENANT_RLS_REQUIRED (not
 *     PARENT_OWNED) — the census's orgColumn detector only recognizes the
 *     literal name 'organization_id', missing this table's direct 'org_id'
 *     column.
 *   - employer_reports, ingestion_records, newsletter_recipients,
 *     tentative_agreements: closed PARENT_OWNED_RLS_REQUIRED, each with a
 *     verified verify-parent-then-filter/insert-child code path.
 *
 * 5 more were CONTAINED_NO_AUTHORITY (reachable-but-denied Django,
 * dead/false-positive TS, no legitimate consumer):
 *   account_balance_reconciliation, payment_routing_rules,
 *   separated_payment_transactions (the "whiplash" strike-fund-separation
 *   cluster, following the round-38 payment_classification_policy
 *   precedent), budget_reservations, alert_recipients.
 *
 * The remaining 9 were ejected to the round-42 exception queue (still
 * NEEDS_REVIEW) for reasons including unresolved dual-parent ambiguity
 * (newsletter_list_subscribers), separate-service dual-schema concerns
 * shared with services/financial-service (clause_library_tags, votes,
 * voting_options), mixed authority roots (policy_evaluations), genuinely
 * complex multi-file subsystems (signers), and a deliberately different
 * bearer/pseudonymous security model for a public consumer product
 * (workbook_memory_holders, workbook_modules, workbook_purchases).
 *
 * Five concrete security/logic defects were found and fixed while closing
 * this batch (none of the 5 CLOSED/CONTAINED tables above required all of
 * these — some surfaced while investigating ejected candidates that share
 * a parent or pattern with a closed table):
 *   1. tentative_agreements: app/api/bargaining/tentative-agreements/route.ts
 *      used crud-factory's orgScoped:true on a table with no organizationId
 *      column — a silent no-op exposing every organization's tentative
 *      agreements. Replaced with an explicit parent-verified implementation.
 *   2. lib/services/voting-service.ts's castVote() never verified optionId
 *      belonged to sessionId.
 *   3. app/api/governance/elections/sessions/[id]/vote/route.ts had no
 *      organization filter on GET and no session/option/duplicate-vote
 *      verification on POST (ballot-stuffing risk).
 *   4. app/api/signatures/documents/route.ts accepted a client-supplied
 *      organizationId with zero verification the caller belonged to it.
 * Two Django-side exposure gaps were also found and contained via
 * DenyAllPermission: budget_reservations and alert_recipients.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { findDjangoModel, toPascalCase } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');

interface ClosedRow {
  table: string;
  classification: 'TENANT_RLS_REQUIRED' | 'PARENT_OWNED_RLS_REQUIRED';
  runtime: readonly string[];
}

const CLOSED_COHORT: ClosedRow[] = [
  { table: 'compliance_alerts', classification: 'TENANT_RLS_REQUIRED', runtime: ['SELECT'] },
  { table: 'employer_reports', classification: 'PARENT_OWNED_RLS_REQUIRED', runtime: ['SELECT'] },
  { table: 'ingestion_records', classification: 'PARENT_OWNED_RLS_REQUIRED', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'newsletter_recipients', classification: 'PARENT_OWNED_RLS_REQUIRED', runtime: ['SELECT'] },
  { table: 'tentative_agreements', classification: 'PARENT_OWNED_RLS_REQUIRED', runtime: ['SELECT', 'INSERT'] },
];

describe.each(CLOSED_COHORT)('round 42 PARENT_OWNED_BATCH: $table', ({ table, classification, runtime }) => {
  it('is classified with the proven authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe(classification);
    expect(entry!.requiredRuntimePrivileges).toEqual(runtime);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe('round 42: no TBD authority fields remain on the closed cohort', () => {
  it.each(CLOSED_COHORT)('$table has no TBD fields', ({ table }) => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry!.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry!.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry!.invocationAuthority).not.toBe('TBD');
    expect(entry!.dbExecutionPrincipal).not.toBe('TBD');
  });
});

const CONTAINED_COHORT = [
  'account_balance_reconciliation',
  'payment_routing_rules',
  'separated_payment_transactions',
  'budget_reservations',
  'alert_recipients',
] as const;

describe.each(CONTAINED_COHORT)('round 42 CONTAINED_NO_AUTHORITY: %s', (table) => {
  it('has the strict zero-authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('CONTAINED_NO_AUTHORITY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
  });
});

describe('round 42 Django containment fixes', () => {
  it.each([
    ['budget_reservations', 'backend/unions/views.py'],
    ['alert_recipients', 'backend/core/views.py'],
  ] as const)('%s Django ViewSet uses DenyAllPermission', (table, viewSetFile) => {
    const django = findDjangoModel(toPascalCase(table));
    expect(django, `${table}: no Django model found`).toBeTruthy();
    expect(django!.routerRegistered, `${table}: should remain router-registered`).toBe(true);
    expect(django!.usesDenyAll, `${table}: must use DenyAllPermission`).toBe(true);
    expect(django!.viewSetFile).toBe(viewSetFile);
  });
});

describe('round 42 defect fix: tentative_agreements no longer uses the crud-factory no-op', () => {
  const src = readFileSync(
    resolve(APP_ROOT, 'app/api/bargaining/tentative-agreements/route.ts'),
    'utf8',
  );

  it('does not import or call the crud-factory helper', () => {
    expect(src).not.toMatch(/from ['"].*crud-factory['"]/);
    expect(src).not.toMatch(/crudRoutes\(/);
  });

  it('GET filters through the negotiations parent by organizationId', () => {
    expect(src).toMatch(/innerJoin\(negotiations,\s*eq\(negotiations\.id,\s*tentativeAgreements\.negotiationId\)\)/);
    expect(src).toMatch(/eq\(negotiations\.organizationId,\s*organizationId\)/);
  });

  it('POST verifies the negotiation belongs to the caller organization before insert', () => {
    expect(src).toMatch(
      /and\(eq\(negotiations\.id,\s*negotiationId\),\s*eq\(negotiations\.organizationId,\s*organizationId\)\)/,
    );
    expect(src).toMatch(/negotiationId does not belong to this organization/);
    const checkIndex = src.indexOf('negotiationId does not belong to this organization');
    const insertIndex = src.indexOf('.insert(tentativeAgreements)');
    expect(checkIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(insertIndex);
  });
});

describe('round 42 defect fix: castVote verifies the option belongs to the session', () => {
  it('voting-service.ts rejects an optionId that does not belong to sessionId', () => {
    const src = readFileSync(resolve(APP_ROOT, 'lib/services/voting-service.ts'), 'utf8');
    expect(src).toMatch(/votingOptions\.findFirst/);
    expect(src).toMatch(/Option does not belong to this voting session/);
  });
});

describe('round 42 defect fix: elections vote route is organization- and relationship-scoped', () => {
  const src = readFileSync(
    resolve(APP_ROOT, 'app/api/governance/elections/sessions/[id]/vote/route.ts'),
    'utf8',
  );

  it('GET filters the voting session by organizationId', () => {
    expect(src).toMatch(
      /and\(eq\(votingSessions\.id,\s*id\),\s*eq\(votingSessions\.organizationId,\s*organizationId\)\)/,
    );
  });

  it('POST verifies session org ownership and delegates voter identity/eligibility/duplicate-vote checks to castVote()', () => {
    // Round 57: the inline option-session/duplicate-vote checks (and the
    // client-supplied voterId they trusted) were replaced by delegating to
    // voting-service.ts's castVote(), which derives voterId server-side from
    // the authenticated user and enforces a real eligibility check — see the
    // round-57 defect-fix test file governance-elections-session-vote-idor-fix.route.test.ts.
    expect(src).toMatch(
      /and\(eq\(votingSessions\.id,\s*id\),\s*eq\(votingSessions\.organizationId,\s*organizationId\)\)/,
    );
    expect(src).toMatch(/castVote\(id,\s*parsed\.optionId,\s*userId,\s*parsed\.isAnonymous\)/);
    expect(src).not.toMatch(/voterId:\s*z\.string/);
  });
});

describe('round 42 defect fix: signatures/documents derives organizationId from the authenticated user', () => {
  const src = readFileSync(resolve(APP_ROOT, 'app/api/signatures/documents/route.ts'), 'utf8');

  it('never reads organizationId from client-supplied form data or query params', () => {
    expect(src).not.toMatch(/formData\.get\(["']organizationId["']\)/);
    expect(src).not.toMatch(/searchParams\.get\(["']organizationId["']\)/);
  });

  it('derives organizationId from the trusted user context in both handlers', () => {
    const occurrences = src.match(/const organizationId = user\.organizationId;/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});
