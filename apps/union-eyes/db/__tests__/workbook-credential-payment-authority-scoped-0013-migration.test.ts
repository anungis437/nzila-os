/**
 * ARTIFACT TYPE: Migration contract test (static)
 * DOCTRINE_VERSION: 1.0.0
 *
 * Proves that the SCOPED migration
 *   db/migrations-cache/0013_workbook_credential_payment_authority.sql
 * (and its rollback companion + journal registration) faithfully port the
 * ACCEPTED workbook claim-credential / payment-identity authority control into
 * the governed scoped lineage — system-only claim_token / claim_token_expires_at
 * / stripe_payment_ref, credential-pair consistency for every principal, and the
 * exact BEFORE INSERT/UPDATE trigger geometry — WITHOUT redesigning the control
 * and WITHOUT touching grants (0009), RLS policies (0010-0012), or roles.
 *
 * These are structural assertions over the scoped SQL, its rollback, and the
 * scoped journal — not a single-keyword grep. The behavioral (real-PostgreSQL)
 * proof is executed as part of the governed-bootstrap acceptance run.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CACHE_DIR = resolve(__dirname, '..', 'migrations-cache');
const FORWARD = readFileSync(
  resolve(CACHE_DIR, '0013_workbook_credential_payment_authority.sql'),
  'utf8',
);
const ROLLBACK = readFileSync(
  resolve(CACHE_DIR, '0013_workbook_credential_payment_authority.rollback.sql'),
  'utf8',
);
const JOURNAL = JSON.parse(
  readFileSync(resolve(CACHE_DIR, 'meta', '_journal.json'), 'utf8'),
) as { entries: Array<{ idx: number; version: string; tag: string; breakpoints: boolean }> };

/** Collapse whitespace to make multi-line SQL assertions robust to formatting. */
const flat = (s: string) => s.replace(/\s+/g, ' ');
/** Strip `--` line commentary so absence assertions test EXECUTABLE SQL only
 *  (the header documents what the control deliberately does NOT do — e.g.
 *  "never CASCADE", "BYPASSRLS is not an authority path" — and must not be
 *  mistaken for the control actually doing those things). */
const stripComments = (s: string) => s.replace(/--.*$/gm, '');
const F = flat(FORWARD);
const R = flat(ROLLBACK);
/** Executable-only (comment-stripped) variants for absence assertions. */
const Fcode = flat(stripComments(FORWARD));
const Rcode = flat(stripComments(ROLLBACK));

describe('scoped 0013 — journal registration', () => {
  it('registers idx 13 with the canonical tag and breakpoints enabled', () => {
    const entry = JOURNAL.entries.find((e) => e.idx === 13);
    expect(entry, 'journal: no idx 13 entry').toBeTruthy();
    expect(entry!.tag).toBe('0013_workbook_credential_payment_authority');
    expect(entry!.breakpoints).toBe(true);
  });

  it('is the highest journal index (appended, not inserted mid-lineage)', () => {
    const maxIdx = Math.max(...JOURNAL.entries.map((e) => e.idx));
    expect(maxIdx).toBe(14); // 0014_lineage_restoration_rls_closure appended after 0013
  });

  it('splits into exactly three breakpoint-delimited statements', () => {
    const statements = FORWARD.split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
  });
});

describe('scoped 0013 — system-principal predicate', () => {
  it('defines a predicate that admits union_eyes_system only', () => {
    expect(F).toContain('CREATE OR REPLACE FUNCTION ue_is_workbook_system_principal()');
    expect(F).toContain("current_user = 'union_eyes_system'");
  });

  it('does NOT accept superuser / BYPASSRLS / pg_has_role widening as an authority path', () => {
    expect(F).not.toMatch(/rolsuper/i);
    expect(F).not.toMatch(/rolbypassrls/i);
    expect(F).not.toMatch(/pg_has_role/i);
  });

  it('does not fall back to a session-settable variable (0108 anti-pattern)', () => {
    expect(F).not.toMatch(/current_setting\(\s*'app\./i);
  });

  it('trigger function is SECURITY INVOKER (current_user is the caller, not the owner)', () => {
    expect(F).not.toMatch(/SECURITY DEFINER/i);
  });
});

describe('scoped 0013 — credential/payment trigger geometry', () => {
  it('enforces claim-credential pair consistency for every principal (check_violation)', () => {
    expect(F).toContain('CREATE OR REPLACE FUNCTION ue_enforce_workbook_credential_authority()');
    expect(F).toContain('(NEW.claim_token IS NULL) <> (NEW.claim_token_expires_at IS NULL)');
    expect(F).toContain("ERRCODE = 'check_violation'");
  });

  it('makes claim_token and claim_token_expires_at system-only on INSERT and UPDATE', () => {
    expect(F).toContain('NEW.claim_token IS DISTINCT FROM OLD.claim_token');
    expect(F).toContain('NEW.claim_token_expires_at IS DISTINCT FROM OLD.claim_token_expires_at');
    expect(F).toContain('NEW.claim_token IS NOT NULL OR NEW.claim_token_expires_at IS NOT NULL');
  });

  it('makes stripe_payment_ref creation/replacement system-only', () => {
    expect(F).toContain('NEW.stripe_payment_ref IS DISTINCT FROM OLD.stripe_payment_ref');
    expect(F).toContain('NEW.stripe_payment_ref IS NOT NULL');
  });

  it('gates the mutation on the system-principal predicate and raises insufficient_privilege', () => {
    expect(F).toMatch(
      /v_credential_changed OR v_payment_ref_changed\)\s*AND NOT ue_is_workbook_system_principal\(\)/,
    );
    expect(F).toContain("ERRCODE = 'insufficient_privilege'");
  });

  it('protects EXACTLY the three system-owned columns and no others', () => {
    // The protected set is claim_token, claim_token_expires_at, stripe_payment_ref.
    expect(F).not.toContain('NEW.status IS DISTINCT FROM OLD.status');
    expect(F).not.toContain('NEW.report_tier_id IS DISTINCT FROM OLD.report_tier_id');
    expect(F).not.toContain('NEW.claim_email IS DISTINCT FROM OLD.claim_email');
    expect(F).not.toContain('NEW.claimed_by_user_id IS DISTINCT FROM OLD.claimed_by_user_id');
  });

  it('attaches the trigger BEFORE INSERT OR UPDATE on workbooks (row level), guarded and drop-first', () => {
    expect(F).toContain("to_regclass('workbooks') IS NOT NULL");
    expect(F).toContain('DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks');
    expect(F).toMatch(
      /CREATE TRIGGER ue_workbook_credential_authority BEFORE INSERT OR UPDATE ON workbooks FOR EACH ROW EXECUTE FUNCTION ue_enforce_workbook_credential_authority\(\)/,
    );
  });
});

describe('scoped 0013 — scope discipline (authority control ONLY)', () => {
  it('does NOT alter grants (owned by 0009) on workbooks or workbook_purchases', () => {
    expect(Fcode).not.toMatch(/GRANT[^;]*ON TABLE workbooks/i);
    expect(Fcode).not.toMatch(/REVOKE[^;]*ON TABLE workbooks/i);
    expect(Fcode).not.toMatch(/GRANT[^;]*ON TABLE workbook_purchases/i);
    expect(Fcode).not.toMatch(/REVOKE[^;]*ON TABLE workbook_purchases/i);
  });

  it('does NOT touch RLS policies (owned by 0010-0012)', () => {
    expect(Fcode).not.toMatch(/CREATE POLICY/i);
    expect(Fcode).not.toMatch(/DROP POLICY/i);
    expect(Fcode).not.toMatch(/ALTER POLICY/i);
    expect(Fcode).not.toMatch(/(ENABLE|DISABLE|FORCE)\s+ROW LEVEL SECURITY/i);
  });

  it('does NOT create/alter roles, grant BYPASSRLS/SUPERUSER, or set a password', () => {
    expect(Fcode).not.toMatch(/CREATE ROLE/i);
    expect(Fcode).not.toMatch(/ALTER ROLE/i);
    expect(Fcode).not.toMatch(/BYPASSRLS/i);
    expect(Fcode).not.toMatch(/SUPERUSER/i);
    expect(Fcode).not.toMatch(/PASSWORD/i);
  });

  it('never uses CASCADE (non-destructive to unrelated dependents)', () => {
    expect(Fcode).not.toMatch(/CASCADE/i);
  });

  it('does not recreate foundation roles or redefine shared RLS helpers/policies', () => {
    expect(Fcode).not.toMatch(/CREATE ROLE union_eyes_(runtime|system)/);
    expect(Fcode).not.toContain('CREATE OR REPLACE FUNCTION ue_create_user_rls_policy');
    expect(Fcode).not.toMatch(/DROP POLICY[^;]*ue_system_full_access/);
  });
});

describe('scoped 0013 — rollback scope (TEST/DEVELOPMENT-ONLY)', () => {
  it('drops the trigger and both helper functions, and nothing else of substance', () => {
    expect(R).toContain('DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks');
    expect(R).toContain('DROP FUNCTION IF EXISTS ue_enforce_workbook_credential_authority()');
    expect(R).toContain('DROP FUNCTION IF EXISTS ue_is_workbook_system_principal()');
  });

  it('does NOT touch grants, RLS, roles, or use CASCADE', () => {
    expect(Rcode).not.toMatch(/GRANT/i);
    expect(Rcode).not.toMatch(/REVOKE/i);
    expect(Rcode).not.toMatch(/CREATE POLICY|DROP POLICY|ALTER POLICY/i);
    expect(Rcode).not.toMatch(/CREATE ROLE|ALTER ROLE/i);
    expect(Rcode).not.toMatch(/CASCADE/i);
  });

  it('is guarded on table presence and marked as re-opening the defect (dev-only)', () => {
    expect(R).toContain("to_regclass('workbooks') IS NOT NULL");
    expect(R).toMatch(/TEST\/DEVELOPMENT-ONLY/i);
  });
});
