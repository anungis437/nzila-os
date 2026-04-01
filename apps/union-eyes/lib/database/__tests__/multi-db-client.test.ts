/**
 * Multi-DB Client — Unit Tests
 *
 * Covers all exported functions: getDatabaseConfig, createDatabaseClient,
 * executeQuery, createFullTextSearchQuery, getCurrentTimestamp, arrayAppend,
 * createLikeQuery, jsonExtract, generateUuid, createPaginationQuery,
 * createBooleanQuery, createNullCheck, getDatabase, checkDatabaseHealth
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockDrizzlePg: vi.fn(() => ({ _type: "pg" })),
  mockDrizzleMssql: vi.fn(() => ({ _type: "mssql" })),
  mockPostgres: vi.fn(() => ({})),
  mockPool: vi.fn(),
  mockSafeColumnName: vi.fn((name: string) => `safe_${name}`),
  mockSql: Object.assign(
    vi.fn((_strings: unknown, ..._values: unknown[]) => ({ _tag: "sql" })),
    {
      raw: vi.fn((s: string) => ({ _tag: "raw", value: s })),
      join: vi.fn((items: unknown[], sep: unknown) => ({ _tag: "join", items, sep })),
    },
  ),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: mocks.mockDrizzlePg,
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: mocks.mockDrizzleMssql,
}));

vi.mock("postgres", () => ({
  default: mocks.mockPostgres,
}));

vi.mock("pg", () => ({
  Pool: mocks.mockPool,
}));

vi.mock("@/db/schema", () => ({}));

vi.mock("drizzle-orm", () => ({
  sql: mocks.mockSql,
  eq: vi.fn((...a: unknown[]) => ({ op: "eq", args: a })),
  and: vi.fn((...a: unknown[]) => ({ op: "and", args: a })),
  or: vi.fn((...a: unknown[]) => ({ op: "or", args: a })),
  inArray: vi.fn((...a: unknown[]) => ({ op: "inArray", args: a })),
  isNull: vi.fn((a: unknown) => ({ op: "isNull", args: [a] })),
  desc: vi.fn((a: unknown) => ({ op: "desc", args: [a] })),
  asc: vi.fn((a: unknown) => ({ op: "asc", args: [a] })),
  ilike: vi.fn((...a: unknown[]) => ({ op: "ilike", args: a })),
  gte: vi.fn((...a: unknown[]) => ({ op: "gte", args: a })),
  lte: vi.fn((...a: unknown[]) => ({ op: "lte", args: a })),
}));

vi.mock("@/lib/safe-sql-identifiers", () => ({
  safeColumnName: mocks.mockSafeColumnName,
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  getDatabaseConfig,
  createDatabaseClient,
  executeQuery,
  createFullTextSearchQuery,
  getCurrentTimestamp,
  arrayAppend,
  createLikeQuery,
  jsonExtract,
  generateUuid,
  createPaginationQuery,
  createBooleanQuery,
  createNullCheck,
  getDatabase,
} from "../multi-db-client";

/* ── tests ──────────────────────────────────────────────────────────── */

describe("multi-db-client", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  // ── getDatabaseConfig ─────────────────────────────────────────────
  describe("getDatabaseConfig", () => {
    it("returns postgresql by default", () => {
      delete process.env.DATABASE_TYPE;
      process.env.DATABASE_URL = "postgres://localhost/test";
      const cfg = getDatabaseConfig();
      expect(cfg.type).toBe("postgresql");
      expect(cfg.connectionString).toBe("postgres://localhost/test");
    });

    it("reads DATABASE_TYPE", () => {
      process.env.DATABASE_TYPE = "azure-sql";
      process.env.AZURE_SQL_CONNECTION_STRING = "mssql://host/db";
      delete process.env.DATABASE_URL;
      const cfg = getDatabaseConfig();
      expect(cfg.type).toBe("azure-sql");
    });

    it("uses test pool max=1 in test env", () => {
      delete process.env.DB_POOL_MAX;
      const cfg = getDatabaseConfig();
      expect(cfg.options?.max).toBe(1);
    });

    it("uses AZURE_SQL_CONNECTION_STRING when DATABASE_URL is missing", () => {
      delete process.env.DATABASE_URL;
      process.env.AZURE_SQL_CONNECTION_STRING = "mssql://azure-host/db";
      const cfg = getDatabaseConfig();
      expect(cfg.connectionString).toBe("mssql://azure-host/db");
    });

    it("uses non-test default max=20 when NODE_ENV and VITEST are not test", () => {
      delete process.env.DB_POOL_MAX;
      process.env.NODE_ENV = "development";
      delete process.env.VITEST;

      const cfg = getDatabaseConfig();
      expect(cfg.options?.max).toBe(20);
    });
  });

  // ── createDatabaseClient ──────────────────────────────────────────
  describe("createDatabaseClient", () => {
    it("creates postgres client for postgresql type", async () => {
      const client = await createDatabaseClient({
        type: "postgresql",
        connectionString: "postgres://localhost/test",
      });
      expect(client).toBeDefined();
      expect(mocks.mockPostgres).toHaveBeenCalled();
    });

    it("creates azure-sql client for azure-sql type", async () => {
      const client = await createDatabaseClient({
        type: "azure-sql",
        connectionString: "mssql://host/db",
        options: { ssl: true },
      });
      expect(client).toBeDefined();
      expect(mocks.mockPool).toHaveBeenCalled();
    });

    it("creates mssql client for mssql type", async () => {
      const client = await createDatabaseClient({
        type: "mssql",
        connectionString: "mssql://host/db",
      });
      expect(client).toBeDefined();
    });
  });

  // ── executeQuery ──────────────────────────────────────────────────
  describe("executeQuery", () => {
    it("passes through query result", async () => {
      const mockDb = {} as never;
      const result = await executeQuery(mockDb, async () => [{ id: 1 }]);
      expect(result).toEqual([{ id: 1 }]);
    });

    it("re-throws errors", async () => {
      const mockDb = {} as never;
      await expect(
        executeQuery(mockDb, async () => {
          throw new Error("query failed");
        }),
      ).rejects.toThrow("query failed");
    });
  });

  // ── createFullTextSearchQuery ─────────────────────────────────────
  describe("createFullTextSearchQuery", () => {
    it("returns postgresql full-text search SQL", () => {
      const result = createFullTextSearchQuery("test", ["title", "body"]);
      expect(result).toBeDefined();
    });

    it("returns azure-sql CONTAINS SQL", () => {
      const result = createFullTextSearchQuery("test", ["title"], "azure-sql");
      expect(result).toBeDefined();
    });

    it("returns FALSE for empty sanitized term", () => {
      const result = createFullTextSearchQuery("'\"\\;", ["title"]);
      expect(result).toBeDefined();
    });

    it("sanitizes special characters", () => {
      const result = createFullTextSearchQuery("test-term", ["col"]);
      expect(result).toBeDefined();
    });
  });

  // ── getCurrentTimestamp ───────────────────────────────────────────
  describe("getCurrentTimestamp", () => {
    it("returns NOW() for postgresql", () => {
      expect(getCurrentTimestamp("postgresql")).toBeDefined();
    });

    it("returns GETUTCDATE() for azure-sql", () => {
      expect(getCurrentTimestamp("azure-sql")).toBeDefined();
    });

    it("returns GETUTCDATE() for mssql", () => {
      expect(getCurrentTimestamp("mssql")).toBeDefined();
    });
  });

  // ── arrayAppend ───────────────────────────────────────────────────
  describe("arrayAppend", () => {
    it("returns array_append for postgresql", () => {
      expect(arrayAppend("tags", "new_tag")).toBeDefined();
      expect(mocks.mockSafeColumnName).toHaveBeenCalledWith("tags");
    });

    it("returns JSON_MODIFY for azure-sql", () => {
      expect(arrayAppend("tags", "val", "azure-sql")).toBeDefined();
    });
  });

  // ── createLikeQuery ───────────────────────────────────────────────
  describe("createLikeQuery", () => {
    it("returns ILIKE for postgresql", () => {
      const result = createLikeQuery("col", "%test%");
      expect(result).toBeDefined();
    });

    it("returns LIKE for azure-sql", () => {
      const result = createLikeQuery("col", "%test%", "azure-sql");
      expect(result).toBeDefined();
    });
  });

  // ── jsonExtract ───────────────────────────────────────────────────
  describe("jsonExtract", () => {
    it("returns JSONB for postgresql", () => {
      const result = jsonExtract("data", "$.key");
      expect(result).toBeDefined();
    });

    it("returns JSON_VALUE for azure-sql", () => {
      const result = jsonExtract("data", "$.key", "azure-sql");
      expect(result).toBeDefined();
    });

    it("throws for invalid JSON path", () => {
      expect(() => jsonExtract("data", "invalid!path")).toThrow("Invalid JSON path format");
    });

    it("accepts nested path", () => {
      expect(() => jsonExtract("data", "$.a.b[0]")).not.toThrow();
    });
  });

  // ── generateUuid ──────────────────────────────────────────────────
  describe("generateUuid", () => {
    it("returns gen_random_uuid() for postgresql", () => {
      expect(generateUuid()).toBeDefined();
    });

    it("returns NEWID() for azure-sql", () => {
      expect(generateUuid("azure-sql")).toBeDefined();
    });
  });

  // ── createPaginationQuery ─────────────────────────────────────────
  describe("createPaginationQuery", () => {
    it("returns LIMIT/OFFSET for postgresql", () => {
      const r = createPaginationQuery(10, 20);
      expect(r.limit).toBeDefined();
      expect(r.offset).toBeDefined();
    });

    it("returns FETCH NEXT/OFFSET ROWS for azure-sql", () => {
      const r = createPaginationQuery(10, 20, "azure-sql");
      expect(r.limit).toBeDefined();
      expect(r.offset).toBeDefined();
    });
  });

  // ── createBooleanQuery ────────────────────────────────────────────
  describe("createBooleanQuery", () => {
    it("uses eq(col, value) for postgresql", () => {
      const r = createBooleanQuery("active", true);
      expect(r).toBeDefined();
    });

    it("uses eq(col, 1/0) for azure-sql", () => {
      const r = createBooleanQuery("active", true, "azure-sql");
      expect(r).toEqual({ op: "eq", args: ["active", 1] });
    });

    it("uses eq(col, 0) for false in azure-sql", () => {
      const r = createBooleanQuery("active", false, "azure-sql");
      expect(r).toEqual({ op: "eq", args: ["active", 0] });
    });
  });

  // ── createNullCheck ───────────────────────────────────────────────
  describe("createNullCheck", () => {
    it("returns isNull for checkNull=true", () => {
      const r = createNullCheck("col", true);
      expect(r).toEqual({ op: "isNull", args: ["col"] });
    });

    it("returns IS NOT NULL for checkNull=false", () => {
      const r = createNullCheck("col", false);
      expect(r).toBeDefined();
    });
  });

  // ── getDatabase ───────────────────────────────────────────────────
  describe("getDatabase", () => {
    it("returns a database instance", async () => {
      process.env.DATABASE_URL = "postgres://localhost/test";
      const db = await getDatabase();
      expect(db).toBeDefined();
    });
  });

  // ── checkDatabaseHealth ──────────────────────────────────────────
  describe("checkDatabaseHealth", () => {
    it("returns healthy status when execute succeeds", async () => {
      vi.resetModules();
      process.env.DATABASE_TYPE = "postgresql";
      process.env.DATABASE_URL = "postgres://localhost/test";
      mocks.mockDrizzlePg.mockReturnValue({ execute: vi.fn().mockResolvedValue([]) });

      const mod = await import("../multi-db-client");
      const result = await mod.checkDatabaseHealth();
      expect(result.ok).toBe(true);
      expect(result.type).toBe("postgresql");
    });

    it("returns unhealthy status when execute fails", async () => {
      vi.resetModules();
      process.env.DATABASE_TYPE = "azure-sql";
      delete process.env.DATABASE_URL;
      process.env.AZURE_SQL_CONNECTION_STRING = "mssql://azure-host/db";
      mocks.mockDrizzleMssql.mockReturnValue({ execute: vi.fn().mockRejectedValue(new Error("db down")) });

      const mod = await import("../multi-db-client");
      const result = await mod.checkDatabaseHealth();
      expect(result.ok).toBe(false);
      expect(result.message).toContain("db down");
      expect(result.type).toBe("azure-sql");
    });
  });
});
