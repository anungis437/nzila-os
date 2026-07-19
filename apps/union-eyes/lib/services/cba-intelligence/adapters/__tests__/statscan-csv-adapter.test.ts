import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatsCanCsvAdapter } from "../statscan-csv-adapter";

const loggerMocks = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

describe("StatsCanCsvAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers default and custom tables", async () => {
    const adapter = new StatsCanCsvAdapter();
    const docs = await adapter.discover({ tables: [{ pid: "1234567801", title: "Custom Table", category: "custom" }] });
    expect(docs).toHaveLength(2);
    expect(docs[0].sourceUrl).toContain("tv.action?pid=1234567801");
    expect(docs[1].sourceUrl).toContain("12345678-eng.zip");
    expect(loggerMocks.info).toHaveBeenCalled();

    const defaults = await adapter.discover({});
    expect(defaults).toHaveLength(10);
  });

  it("fetches html table views", async () => {
    const adapter = new StatsCanCsvAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html><body>Table View</body></html>", { status: 200, headers: { "content-type": "text/html" } }));
    const result = await adapter.fetch("https://example.ca/table", {});
    expect(result.metadata?.isTableView).toBe(true);
    expect(result.metadata?.source).toBe("statscan_csv");
  });

  it("fetches csv content and computes headers/row count", async () => {
    const adapter = new StatsCanCsvAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("a,b\n1,2\n3,4\n", { status: 200, headers: { "content-type": "text/csv" } }));
    const result = await adapter.fetch("https://example.ca/file.csv", {});
    expect(result.contentType).toBe("text/csv");
    expect(result.metadata?.rowCount).toBe(2);
    expect(result.metadata?.headers).toEqual(["a", "b"]);

    vi.mocked(fetch).mockResolvedValueOnce(new Response("binary-like", { status: 200, headers: { "content-type": "application/zip" } }));
    const zipResult = await adapter.fetch("https://example.ca/file.zip", {});
    expect(zipResult.contentType).toBe("application/zip");

    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => null },
      text: async () => "x,y\n1,2",
      ok: true,
    } as Response);
    const fallback = await adapter.fetch("https://example.ca/file.unknown", {});
    expect(fallback.contentType).toBe("text/html");
  });
});
