/**
 * scripts/rls-enforcement/__tests__/generator-guarded-call-emission.test.ts
 *
 * Regression proof for emitGuardedPolicyCall() — the function that
 * replaced the prior generic regex-based guard (which only ever validated
 * the primary table + the helper's 2nd positional argument, silently
 * trusting every other argument). This is a pure static/SQL-text test: it
 * asserts the SHAPE of the generated DO block (existence checks present,
 * RAISE EXCEPTION present, PERFORM present) for every helper family named
 * in the remediation authorization, without touching any database.
 *
 * See db/__tests__/rls-enforcement-helpers-behavioral.test.ts for the
 * disposable-PostgreSQL BEHAVIORAL proof that these DO blocks actually
 * no-op / hard-fail / execute correctly against real tables.
 */
import { describe, it, expect } from "vitest";
import { emitGuardedPolicyCall, type PolicyCallSpec } from "../generate-rls-enforcement-migration";

type CallSpec = Extract<PolicyCallSpec, { kind: "call" }>;

function assertGuardShape(sql: string, spec: CallSpec) {
  // Primary table existence check always present — resolved via the
  // session's search_path (current_schemas), not hardcoded to the literal
  // "public" schema (see emitGuardedPolicyCall doc comment).
  expect(sql).toContain(`to_regclass('${spec.primaryTable}') IS NOT NULL`);
  // Every required column check (self AND parent/related tables) present.
  for (const rc of spec.requiredChecks) {
    expect(sql).toContain(
      `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ANY(current_schemas(false)) AND table_name = '${rc.table}' AND column_name = '${rc.column}')`
    );
  }
  // Hard-fail branch present (not a silent skip).
  expect(sql).toContain("RAISE EXCEPTION");
  // Success branch present.
  expect(sql).toContain(`PERFORM ${spec.fn}(`);
}

describe("emitGuardedPolicyCall — helper-aware dependency validation (P4 Round58 remediation)", () => {
  it("direct-org helper: guards the target table's own org column", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_direct_org_rls_policy",
      args: ["'chat_sessions'", "'organization_id'", "FALSE"],
      primaryTable: "chat_sessions",
      requiredChecks: [{ table: "chat_sessions", column: "organization_id" }],
    };
    assertGuardShape(emitGuardedPolicyCall(spec), spec);
  });

  it("parent-owned helper: guards BOTH the child FK column AND the parent's authority column (the exact production defect)", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_parent_owned_rls_policy_v2",
      args: ["'chat_messages'", "'session_id'", "'chat_sessions'", "'organization_id'", "FALSE"],
      primaryTable: "chat_messages",
      requiredChecks: [
        { table: "chat_messages", column: "session_id" },
        { table: "chat_sessions", column: "organization_id" },
      ],
    };
    const sql = emitGuardedPolicyCall(spec);
    assertGuardShape(sql, spec);
    // Regression pin: this is precisely the check the OLD generic guard
    // never performed (it stopped at the 2nd positional arg, session_id,
    // and never validated chat_sessions.organization_id at all) — the
    // defect that crashed production run 34765974431.
    expect(sql).toContain(
      "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ANY(current_schemas(false)) AND table_name = 'chat_sessions' AND column_name = 'organization_id')"
    );
  });

  it("parent-owned-via-user helper: guards the child FK column AND the parent's user column", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_parent_owned_via_user_rls_policy_v2",
      args: ["'workbook_entries'", "'workbook_id'", "'workbooks'", "'claimed_by_user_id'"],
      primaryTable: "workbook_entries",
      requiredChecks: [
        { table: "workbook_entries", column: "workbook_id" },
        { table: "workbooks", column: "claimed_by_user_id" },
      ],
    };
    assertGuardShape(emitGuardedPolicyCall(spec), spec);
  });

  it("multi-party helper: guards BOTH org columns (not just the first)", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_multi_party_rls_policy",
      args: ["'congress_memberships'", "'organization_id'", "'congress_id'"],
      primaryTable: "congress_memberships",
      requiredChecks: [
        { table: "congress_memberships", column: "organization_id" },
        { table: "congress_memberships", column: "congress_id" },
      ],
    };
    assertGuardShape(emitGuardedPolicyCall(spec), spec);
  });

  it("shared-library-root helper: guards org column, sharing-level column, AND shared-with column", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_shared_library_rls_policy",
      args: ["'shared_clause_library'", "'source_organization_id'", "'sharing_level'", "'shared_with_org_ids'"],
      primaryTable: "shared_clause_library",
      requiredChecks: [
        { table: "shared_clause_library", column: "source_organization_id" },
        { table: "shared_clause_library", column: "sharing_level" },
        { table: "shared_clause_library", column: "shared_with_org_ids" },
      ],
    };
    assertGuardShape(emitGuardedPolicyCall(spec), spec);
  });

  it("shared-library-child helper: guards the child FK AND all 3 hardcoded shared_clause_library parent columns", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_shared_library_child_rls_policy",
      args: ["'clause_library_tags'", "'clause_id'"],
      primaryTable: "clause_library_tags",
      requiredChecks: [
        { table: "clause_library_tags", column: "clause_id" },
        { table: "shared_clause_library", column: "source_organization_id" },
        { table: "shared_clause_library", column: "shared_with_org_ids" },
        { table: "shared_clause_library", column: "sharing_level" },
      ],
    };
    assertGuardShape(emitGuardedPolicyCall(spec), spec);
  });

  it("emits a no-op (not a hard-fail) path guarded solely by primary-table existence", () => {
    const spec: CallSpec = {
      kind: "call",
      fn: "ue_create_direct_org_rls_policy",
      args: ["'not_yet_deployed_table'", "'organization_id'", "FALSE"],
      primaryTable: "not_yet_deployed_table",
      requiredChecks: [{ table: "not_yet_deployed_table", column: "organization_id" }],
    };
    const sql = emitGuardedPolicyCall(spec);
    // The IF wrapping the whole block is keyed on primary-table existence
    // only — so when the primary table itself is absent, the entire block
    // (including the RAISE EXCEPTION branch) is skipped: a true no-op.
    expect(sql.trim().startsWith("DO $$ BEGIN")).toBe(true);
    expect(sql).toContain(`IF to_regclass('${spec.primaryTable}') IS NOT NULL THEN`);
  });
});
