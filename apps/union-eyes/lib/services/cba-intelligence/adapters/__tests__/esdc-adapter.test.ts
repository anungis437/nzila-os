import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EsdcFederalAdapter } from "../esdc-adapter";

const loggerMocks = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

describe("EsdcFederalAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers docs from configured urls and deduplicates", async () => {
    const adapter = new EsdcFederalAdapter();
    const html = [
      '<a href="/doc/settlement.pdf">Major Wage Settlement Bulletin</a>',
      '<a href="/doc/data">Collective bargaining data</a>',
      '<a href="/doc/settlement.pdf">Major Wage Settlement Bulletin</a>',
      '<a href="#top">Bargaining Anchor</a>',
      '<a href="javascript:void(0)">Collective bargaining bad link</a>',
    ].join("");

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response('<a href="/fr/doc">Convention négociation salaire</a>', { status: 200 }));

    const docs = await adapter.discover({
      wageSettlementUrl: "https://example.ca/a",
      cbaDataUrl: "https://example.ca/b",
      fmcsUrl: "https://example.ca/fr/c",
    });

    expect(docs).toHaveLength(3);
    expect(docs[0].documentType).toBe("wage_settlement");
    expect(docs[1].documentType).toBe("statistical_report");
    expect(docs[2].language).toBe("fr");
    expect(loggerMocks.warn).toHaveBeenCalled();
    expect(loggerMocks.info).toHaveBeenCalled();
  });

  it("fetches html and preserves metadata source", async () => {
    const adapter = new EsdcFederalAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html><body>Federal bargaining page</body></html>", { status: 200 }));
    const result = await adapter.fetch("https://example.ca/doc", {});
    expect(result.metadata?.source).toBe("esdc_federal");
    expect(result.wordCount).toBeGreaterThan(1);

    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => null },
      text: async () => "plain text content",
      ok: true,
    } as Response);
    const fallback = await adapter.fetch("https://example.ca/plain", {});
    expect(fallback.contentType).toBe("text/html");
  });

  it("uses default urls when config is empty", async () => {
    const adapter = new EsdcFederalAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    await expect(adapter.discover({})).resolves.toEqual([]);
  });

  it("returns empty result when page has no links", () => {
    const adapter = new EsdcFederalAdapter() as any as {
      parseCanadaPage: (html: string, baseUrl: string) => any[];
    };
    expect(adapter.parseCanadaPage("<html><body>No links</body></html>", "https://example.ca")).toEqual([]);
    expect(adapter.parseCanadaPage('<a href="/x">hello world</a>', "https://example.ca")).toEqual([]);
  });

  it("covers private helper branches directly", () => {
    const adapter = new EsdcFederalAdapter() as any as {
      isCbaRelated: (text: string, href: string) => boolean;
      classifyDocType: (text: string) => string;
      detectSector: (text: string) => string | undefined;
      detectLanguage: (text: string, url: string) => "en" | "fr" | "bilingual";
      resolveUrl: (href: string, baseUrl: string) => string | null;
      parseCanadaPage: (html: string, baseUrl: string) => any[];
    };

    expect(adapter.isCbaRelated("collective bargaining", "x")).toBe(true);
    expect(adapter.isCbaRelated("other", "x")).toBe(false);
    expect(adapter.classifyDocType("Settlement Bulletin")).toBe("wage_settlement");
    expect(adapter.classifyDocType("Arbitration decision")).toBe("arbitration_decision");
    expect(adapter.classifyDocType("Statistics data release")).toBe("statistical_report");
    expect(adapter.classifyDocType("Collective agreement")).toBe("collective_agreement");
    expect(adapter.detectSector("public federal transport rail telecom bank postal")).toBe("public_federal");
    expect(adapter.detectSector("transport rail")).toBe("transportation");
    expect(adapter.detectSector("telecom service")).toBe("telecommunications");
    expect(adapter.detectSector("bank financial")).toBe("banking");
    expect(adapter.detectSector("postal mail")).toBe("postal");
    expect(adapter.detectSector("other")).toBeUndefined();
    expect(adapter.detectLanguage("Convention négociation salaire", "https://example.ca/en")).toBe("bilingual");
    expect(adapter.detectLanguage("text", "https://example.ca/fr/page")).toBe("fr");
    expect(adapter.detectLanguage("English text", "https://example.ca/en")).toBe("en");
    expect(adapter.resolveUrl("/doc", "https://example.ca/x")).toBe("https://example.ca/doc");
    expect(adapter.resolveUrl("http://[invalid]", "https://example.ca")).toBeNull();

    const parsed = adapter.parseCanadaPage(
      '<a href="/doc/a">collective agreement</a><a href="">collective agreement</a><a href="#top">collective agreement</a><a href="javascript:void(0)">collective agreement</a><a href="http://[invalid]">collective agreement</a>',
      "https://example.ca",
    );
    expect(parsed).toHaveLength(1);
  });
});
