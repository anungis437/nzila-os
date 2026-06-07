import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FpslrebAdapter } from "../fpslreb-adapter";

const loggerMocks = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

describe("FpslrebAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers and deduplicates decision links", async () => {
    const adapter = new FpslrebAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('<a href="/decisions/2026-1.html">2026 decision</a><a href="/decisions/2026-1.html">2026 decision</a>', { status: 200 }))
      .mockRejectedValueOnce(new Error("boom"));

    const docs = await adapter.discover({ urls: ["https://example.ca/en", "https://example.ca/fr"] });
    expect(docs).toHaveLength(1);
    expect(docs[0].documentType).toBe("arbitration_decision");
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it("fetches html decisions", async () => {
    const adapter = new FpslrebAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html><body>Decision body</body></html>", { status: 200 }));
    const result = await adapter.fetch("https://example.ca/doc", {});
    expect(result.metadata?.source).toBe("fpslreb");

    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => null },
      text: async () => "Decision body",
      ok: true,
    } as Response);
    const fallback = await adapter.fetch("https://example.ca/doc2", {});
    expect(fallback.contentType).toBe("text/html");
  });

  it("uses default urls when config is empty", async () => {
    const adapter = new FpslrebAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    await expect(adapter.discover({})).resolves.toEqual([]);
  });

  it("covers parser branches directly", () => {
    const adapter = new FpslrebAdapter() as unknown as {
      parseDecisionListing: (html: string, baseUrl: string) => unknown[];
    };
    const parsed = adapter.parseDecisionListing(
      [
        '<a href="/decisions/2026-a.html">2026 A</a>',
        '<a href="/cas/2026-b.html">Case 2026-B</a>',
        '<a href="">2026 empty</a>',
        '<a href="#top">2026 anchor</a>',
        '<a href="javascript:void(0)">2026 script</a>',
        '<a href="#top">No Year NonDecision</a>',
        '<a href="/other">ok</a>',
        '<a href="/decisions/short.html">A</a>',
        '<a href="http://[invalid]">2026 broken</a>',
        '<a href="/short">ab</a>',
      ].join(""),
      "https://example.ca/fr/page",
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ language: "fr", jurisdiction: "CA-FED", sector: "public_federal" });
  });

  it("returns empty result when no decision links exist", () => {
    const adapter = new FpslrebAdapter() as unknown as {
      parseDecisionListing: (html: string, baseUrl: string) => unknown[];
    };
    expect(adapter.parseDecisionListing('<a href="/other">hello</a>', "https://example.ca/en")).toEqual([]);
  });

  it("formats non-Error discovery failures", async () => {
    const adapter = new FpslrebAdapter();
    vi.mocked(fetch).mockRejectedValueOnce("boom");
    await expect(adapter.discover({ urls: ["https://example.ca/en"] })).resolves.toEqual([]);
    expect(loggerMocks.warn).toHaveBeenCalled();
  });
});
