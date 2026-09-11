/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 44: RESOLVED_PARENT_ROOT_BATCH — mechanically derived the
 * 49-table PARENT_OWNED:parent:HIGH + PARENT_OWNED:parent:NORMAL candidate
 * universe, then fast-pathed only the subset whose complete authority
 * chain already resolves to a previously closed, trustworthy tenant-owned
 * root (13 tables had allDirectParentsTrusted=true at the starting head).
 *
 * KEY FINDING THIS ROUND: a trusted parent does NOT imply the child is
 * legitimately parent-owned tenant data — several of the 13 "trusted"
 * candidates turned out to be dead TS code with an exposed Django
 * surface (bargaining_team_members, negotiation_sessions,
 * voting_notifications, voting_audit_log, precedent_tags,
 * wage_progressions, benefit_comparisons), closed CONTAINED_NO_AUTHORITY
 * rather than PARENT_OWNED_RLS_REQUIRED. Only clause_embeddings,
 * correspondence_recipients, voter_eligibility, and policy_exceptions
 * were genuinely reachable, safe, parent-verified tenant paths, plus
 * policy_evaluations (a MIXED-authority close after a concrete defect
 * fix — see below).
 *
 * ALSO THIS ROUND: while verifying "nothing should be dead" before
 * closing ticket_comments/ticket_history/whiplash_violations/
 * whiplash_prevention_audit against their (assumed-dead) parent
 * support_tickets, a genuine live consumer of support_tickets was found
 * that round 40's scan had missed — three cross-organization executive
 * dashboards (app/[locale]/dashboard/support, customer-success,
 * sector-analytics) execute real raw SQL against support_tickets. This
 * invalidated round 40's CONTAINED_NO_AUTHORITY closure for
 * support_tickets (corrected to SYSTEM_ONLY) and uncovered a genuine
 * SECURITY DEFECT: all three pages gated cross-organization data behind
 * an ordinary per-organization role name (hasMinRole) instead of
 * genuine platform-staff authority — fixed to use isSystemAdmin(). The
 * same defect class was independently found and fixed in
 * app/api/governance/telemetry/route.ts (policy_evaluations /
 * governanceEvents cross-org aggregate).
 *
 * CLOSED (17 tables):
 *   PARENT_OWNED_RLS_REQUIRED: clause_embeddings, correspondence_recipients,
 *     voter_eligibility, policy_exceptions, policy_evaluations (MIXED)
 *   CONTAINED_NO_AUTHORITY: bargaining_team_members, negotiation_sessions,
 *     voting_notifications, voting_audit_log, precedent_tags,
 *     wage_progressions, benefit_comparisons, ticket_comments,
 *     ticket_history, whiplash_violations, whiplash_prevention_audit
 *   SYSTEM_ONLY (corrected round 40 regression): support_tickets
 *
 * EXCEPTIONS retained (dual-schema, round 42): votes, voting_options —
 * independently Django-contained this round regardless of TS status.
 *
 * The remaining 34 candidates all had allDirectParentsTrusted=false at
 * the starting head (their own direct parent was itself NEEDS_REVIEW or
 * ambiguous) and were mechanically ineligible for the fast path; they
 * remain NEEDS_REVIEW, ejected to the exception queue documented in the
 * round-44 completion report (not manifest-modified, since their
 * classification is unchanged).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { findDjangoModel, toPascalCase } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

/* ── Closed cohort: manifest shape assertions ─────────────────────────── */

const PARENT_OWNED_COHORT = [
  { table: 'clause_embeddings', runtime: ['SELECT'] },
  { table: 'correspondence_recipients', runtime: ['SELECT', 'INSERT'] },
  { table: 'voter_eligibility', runtime: ['SELECT'] },
  { table: 'policy_exceptions', runtime: ['SELECT'] },
] as const;

describe.each(PARENT_OWNED_COHORT)('round 44 PARENT_OWNED_RLS_REQUIRED: $table', ({ table, runtime }) => {
  it('is classified with the proven authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('PARENT_OWNED_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(runtime);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe('round 44 MIXED authority close: policy_evaluations', () => {
  it('has the proven mixed tenant-insert / platform-admin-read shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'policy_evaluations');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('PARENT_OWNED_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['INSERT']);
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT']);
    expect(entry!.invocationAuthority).toBe('MIXED');
    expect(entry!.dbExecutionPrincipal).toBe('MIXED');
  });
});

const CONTAINED_COHORT = [
  'bargaining_team_members',
  'negotiation_sessions',
  'voting_notifications',
  'voting_audit_log',
  'precedent_tags',
  'wage_progressions',
  'benefit_comparisons',
  'ticket_comments',
  'ticket_history',
  'whiplash_violations',
  'whiplash_prevention_audit',
] as const;

describe.each(CONTAINED_COHORT)('round 44 CONTAINED_NO_AUTHORITY: %s', (table) => {
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

describe('round 44 regression correction: support_tickets', () => {
  it('is corrected from round-40 CONTAINED_NO_AUTHORITY to SYSTEM_ONLY (real platform-admin consumer found)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'support_tickets');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('SYSTEM_ONLY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT']);
    expect(entry!.invocationAuthority).toBe('PLATFORM_ADMIN');
    expect(entry!.dbExecutionPrincipal).toBe('SYSTEM_RUNTIME');
  });
});

describe('round 44: no TBD authority fields remain on the closed cohort', () => {
  const ALL_CLOSED = [
    ...PARENT_OWNED_COHORT.map((r) => r.table),
    'policy_evaluations',
    ...CONTAINED_COHORT,
    'support_tickets',
  ];

  it.each(ALL_CLOSED)('%s has no TBD fields', (table) => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry!.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry!.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry!.invocationAuthority).not.toBe('TBD');
    expect(entry!.dbExecutionPrincipal).not.toBe('TBD');
  });
});

/* ── Resolved-parent-root compiler (reusable ratchet) ─────────────────── */

interface ResolvedParentAuthority {
  table: string;
  parentChain: Array<{ childTable: string; fk: string; parentTable: string }>;
  rootTable: string;
  rootClassification: string;
}

const RESOLVED_PARENT_ROOTS: ResolvedParentAuthority[] = [
  {
    table: 'clause_embeddings',
    parentChain: [{ childTable: 'clause_embeddings', fk: 'clause_id', parentTable: 'cba_clauses' }],
    rootTable: 'cba_clauses',
    rootClassification: 'TENANT_RLS_REQUIRED',
  },
  {
    table: 'correspondence_recipients',
    parentChain: [{ childTable: 'correspondence_recipients', fk: 'correspondence_id', parentTable: 'correspondence' }],
    rootTable: 'correspondence',
    rootClassification: 'TENANT_RLS_REQUIRED',
  },
  {
    table: 'voter_eligibility',
    parentChain: [
      { childTable: 'voter_eligibility', fk: 'session_id', parentTable: 'voting_sessions' },
      { childTable: 'voter_eligibility', fk: 'member_id', parentTable: 'organization_members' },
    ],
    rootTable: 'voting_sessions',
    rootClassification: 'TENANT_RLS_REQUIRED',
  },
  {
    table: 'policy_exceptions',
    parentChain: [{ childTable: 'policy_exceptions', fk: 'rule_id', parentTable: 'policy_rules' }],
    rootTable: 'policy_rules',
    rootClassification: 'TENANT_RLS_REQUIRED',
  },
  {
    table: 'policy_evaluations',
    parentChain: [{ childTable: 'policy_evaluations', fk: 'rule_id', parentTable: 'policy_rules' }],
    rootTable: 'policy_rules',
    rootClassification: 'TENANT_RLS_REQUIRED',
  },
];

describe('round 44 resolved-parent-root compiler', () => {
  it('every fast-path child has a fully resolvable, acyclic parent chain', () => {
    for (const entry of RESOLVED_PARENT_ROOTS) {
      expect(entry.parentChain.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const edge of entry.parentChain) {
        expect(seen.has(edge.parentTable)).toBe(false);
        seen.add(edge.parentTable);
      }
    }
  });

  it('every resolved root is closed tenant-owned, not NEEDS_REVIEW/global/system/contained', () => {
    const disallowedRootClassifications = [
      'NEEDS_REVIEW',
      'GLOBAL_REFERENCE_DATA',
      'SYSTEM_ONLY',
      'CONTAINED_NO_AUTHORITY',
      'LATENT_UNREACHABLE',
      'SEPARATE_DATABASE_BOUNDARY',
      'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
      'MULTI_PARTY_RLS_REQUIRED',
    ];
    for (const entry of RESOLVED_PARENT_ROOTS) {
      expect(disallowedRootClassifications).not.toContain(entry.rootClassification);
      expect(['TENANT_RLS_REQUIRED', 'PARENT_OWNED_RLS_REQUIRED', 'USER_RLS_REQUIRED']).toContain(
        entry.rootClassification,
      );
    }
  });

  it('the manifest still reflects each stated root classification (no silent drift)', () => {
    for (const entry of RESOLVED_PARENT_ROOTS) {
      const rootEntry = storageAuthorityManifest.find((e) => e.table === entry.rootTable);
      expect(rootEntry, `${entry.rootTable}: no manifest entry found`).toBeTruthy();
      expect(rootEntry!.classification).toBe(entry.rootClassification);
    }
  });

  it('each child in the compiler is itself closed at the expected classification', () => {
    for (const entry of RESOLVED_PARENT_ROOTS) {
      const childEntry = storageAuthorityManifest.find((e) => e.table === entry.table);
      expect(childEntry, `${entry.table}: no manifest entry found`).toBeTruthy();
      expect(childEntry!.classification).toBe('PARENT_OWNED_RLS_REQUIRED');
    }
  });
});

/* ── Django containment fixes ──────────────────────────────────────────── */

describe('round 44 Django containment fixes', () => {
  it.each([
    ['bargaining_team_members', 'BargainingTeamMembers', 'backend/bargaining/views.py'],
    ['negotiation_sessions', 'NegotiationSessions', 'backend/bargaining/views.py'],
    ['precedent_tags', 'PrecedentTags', 'backend/bargaining/views.py'],
    ['wage_progressions', 'WageProgressions', 'backend/bargaining/views.py'],
    ['benefit_comparisons', 'BenefitComparisons', 'backend/bargaining/views.py'],
    ['voting_notifications', 'VotingNotifications', 'backend/unions/views.py'],
    ['voting_audit_log', 'VotingAuditLog', 'backend/unions/views.py'],
    ['voter_eligibility', 'VoterEligibility', 'backend/unions/views.py'],
    ['voting_options', 'VotingOptions', 'backend/unions/views.py'],
    ['votes', 'Votes', 'backend/unions/views.py'],
    ['policy_exceptions', 'PolicyExceptions', 'backend/compliance/views.py'],
    ['policy_evaluations', 'PolicyEvaluations', 'backend/compliance/views.py'],
    ['ticket_comments', 'TicketComments', 'backend/core/views.py'],
    ['ticket_history', 'TicketHistory', 'backend/core/views.py'],
    ['whiplash_violations', 'WhiplashViolations', 'backend/billing/views.py'],
    ['whiplash_prevention_audit', 'WhiplashPreventionAudit', 'backend/billing/views.py'],
  ] as const)('%s Django ViewSet uses DenyAllPermission', (_table, pascalName, viewSetFile) => {
    const django = findDjangoModel(pascalName);
    expect(django, `${pascalName}: no Django model found`).toBeTruthy();
    expect(django!.routerRegistered, `${pascalName}: should remain router-registered`).toBe(true);
    expect(django!.usesDenyAll, `${pascalName}: must use DenyAllPermission`).toBe(true);
    expect(django!.viewSetFile).toBe(viewSetFile);
  });

  it('sanity check: toPascalCase produces the expected Django model names', () => {
    expect(toPascalCase('bargaining_team_members')).toBe('BargainingTeamMembers');
    expect(toPascalCase('whiplash_prevention_audit')).toBe('WhiplashPreventionAudit');
    expect(toPascalCase('voting_audit_log')).toBe('VotingAuditLog');
  });
});

/* ── Behavioural defect regression tests ───────────────────────────────── */

describe('round 44 defect fix: clause_embeddings similarity scan is organization-scoped', () => {
  it('inner-joins cba_clauses and filters by organizationId before scoring embeddings', () => {
    const src = source('lib/services/clause-intelligence.ts');
    expect(src).toMatch(/\.from\(clauseEmbeddings\)\s*\n\s*\.innerJoin\(cbaClause,\s*eq\(cbaClause\.id,\s*clauseEmbeddings\.clauseId\)\)/);
    expect(src).toMatch(/\.where\(eq\(cbaClause\.organizationId,\s*orgId\)\)/);
  });
});

describe('round 44 defect fix: cross-organization executive dashboards require genuine platform-staff authority', () => {
  const pages = [
    'app/[locale]/dashboard/support/page.tsx',
    'app/[locale]/dashboard/customer-success/page.tsx',
    'app/[locale]/dashboard/sector-analytics/page.tsx',
  ];

  it.each(pages)('%s no longer gates cross-org data with an ordinary per-org role check', (page) => {
    const src = source(page);
    expect(src).not.toMatch(/hasMinRole\(/);
    expect(src).toMatch(/isSystemAdmin\(\)/);
  });
});

describe('round 44 defect fix: governance telemetry cross-org aggregate requires platform-admin authority', () => {
  it('gates the DB-backed cross-organization query behind isSystemAdmin()', () => {
    const src = source('app/api/governance/telemetry/route.ts');
    expect(src).toMatch(/if \(await isSystemAdmin\(\)\)/);
    // The safe in-process-only fallback values must be assigned before the gate.
    const fallbackIndex = src.indexOf('let dbAuditEventVolume = 0');
    const gateIndex = src.indexOf('if (await isSystemAdmin())');
    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeLessThan(gateIndex);
  });
});
