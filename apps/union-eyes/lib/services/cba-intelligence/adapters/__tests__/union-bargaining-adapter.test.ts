import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnionBargainingAdapter } from "../union-bargaining-adapter";

const loggerMocks = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

describe("UnionBargainingAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers selected unions and deduplicates", async () => {
    const adapter = new UnionBargainingAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('<a href="/news/deal">Tentative deal reached</a><a href="/news/deal">Tentative deal reached</a>', { status: 200 }))
      .mockRejectedValueOnce("down");

    const docs = await adapter.discover({ unions: ["cupe", "unifor"] });
    expect(docs).toHaveLength(1);
    expect(docs[0].documentType).toBe("settlement_notice");
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it("fetches union bargaining page content", async () => {
    const adapter = new UnionBargainingAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html><body>union update</body></html>", { status: 200 }));
    const result = await adapter.fetch("https://example.ca/doc", {});
    expect(result.metadata?.source).toBe("union_bargaining");
  });

  it("uses default unions when no filter is provided", async () => {
    const adapter = new UnionBargainingAdapter();
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));
    const docs = await adapter.discover({});
    expect(docs).toEqual([]);
  });

  it("returns empty result when union filter removes all sources", async () => {
    const adapter = new UnionBargainingAdapter();
    await expect(adapter.discover({ unions: ["missing"] })).resolves.toEqual([]);
  });

  it("covers helper branches directly", () => {
    const adapter = new UnionBargainingAdapter() as any as {
      isRelevantLink: (text: string) => boolean;
      classifyDocType: (text: string) => string;
      detectLanguage: (text: string, url: string) => "en" | "fr" | "bilingual";
      resolveUrl: (href: string, baseUrl: string) => string | null;
      parseUnionPage: (html: string, baseUrl: string, union: { key: string; jurisdiction: string; sectors: string[] }) => any[];
    };

    expect(adapter.isRelevantLink("tentative bargain settlement")).toBe(true);
    expect(adapter.isRelevantLink("misc news")).toBe(false);
    expect(adapter.classifyDocType("ratification vote")).toBe("ratification_notice");
    expect(adapter.classifyDocType("settlement deal entente")).toBe("settlement_notice");
    expect(adapter.classifyDocType("strike grève lockout")).toBe("work_stoppage");
    expect(adapter.classifyDocType("arbitration update")).toBe("arbitration_decision");
    expect(adapter.classifyDocType("other bargaining")).toBe("bargaining_update");
    expect(adapter.detectLanguage("fr", "https://example.ca/fr/")).toBe("fr");
    expect(adapter.detectLanguage("convention négociation grève", "https://example.ca/en")).toBe("bilingual");
    expect(adapter.detectLanguage("english text", "https://example.ca/en")).toBe("en");
    expect(adapter.resolveUrl("/doc", "https://example.ca")).toBe("https://example.ca/doc");
    expect(adapter.resolveUrl("http://[invalid]", "https://example.ca")).toBeNull();

    const parsed = adapter.parseUnionPage(
      '<a href="/doc">tentative deal</a><a href="">tentative deal</a><a href="#">tentative deal</a><a href="javascript:void(0)">tentative deal</a><a href="/a">deal</a><a href="http://[invalid]">tentative deal</a>',
      "https://example.ca",
      { key: "cupe", jurisdiction: "CA-FED", sectors: ["public"] },
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ jurisdiction: "CA-FED", sector: "public" });
  });

  it("returns empty result when no relevant links exist", () => {
    const adapter = new UnionBargainingAdapter() as any as {
      parseUnionPage: (html: string, baseUrl: string, union: { key: string; jurisdiction: string; sectors: string[] }) => any[];
    };
    expect(adapter.parseUnionPage('<a href="/x">misc</a>', "https://example.ca", { key: "cupe", jurisdiction: "CA-FED", sectors: ["public"] })).toEqual([]);
    expect(adapter.parseUnionPage('<a href="/tiny">deal</a>', "https://example.ca", { key: "cupe", jurisdiction: "CA-FED", sectors: ["public"] })).toEqual([]);
  });
});
