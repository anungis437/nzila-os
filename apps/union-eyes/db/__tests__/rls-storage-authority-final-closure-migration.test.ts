/**
 * Contract tests for the storage-authority RLS FINAL closure migration
 * (db/migrations-cache/0012_storage_authority_rls_final_closure.sql).
 *
 * 0010 carried 0108's 24-table foundation forward; 0011 closed the 144-table
 * org-column delta; 0012 closes the LAST 55 physically-present, manifest-RLS-
 * required tables whose source-native (Django app 0001_initial) shape diverged
 * from the richer Drizzle schema (dual-lineage collision). After 0012 there is
 * NO physically-present manifest-RLS-required table without a policy owner.
 *
 * These tests pin the STATIC shape of 0012 (the exact 55-table policy-owner
 * set by geometry family, the 20 fail-closed authority-column additions, and
 * scope discipline) so it cannot silently drop a table, invent an authority
 * value, or drift into role/grant work. Live enforcement is proven separately
 * by `pnpm rls:verify` (checkManifestRlsRequiredCoverage) and the runtime probe.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../..');
const MIGRATIONS_CACHE = path.join(APP_ROOT, 'db', 'migrations-cache');
const JOURNAL_PATH = path.join(MIGRATIONS_CACHE, 'meta', '_journal.json');
const TAG = '0012_storage_authority_rls_final_closure';
const SQL_PATH = path.join(MIGRATIONS_CACHE, `${TAG}.sql`);
const ROLLBACK_PATH = path.join(MIGRATIONS_CACHE, `${TAG}.rollback.sql`);
const SQL = fs.readFileSync(SQL_PATH, 'utf8');
const ROLLBACK = fs.readFileSync(ROLLBACK_PATH, 'utf8');

// The proven geometry map (source: db/migrations/20260910_rls_enforcement_
// expansion_round58.sql PART B — generated, drift-ratcheted, 0 blocked).
const DIRECT_ORG = [
  'arbitration_precedents', 'bargaining_notes', 'board_packets', 'budget_pool', 'calendar_events',
  'chat_sessions', 'clause_comparisons', 'clc_sync_log', 'consent_records', 'cookie_consents',
  'defensibility_packs', 'geofences', 'mobile_devices', 'pilot_applications', 'pilot_metrics',
  'policy_rules', 'reward_wallet_ledger', 'strike_fund_disbursements', 'user_consents', 'voting_sessions',
];
const PARENT_OWNED_V2 = [
  'ai_safety_filters', 'alert_executions', 'arbitrations', 'bargaining_proposals', 'board_packet_distributions',
  'chat_messages', 'claim_updates', 'document_signers', 'grievance_timeline', 'newsletter_list_subscribers',
  'newsletter_recipients', 'policy_evaluations', 'policy_exceptions', 'settlements', 'signature_audit_trail',
  'tentative_agreements', 'voter_eligibility', 'votes', 'voting_options',
];
const USER_SELF = [
  'data_subject_access_requests', 'gdpr_data_requests', 'geofence_events', 'location_tracking',
  'location_tracking_audit', 'member_location_consent', 'profiles', 'provincial_consent',
  'provincial_data_handling', 'workbooks',
];
const PARENT_VIA_USER = [
  'workbook_governance_lineage_entries', 'workbook_memory_holders', 'workbook_modules', 'workbook_purchases',
];
const SHARED_LIBRARY = ['shared_clause_library'];
const SHARED_LIBRARY_CHILD = ['clause_library_tags'];
const ALL_55 = [
  ...DIRECT_ORG, ...PARENT_OWNED_V2, ...USER_SELF, ...PARENT_VIA_USER, ...SHARED_LIBRARY, ...SHARED_LIBRARY_CHILD,
];
// Columns 0012 must add (19 tables, 20 columns) — verbatim from 20260913/20260914.
const COLUMN_ADDS: [string, string][] = [
  ['chat_sessions', 'organization_id'], ['board_packets', 'organization_id'], ['policy_rules', 'organization_id'],
  ['voting_sessions', 'organization_id'], ['bargaining_notes', 'organization_id'], ['budget_pool', 'organization_id'],
  ['calendar_events', 'organization_id'], ['clause_comparisons', 'organization_id'], ['clc_sync_log', 'organization_id'],
  ['consent_records', 'organization_id'], ['cookie_consents', 'organization_id'], ['defensibility_packs', 'organization_id'],
  ['geofences', 'union_local_id'], ['mobile_devices', 'organization_id'], ['pilot_metrics', 'organization_id'],
  ['reward_wallet_ledger', 'org_id'], ['strike_fund_disbursements', 'organization_id'], ['user_consents', 'organization_id'],
  ['shared_clause_library', 'sharing_level'], ['shared_clause_library', 'shared_with_org_ids'],
];

function nonComment(src: string): string {
  return src.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
}
const BODY = nonComment(SQL);

describe('0012 storage-authority RLS final closure — journal', () => {
  it('is registered as idx 12 in the scoped journal', () => {
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
    const entry = journal.entries.find((e: { tag: string }) => e.tag === TAG);
    expect(entry).toBeDefined();
    expect(entry.idx).toBe(12);
  });
});

describe('0012 — 55-table policy-owner coverage by geometry family', () => {
  it('closes exactly the 55 expected tables (no more, no fewer)', () => {
    expect(new Set(ALL_55).size).toBe(55);
  });
  for (const t of DIRECT_ORG) {
    it(`direct-org: ${t} calls ue_create_direct_org_rls_policy`, () => {
      expect(BODY).toMatch(new RegExp(`ue_create_direct_org_rls_policy\\('${t}'`));
    });
  }
  for (const t of PARENT_OWNED_V2) {
    it(`parent-owned: ${t} calls ue_create_parent_owned_rls_policy_v2`, () => {
      expect(BODY).toMatch(new RegExp(`ue_create_parent_owned_rls_policy_v2\\('${t}'`));
    });
  }
  for (const t of USER_SELF) {
    it(`user-self: ${t} calls ue_create_user_rls_policy`, () => {
      expect(BODY).toMatch(new RegExp(`ue_create_user_rls_policy\\('${t}'`));
    });
  }
  for (const t of PARENT_VIA_USER) {
    it(`parent-via-user: ${t} calls ue_create_parent_owned_via_user_rls_policy_v2`, () => {
      expect(BODY).toMatch(new RegExp(`ue_create_parent_owned_via_user_rls_policy_v2\\('${t}'`));
    });
  }
  it('shared_clause_library calls ue_create_shared_library_rls_policy', () => {
    expect(BODY).toMatch(/ue_create_shared_library_rls_policy\('shared_clause_library'/);
  });
  it('clause_library_tags calls ue_create_shared_library_child_rls_policy', () => {
    expect(BODY).toMatch(/ue_create_shared_library_child_rls_policy\('clause_library_tags'/);
  });
});

describe('0012 — fail-closed authority-column prerequisites', () => {
  for (const [table, col] of COLUMN_ADDS) {
    it(`adds ${table}.${col} guarded by a fail-closed emptiness assertion`, () => {
      // the ADD COLUMN statement exists
      expect(BODY).toMatch(new RegExp(`ALTER TABLE ${table} ADD COLUMN ${col}\\b`));
    });
  }
  it('every ADD COLUMN is preceded by a RAISE EXCEPTION (never invent an authority value)', () => {
    // one RAISE EXCEPTION guard per ADD COLUMN (20 adds -> at least 20 guards)
    const adds = (BODY.match(/ADD COLUMN/g) ?? []).length;
    const guards = (BODY.match(/RAISE EXCEPTION '0012 aborted/g) ?? []).length;
    expect(adds).toBe(20);
    expect(guards).toBeGreaterThanOrEqual(19);
  });
});

describe('0012 — scope discipline (RLS + prerequisite columns ONLY)', () => {
  it('creates no roles and sets no passwords', () => {
    expect(BODY).not.toMatch(/CREATE\s+ROLE/i);
    expect(BODY).not.toMatch(/ALTER\s+ROLE/i);
    expect(BODY).not.toMatch(/PASSWORD/i);
  });
  it('does not GRANT baseline DML (0009 owns grants)', () => {
    expect(BODY).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
  });
  it('does not redefine 0010\'s ue_create_direct_org_rls_policy helper', () => {
    expect(BODY).not.toMatch(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy/);
  });
});

describe('0012 — disjoint from 0011 (single-owner discipline)', () => {
  it('shares no policy-owned table with 0011', () => {
    const sql0011 = fs.readFileSync(path.join(MIGRATIONS_CACHE, '0011_storage_authority_rls_completion.sql'), 'utf8');
    const owned0011 = new Set(
      [...sql0011.matchAll(/ue_create_(?:direct_org|user_self|mixed_global_tenant|multi_party)_rls_policy\('([a-z_]+)'/g)].map((m) => m[1]),
    );
    const overlap = ALL_55.filter((t) => owned0011.has(t));
    expect(overlap).toEqual([]);
  });
});

describe('0012 rollback — TEST/DEV inverse', () => {
  it('drops the 20 added columns and the 5 new helper functions', () => {
    for (const [table, col] of COLUMN_ADDS) {
      expect(ROLLBACK).toMatch(new RegExp(`ALTER TABLE IF EXISTS ${table} DROP COLUMN IF EXISTS ${col}`));
    }
    for (const fn of [
      'ue_create_parent_owned_rls_policy_v2', 'ue_create_user_rls_policy',
      'ue_create_parent_owned_via_user_rls_policy_v2', 'ue_create_shared_library_rls_policy',
      'ue_create_shared_library_child_rls_policy',
    ]) {
      expect(ROLLBACK).toMatch(new RegExp(`DROP FUNCTION IF EXISTS ${fn}`));
    }
  });
});
