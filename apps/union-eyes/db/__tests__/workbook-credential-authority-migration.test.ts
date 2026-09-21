/**
 * ARTIFACT TYPE: Migration contract test (static)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Proves that 20260921_workbook_credential_and_payment_authority.sql (and its
 * rollback companion) encode the intended policy geometry — system-only claim
 * credential + payment identity, credential-pair consistency, and the exact
 * grant corrections — and that the authority registry is aligned. These are
 * structural assertions over the SQL and the registry, not a single-keyword
 * grep. The behavioral (real-PostgreSQL) proof lives in
 * workbook-credential-authority.postgres.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';

const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');
const FORWARD = readFileSync(
  resolve(MIGRATIONS_DIR, '20260921_workbook_credential_and_payment_authority.sql'),
  'utf8',
);
const ROLLBACK = readFileSync(
  resolve(MIGRATIONS_DIR, '20260921_workbook_credential_and_payment_authority_rollback.sql'),
  'utf8',
);

/** Collapse whitespace to make multi-line SQL assertions robust to formatting. */
const flat = (s: string) => s.replace(/\s+/g, ' ');
const F = flat(FORWARD);
const R = flat(ROLLBACK);

describe('20260921 workbook credential/payment authority — system-principal predicate', () => {
  it('defines a system-principal predicate that admits union_eyes_system only', () => {
    expect(F).toContain('CREATE OR REPLACE FUNCTION ue_is_workbook_system_principal()');
    expect(F).toContain("current_user = 'union_eyes_system'");
  });

  it('does NOT accept superuser or BYPASSRLS status as an application authority', () => {
    // Executable predicate must not reference these at all — not in a comment,
    // not in the SQL. Absence proves they are not an accepted authority path.
    expect(F).not.toMatch(/rolsuper/i);
    expect(F).not.toMatch(/rolbypassrls/i);
    // Nor pg_has_role membership widening — direct authentication is the contract.
    expect(F).not.toMatch(/pg_has_role/i);
  });

  it('does not fall back to a session-settable variable (0108 anti-pattern)', () => {
    expect(F).not.toMatch(/current_setting\(\s*'app\./i);
  });

  it('credential trigger function is SECURITY INVOKER (current_user identifies the caller, not the owner)', () => {
    expect(F).not.toMatch(/SECURITY DEFINER/i);
  });
});

describe('20260921 — credential/payment trigger geometry', () => {
  it('enforces claim-credential pair consistency for every principal', () => {
    expect(F).toContain('CREATE OR REPLACE FUNCTION ue_enforce_workbook_credential_authority()');
    expect(F).toContain('(NEW.claim_token IS NULL) <> (NEW.claim_token_expires_at IS NULL)');
  });

  it('makes claim_token and claim_token_expires_at system-only on both INSERT and UPDATE', () => {
    expect(F).toContain('NEW.claim_token IS DISTINCT FROM OLD.claim_token');
    expect(F).toContain('NEW.claim_token_expires_at IS DISTINCT FROM OLD.claim_token_expires_at');
    expect(F).toContain('NEW.claim_token IS NOT NULL OR NEW.claim_token_expires_at IS NOT NULL');
  });

  it('makes stripe_payment_ref creation/replacement system-only', () => {
    expect(F).toContain('NEW.stripe_payment_ref IS DISTINCT FROM OLD.stripe_payment_ref');
    expect(F).toContain('NEW.stripe_payment_ref IS NOT NULL');
  });

  it('gates the mutation on the system-principal predicate and raises insufficient_privilege', () => {
    expect(F).toMatch(/v_credential_changed OR v_payment_ref_changed\)\s*AND NOT ue_is_workbook_system_principal\(\)/);
    expect(F).toContain("ERRCODE = 'insufficient_privilege'");
  });

  it('attaches the trigger BEFORE INSERT OR UPDATE on workbooks (row level)', () => {
    expect(F).toContain('DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks');
    expect(F).toMatch(
      /CREATE TRIGGER ue_workbook_credential_authority BEFORE INSERT OR UPDATE ON workbooks FOR EACH ROW EXECUTE FUNCTION ue_enforce_workbook_credential_authority\(\)/,
    );
  });

  it('does NOT protect status (legitimately changes at claim) or report_tier_id', () => {
    expect(F).not.toContain('NEW.status IS DISTINCT FROM OLD.status');
    expect(F).not.toContain('NEW.report_tier_id IS DISTINCT FROM OLD.report_tier_id');
  });
});

describe('20260921 — grant corrections', () => {
  it('grants union_eyes_system SELECT (in addition to UPDATE) on workbooks', () => {
    expect(F).toContain('GRANT SELECT, UPDATE ON TABLE workbooks TO union_eyes_system');
  });

  it('preserves runtime SELECT/INSERT/UPDATE on workbooks (not made immutable)', () => {
    expect(F).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE workbooks TO union_eyes_runtime');
  });

  it('grants union_eyes_system SELECT + INSERT on workbook_purchases', () => {
    expect(F).toContain('GRANT SELECT, INSERT ON TABLE workbook_purchases TO union_eyes_system');
  });

  it('grants union_eyes_runtime NO privileges on workbook_purchases', () => {
    expect(F).toContain('REVOKE ALL ON TABLE workbook_purchases FROM union_eyes_runtime');
    expect(F).not.toMatch(/GRANT[^;]*ON TABLE workbook_purchases TO union_eyes_runtime/);
  });

  it('uses no BYPASSRLS / superuser role workaround (grants authority via named-role membership only)', () => {
    // The migration may mention BYPASSRLS in commentary, but must never
    // create/alter a role to grant it bypass or superuser.
    expect(F).not.toMatch(/CREATE ROLE[^;]*BYPASSRLS/i);
    expect(F).not.toMatch(/ALTER ROLE\s+\w+[^;]*(BYPASSRLS|SUPERUSER)/i);
    expect(F).not.toMatch(/CREATE ROLE[^;]*SUPERUSER/i);
  });
});

describe('20260921 — canonical lineage & non-destructive', () => {
  it('does not rewrite the 0108 foundation or round58 helpers', () => {
    // May reference 0108 in commentary, but must not recreate the roles it
    // established or redefine the round58 policy helpers / shared policies.
    expect(F).not.toMatch(/CREATE ROLE union_eyes_(runtime|system)/);
    expect(F).not.toContain('CREATE OR REPLACE FUNCTION ue_create_user_rls_policy');
    expect(F).not.toContain('CREATE OR REPLACE FUNCTION ue_create_parent_owned_via_user_rls_policy_v2');
    // It must not DROP or ALTER the shared RLS policy objects.
    expect(F).not.toMatch(/DROP POLICY[^;]*ue_system_full_access/);
  });

  it('lives in the dated forward lineage with a matching rollback', () => {
    const forward = resolve(MIGRATIONS_DIR, '20260921_workbook_credential_and_payment_authority.sql');
    const rollback = resolve(MIGRATIONS_DIR, '20260921_workbook_credential_and_payment_authority_rollback.sql');
    expect(readFileSync(forward, 'utf8').length).toBeGreaterThan(0);
    expect(readFileSync(rollback, 'utf8').length).toBeGreaterThan(0);
  });
});

describe('20260921 — rollback restores round58 geometry', () => {
  it('drops the trigger and both helper functions', () => {
    expect(R).toContain('DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks');
    expect(R).toContain('DROP FUNCTION IF EXISTS ue_enforce_workbook_credential_authority()');
    expect(R).toContain('DROP FUNCTION IF EXISTS ue_is_workbook_system_principal()');
  });

  it('restores workbooks system grant to UPDATE-only and workbook_purchases system to INSERT-only', () => {
    expect(R).toContain('GRANT UPDATE ON TABLE workbooks TO union_eyes_system');
    expect(R).not.toContain('GRANT SELECT, UPDATE ON TABLE workbooks TO union_eyes_system');
    expect(R).toContain('GRANT INSERT ON TABLE workbook_purchases TO union_eyes_system');
    expect(R).not.toContain('GRANT SELECT, INSERT ON TABLE workbook_purchases TO union_eyes_system');
  });
});

describe('20260921 — authority registry alignment', () => {
  it('workbooks entry requires system SELECT + UPDATE', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'workbooks');
    expect(entry, 'workbooks: no manifest entry').toBeTruthy();
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT', 'UPDATE']);
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE']);
  });

  it('workbook_purchases entry requires system SELECT + INSERT and zero runtime privileges', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'workbook_purchases');
    expect(entry, 'workbook_purchases: no manifest entry').toBeTruthy();
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT', 'INSERT']);
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
  });
});
