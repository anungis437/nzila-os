/**
 * RLS Context Middleware — Unit Tests
 *
 * Covers withRLSContext (all overloads), withExplicitUserContext,
 * withSystemContext, validateRLSContext, getCurrentRLSContext,
 * createSecureServerAction, withRLS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCurrentUser: vi.fn(),
  mockTxExecute: vi.fn(),
  mockDbExecute: vi.fn(),
  mockSystemTxExecute: vi.fn(),
}));

vi.mock("@/lib/api-auth-guard", () => ({
  auth: mocks.mockAuth,
  currentUser: mocks.mockCurrentUser,
}));

vi.mock("@/db/db", () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      return fn({ execute: mocks.mockTxExecute });
    }),
    execute: mocks.mockDbExecute,
  },
}));

vi.mock("@/db/system-db", () => ({
  systemDb: {
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      return fn({ execute: mocks.mockSystemTxExecute });
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  // Capture the interpolated template + values so tests can assert exactly
  // which org/user value was applied to the session via set_config().
  sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
    _tag: "sql",
    strings: Array.from(strings ?? []),
    values,
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  withRLSContext,
  withExplicitUserContext,
  withSystemContext,
  validateRLSContext,
  getCurrentRLSContext,
  createSecureServerAction,
  withRLS,
  withSystemRLSContext,
  withPlatformAdminRLSContext,
} from "../with-rls-context";

/* ── tests ──────────────────────────────────────────────────────────── */

/**
 * Reads back the value that was actually applied to a given Postgres session
 * setting (e.g. "app.current_org_id") via set_config() during the last run.
 * Handles both interpolated values (set_config(..., ${value}, true)) and the
 * literal-clear form used by system context (set_config(..., '', true)).
 * Returns undefined if that setting was never written.
 */
function appliedSetting(setting: string): string | undefined {
  const call = mocks.mockTxExecute.mock.calls.find(
    ([q]) => typeof q?.strings?.[0] === "string" && q.strings[0].includes(setting),
  );
  if (!call) return undefined;
  const q = call[0];
  if (Array.isArray(q.values) && q.values.length > 0) return q.values[0];
  // Literal form, e.g. set_config('app.current_org_id', '', true) → cleared.
  const escaped = setting.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = q.strings[0].match(new RegExp(`${escaped}'\\s*,\\s*'([^']*)'`));
  return match ? match[1] : undefined;
}

describe("with-rls-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuth.mockResolvedValue({ userId: "user-1", orgId: "org-1" });
    mocks.mockCurrentUser.mockResolvedValue({
      publicMetadata: {},
      privateMetadata: {},
    });
    mocks.mockTxExecute.mockResolvedValue(undefined);
    mocks.mockDbExecute.mockResolvedValue([]);
  });

  // ── withRLSContext ────────────────────────────────────────────────
  describe("withRLSContext", () => {
    it("throws if no authenticated user", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: null, orgId: null });
      await expect(withRLSContext(async () => "r")).rejects.toThrow("Unauthorized");
    });

    it("sets user and org context then executes operation", async () => {
      const result = await withRLSContext(async () => "ok");
      expect(result).toBe("ok");
      // 2 execute calls: set user_id + set org_id
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(2);
    });

    it("throws when orgId is missing — fails closed for org isolation", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      // currentUser returns no org metadata → all fallbacks exhausted → must throw
      await expect(withRLSContext(async () => "ok")).rejects.toThrow(
        "Organization context required for scoped data access",
      );
    });

    it("falls back to publicMetadata.organizationId", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      mocks.mockCurrentUser.mockResolvedValueOnce({
        publicMetadata: { organizationId: "org-pub" },
        privateMetadata: {},
      });
      const result = await withRLSContext(async () => "ok");
      expect(result).toBe("ok");
      // 2 calls: set user_id + set org_id (from publicMetadata)
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(2);
      // The org resolved from session metadata is the one actually applied.
      expect(appliedSetting("app.current_org_id")).toBe("org-pub");
    });

    it("falls back to tenantId when organizationId missing", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      mocks.mockCurrentUser.mockResolvedValueOnce({
        publicMetadata: { tenantId: "tenant-1" },
        privateMetadata: {},
      });
      await withRLSContext(async () => "ok");
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(2);
    });

    it("accepts context map + operation overload", async () => {
      const result = await withRLSContext({ organizationId: "org-A" }, async () => 42);
      expect(result).toBe(42);
    });

    /* ── Phase 1: binary context-map contract (org scoping enforced) ──
     * The context-map overload must ENFORCE the supplied organizationId — it
     * must no longer imply org scoping while silently resolving org from auth.
     */

    it("enforces the supplied organizationId (applies org A)", async () => {
      // Session has NO active org; caller explicitly scopes to org-A.
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      const result = await withRLSContext({ organizationId: "org-A" }, async () => "ok");
      expect(result).toBe("ok");
      expect(appliedSetting("app.current_org_id")).toBe("org-A");
      expect(appliedSetting("app.current_user_id")).toBe("user-1");
    });

    it("pins the session to the supplied org A even when auth's active org is org B (no silent drift)", async () => {
      // This is the core regression: previously the supplied context was
      // discarded and org-B (from auth) would have been applied. The supplied
      // org-A must win, and org-B must never reach the session.
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: "org-B" });
      await withRLSContext({ organizationId: "org-A" }, async () => "ok");
      expect(appliedSetting("app.current_org_id")).toBe("org-A");
      expect(appliedSetting("app.current_org_id")).not.toBe("org-B");
    });

    it("fails closed when the context map omits organizationId", async () => {
      await expect(
        withRLSContext({ extra: "data" } as Record<string, unknown>, async () => "ok"),
      ).rejects.toThrow("context map requires a non-empty string `organizationId`");
    });

    it("fails closed when organizationId is an empty/whitespace string", async () => {
      await expect(
        withRLSContext({ organizationId: "" }, async () => "ok"),
      ).rejects.toThrow("context map requires a non-empty string `organizationId`");
      await expect(
        withRLSContext({ organizationId: "   " }, async () => "ok"),
      ).rejects.toThrow("context map requires a non-empty string `organizationId`");
    });

    it("fails closed when organizationId is a non-string value", async () => {
      await expect(
        withRLSContext({ organizationId: 123 } as unknown as Record<string, unknown>, async () => "ok"),
      ).rejects.toThrow("context map requires a non-empty string `organizationId`");
    });

    it("still requires an authenticated user under the context-map overload", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: null, orgId: null });
      await expect(
        withRLSContext({ organizationId: "org-A" }, async () => "ok"),
      ).rejects.toThrow("Unauthorized");
    });

    it('treats { organizationId: "system" } as a system bootstrap lookup: user set, org cleared, no throw', async () => {
      // User is authenticated but has no active org yet (org-resolution bootstrap).
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      const result = await withRLSContext(
        { organizationId: "system" },
        async () => "resolved",
      );
      expect(result).toBe("resolved");
      expect(appliedSetting("app.current_user_id")).toBe("user-1");
      // Org context is explicitly cleared rather than bound to a stale/auth org.
      expect(appliedSetting("app.current_org_id")).toBe("");
    });

    it("throws when currentUser() fails and orgId is null — fails closed", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      mocks.mockCurrentUser.mockRejectedValueOnce(new Error("edge case"));
      await expect(withRLSContext(async () => "ok")).rejects.toThrow(
        "Organization context required for scoped data access",
      );
    });

    /* ── Batch 32: branch gap-fill ── */

    it("falls back to privateMetadata.organizationId", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      mocks.mockCurrentUser.mockResolvedValueOnce({
        publicMetadata: {},
        privateMetadata: { organizationId: "org-priv" },
      });
      const result = await withRLSContext(async () => "ok");
      expect(result).toBe("ok");
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(2);
    });

    it("falls back to privateMetadata.tenantId", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      mocks.mockCurrentUser.mockResolvedValueOnce({
        publicMetadata: {},
        privateMetadata: { tenantId: "tenant-priv" },
      });
      const result = await withRLSContext(async () => "ok");
      expect(result).toBe("ok");
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(2);
    });

    it("throws when currentUser() returns null and no orgId — fails closed", async () => {
      mocks.mockAuth.mockResolvedValueOnce({ userId: "user-1", orgId: null });
      mocks.mockCurrentUser.mockResolvedValueOnce(null);
      await expect(withRLSContext(async () => "ok")).rejects.toThrow(
        "Organization context required for scoped data access",
      );
    });
  });

  // ── withExplicitUserContext ───────────────────────────────────────
  describe("withExplicitUserContext", () => {
    it("throws on empty userId", async () => {
      await expect(
        withExplicitUserContext("", async () => "x"),
      ).rejects.toThrow("Invalid user ID");
    });

    it("sets user context and executes", async () => {
      const result = await withExplicitUserContext("u-2", async () => "done");
      expect(result).toBe("done");
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(1);
    });

    it("sets org context when provided", async () => {
      await withExplicitUserContext("u-2", async () => "done", "org-2");
      expect(mocks.mockTxExecute).toHaveBeenCalledTimes(2);
    });
  });

  // ── withSystemContext ─────────────────────────────────────────────
  describe("withSystemContext", () => {
    it("clears user and org context on the separate system connection", async () => {
      const result = await withSystemContext(async () => "sys");
      expect(result).toBe("sys");
      expect(mocks.mockSystemTxExecute).toHaveBeenCalledTimes(2);
      expect(mocks.mockTxExecute).not.toHaveBeenCalled();
    });
  });

  // ── validateRLSContext ────────────────────────────────────────────
  describe("validateRLSContext", () => {
    it("returns userId and orgId when set", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce([
        { user_id: "user-1", org_id: "org-1" },
      ]);
      const ctx = await validateRLSContext();
      expect(ctx).toEqual({ userId: "user-1", orgId: "org-1" });
    });

    it("throws when user not set", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce([
        { user_id: "", org_id: "org-1" },
      ]);
      await expect(validateRLSContext()).rejects.toThrow("app.current_user_id is not set");
    });

    it("throws when org not set", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce([
        { user_id: "user-1", org_id: "" },
      ]);
      await expect(validateRLSContext()).rejects.toThrow("app.current_org_id is not set");
    });

    it("throws generic error on unexpected failure", async () => {
      mocks.mockDbExecute.mockRejectedValueOnce(new Error("DB down"));
      await expect(validateRLSContext()).rejects.toThrow("RLS context not set");
    });
  });

  // ── getCurrentRLSContext ──────────────────────────────────────────
  describe("getCurrentRLSContext", () => {
    it("returns userId when set", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce([{ current_setting: "user-1" }]);
      expect(await getCurrentRLSContext()).toBe("user-1");
    });

    it("returns null when empty", async () => {
      mocks.mockDbExecute.mockResolvedValueOnce([{ current_setting: "" }]);
      expect(await getCurrentRLSContext()).toBeNull();
    });

    it("returns null on error", async () => {
      mocks.mockDbExecute.mockRejectedValueOnce(new Error("fail"));
      expect(await getCurrentRLSContext()).toBeNull();
    });
  });

  // ── createSecureServerAction ──────────────────────────────────────
  describe("createSecureServerAction", () => {
    it("wraps action with RLS context", async () => {
      const action = vi.fn(async (n: number) => n * 2);
      const secured = createSecureServerAction(action);
      const result = await secured(5);
      expect(result).toBe(10);
      expect(action).toHaveBeenCalledWith(5);
    });
  });

  // ── withRLS ───────────────────────────────────────────────────────
  describe("withRLS", () => {
    it("wraps handler and preserves args", async () => {
      const handler = vi.fn(async (a: string, b: number) => `${a}-${b}`);
      const wrapped = withRLS(handler);
      const result = await wrapped("test", 42);
      expect(result).toBe("test-42");
      expect(handler).toHaveBeenCalledWith("test", 42);
    });
  });

  // ── withSystemRLSContext ──────────────────────────────────────────
  describe("withSystemRLSContext", () => {
    it("executes and clears user + org context on the system connection", async () => {
      const result = await withSystemRLSContext("test: seed user creation", async () => "done");
      expect(result).toBe("done");
      // withSystemContext sets '' for both user_id and org_id → 2 execute calls
      expect(mocks.mockSystemTxExecute).toHaveBeenCalledTimes(2);
    });

    it("requires a reason string", async () => {
      // reason is typed as string so an empty reason is accepted at runtime,
      // but calling the function works without throwing
      const result = await withSystemRLSContext("bulk-import-job", async () => 42);
      expect(result).toBe(42);
    });
  });

  // ── withPlatformAdminRLSContext ───────────────────────────────────
  describe("withPlatformAdminRLSContext", () => {
    it("throws when adminId is empty", async () => {
      await expect(
        withPlatformAdminRLSContext("", "compliance-export", async () => "x"),
      ).rejects.toThrow("Platform admin ID is required");
    });

    it("executes on the system connection for a valid admin", async () => {
      const result = await withPlatformAdminRLSContext(
        "admin-123",
        "compliance-export",
        async () => "exported",
      );
      expect(result).toBe("exported");
      // sets app.current_user_id (audit) + clears app.current_org_id → 2 execute calls
      expect(mocks.mockSystemTxExecute).toHaveBeenCalledTimes(2);
      expect(mocks.mockTxExecute).not.toHaveBeenCalled();
    });
  });
});
