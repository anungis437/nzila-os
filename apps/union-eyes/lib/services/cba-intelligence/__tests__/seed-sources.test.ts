import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectQueue: [] as any[],
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

function makeSelectChain(result: any) {
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

vi.mock("@/db/db", () => ({ db: { select: mocks.dbSelect, insert: mocks.dbInsert } }));
vi.mock("@/db/schema", () => ({ cbaIntelSources: { slug: "slug", $inferSelect: {} } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => ({})) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: mocks.loggerInfo, error: mocks.loggerError, warn: vi.fn(), debug: vi.fn() },
}));

describe("seed-sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.dbSelect.mockImplementation(() => makeSelectChain(mocks.selectQueue.shift() ?? []));
    mocks.dbInsert.mockImplementation(() => ({ values: vi.fn(() => Promise.resolve()) }));
  });

  it("creates all seed sources when none exist", async () => {
    const mod = await import("../seed-sources");
    for (let i = 0; i < mod.SEED_SOURCES.length; i++) {
      mocks.selectQueue.push([]);
    }

    const result = await mod.seedSources();
    expect(result).toEqual({ created: mod.SEED_SOURCES.length, skipped: 0, errors: [] });
  });

  it("tracks skipped and errored sources", async () => {
    const mod = await import("../seed-sources");
    for (let i = 0; i < mod.SEED_SOURCES.length; i++) {
      if (i === 0) {
        mocks.selectQueue.push([{ id: "exists" }]);
      } else {
        mocks.selectQueue.push([]);
      }
    }

    let insertCall = 0;
    mocks.dbInsert.mockImplementation(() => ({
      values: vi.fn(() => {
        insertCall += 1;
        if (insertCall === 1) {
          throw new Error("db write failed");
        }
        return Promise.resolve();
      }),
    }));

    const result = await mod.seedSources();
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("handles non-Error throws during insert", async () => {
    const mod = await import("../seed-sources");
    for (let i = 0; i < mod.SEED_SOURCES.length; i++) {
      mocks.selectQueue.push([]);
    }

    let insertCall = 0;
    mocks.dbInsert.mockImplementation(() => ({
      values: vi.fn(() => {
        insertCall += 1;
        if (insertCall === 2) {
          throw "string failure";
        }
        return Promise.resolve();
      }),
    }));

    const result = await mod.seedSources();
    expect(result.errors.some((e) => e.includes("string failure"))).toBe(true);
  });
});
