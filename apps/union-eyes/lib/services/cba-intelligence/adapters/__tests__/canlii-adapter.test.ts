import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanliiAdapter } from "../canlii-adapter";

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

describe("CanliiAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers and deduplicates documents across pages", async () => {
    const adapter = new CanliiAdapter();
    const htmlPage1 = `
      <a href="/en/ca/cirb/doc/2026/2026cirb1/2026cirb1.html">Hospital Arbitration Decision</a>
      <a href="/en/ca/cirb/doc/2026/2026cirb2/2026cirb2.html">City Transit Labour Award</a>
      <a href="#anchor">skip</a>
    `;
    const htmlPage2 = `
      <a href="/en/ca/cirb/doc/2026/2026cirb1/2026cirb1.html">Hospital Arbitration Decision</a>
      <a href="javascript:alert('x')">bad link</a>
    `;

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(htmlPage1, { status: 200 }))
      .mockResolvedValueOnce(new Response(htmlPage2, { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const docs = await adapter.discover({
      searchPaths: ["https://www.canlii.org/en/ca/cirb/"],
      maxPages: 3,
    });

    expect(docs).toHaveLength(2);
    expect(docs[0].documentType).toBe("arbitration_decision");
    expect(docs[0].jurisdiction).toBe("CA-FED");
    expect(docs[0].sector).toBe("healthcare");
    expect(docs[1].sector).toBe("municipal");
    expect(loggerMocks.info).toHaveBeenCalled();
  });

  it("continues discovery when one source path fails", async () => {
    const adapter = new CanliiAdapter();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        new Response('<a href="/en/on/onlrb/doc/2026/2026on1/2026on1.html">Ontario School Board</a>', {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const docs = await adapter.discover({
      searchPaths: ["https://www.canlii.org/en/ca/cirb/", "https://www.canlii.org/en/on/onlrb/"],
      maxPages: 2,
    });

    expect(docs).toHaveLength(1);
    expect(docs[0].jurisdiction).toBe("CA-ON");
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it("handles non-Error discovery failures", async () => {
    const adapter = new CanliiAdapter();
    vi.mocked(fetch).mockRejectedValueOnce("boom");
    await expect(
      adapter.discover({ searchPaths: ["https://www.canlii.org/en/ca/cirb/"], maxPages: 1 }),
    ).resolves.toEqual([]);
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it("fetches content with normalized text metadata", async () => {
    const adapter = new CanliiAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<html><body><h1>Decision</h1><p>Collective agreement</p></body></html>", { status: 200 }),
    );

    const result = await adapter.fetch("https://www.canlii.org/en/ca/cirb/doc/x.html", {});
    expect(result.contentType).toBe("text/html");
    expect(result.metadata?.source).toBe("canlii_legal");
    expect(String(result.metadata?.normalizedText)).toContain("Decision");
    expect(result.wordCount).toBeGreaterThan(1);
  });

  it("resolves private inference helpers through discovery outputs", async () => {
    const adapter = new CanliiAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          '<a href="/fr/qc/qctat/doc/2026/2026qc1/2026qc1.html">Université Construction Police Retail</a>',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const docs = await adapter.discover({ searchPaths: ["https://www.canlii.org/fr/qc/qctat/"], maxPages: 2 });
    expect(docs).toHaveLength(1);
    expect(docs[0].language).toBe("fr");
    expect(docs[0].jurisdiction).toBe("CA-QC");
    // First matching keyword branch in detectSectorFromText is construction.
    expect(docs[0].sector).toBe("construction");
  });

  it("covers private helper branches directly", () => {
    const adapter = new CanliiAdapter() as any as {
      detectJurisdiction: (url: string) => string;
      detectLanguage: (url: string) => "en" | "fr";
      detectSectorFromText: (text: string) => string | undefined;
      resolveUrl: (href: string, base: string) => string | null;
      parseCanliiListing: (html: string, pageUrl: string, boardUrl: string) => any[];
    };

    expect(adapter.detectJurisdiction("https://x/on/onlrb/")).toBe("CA-ON");
    expect(adapter.detectJurisdiction("https://x/bc/bclrb/")).toBe("CA-BC");
    expect(adapter.detectJurisdiction("https://x/ab/ablrb/")).toBe("CA-AB");
    expect(adapter.detectJurisdiction("https://x/qc/qctat/")).toBe("CA-QC");
    expect(adapter.detectJurisdiction("https://x/sk/sklrb/")).toBe("CA-SK");
    expect(adapter.detectJurisdiction("https://x/mb/mblrb/")).toBe("CA-MB");
    expect(adapter.detectJurisdiction("https://x/ns/")).toBe("CA-NS");
    expect(adapter.detectJurisdiction("https://x/nb/")).toBe("CA-NB");
    expect(adapter.detectJurisdiction("https://x/pe/")).toBe("CA-PE");
    expect(adapter.detectJurisdiction("https://x/nl/")).toBe("CA-NL");
    expect(adapter.detectJurisdiction("https://x/unknown/")).toBe("CA-FED");

    expect(adapter.detectLanguage("https://x/fr/qc")).toBe("fr");
    expect(adapter.detectLanguage("https://x/en/ca")).toBe("en");

    expect(adapter.detectSectorFromText("nurse and hospital")).toBe("healthcare");
    expect(adapter.detectSectorFromText("school and university")).toBe("education");
    expect(adapter.detectSectorFromText("construction building")).toBe("construction");
    expect(adapter.detectSectorFromText("city municipal workers")).toBe("municipal");
    expect(adapter.detectSectorFromText("police and fire")).toBe("protective_services");
    expect(adapter.detectSectorFromText("public transport transit")).toBe("transportation");
    expect(adapter.detectSectorFromText("retail food service")).toBe("retail");
    expect(adapter.detectSectorFromText("random text")).toBeUndefined();

    expect(adapter.resolveUrl("/en/ca/cirb/doc/1", "https://www.canlii.org")).toContain("/en/ca/cirb/doc/1");
    expect(adapter.resolveUrl("http://", "https://www.canlii.org")).toBeNull();

    const parsed = adapter.parseCanliiListing(
      '<a href="mailto:test@example.com">mail</a><a href="/en/ca/cirb/doc/2026/x.html">Valid Link</a>',
      "https://www.canlii.org/en/ca/cirb/",
      "https://www.canlii.org/en/ca/cirb/",
    );
    expect(parsed).toHaveLength(1);

    const parsedSkips = adapter.parseCanliiListing(
      [
        '<a href="#/doc/1">Anchor doc</a>',
        '<a href="javascript:/doc/1">Bad Scheme</a>',
        '<a href="/en/ca/cirb/doc/2">abc</a>',
        '<a href="http://[invalid]/doc/3">Broken URL</a>',
      ].join(""),
      "https://www.canlii.org/en/ca/cirb/",
      "https://www.canlii.org/en/ca/cirb/",
    );
    expect(parsedSkips).toHaveLength(0);
  });

  it("uses default discover config and stops when a page has no results", async () => {
    const adapter = new CanliiAdapter();
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));
    const docs = await adapter.discover({});
    expect(docs).toEqual([]);
  });
});
