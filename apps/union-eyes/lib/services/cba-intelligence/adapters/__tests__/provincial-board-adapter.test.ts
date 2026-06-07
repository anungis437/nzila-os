import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProvincialBoardAdapter } from "../provincial-board-adapter";

const loggerMocks = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

describe("ProvincialBoardAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers selected boards and deduplicates results", async () => {
    const adapter = new ProvincialBoardAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('<a href="/decision/1.pdf">Decision agreement</a>', { status: 200 }))
      .mockResolvedValueOnce(new Response('<a href="/decision/1.pdf">Decision agreement</a>', { status: 200 }))
      .mockRejectedValueOnce("down");

    const docs = await adapter.discover({ boards: ["olrb", "tat"] });
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(loggerMocks.info).toHaveBeenCalled();
  });

  it("returns empty result when requested boards do not exist", async () => {
    const adapter = new ProvincialBoardAdapter();
    await expect(adapter.discover({ boards: ["missing"] })).resolves.toEqual([]);
  });

  it("fetches board content and metadata", async () => {
    const adapter = new ProvincialBoardAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html><body>Board page</body></html>", { status: 200 }));
    const result = await adapter.fetch("https://example.ca/doc", {});
    expect(result.metadata?.source).toBe("provincial_board");

    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: () => null },
      text: async () => "Board page",
      ok: true,
    } as Response);
    const fallback = await adapter.fetch("https://example.ca/doc2", {});
    expect(fallback.contentType).toBe("text/html");
  });

  it("uses default boards when none are provided", async () => {
    const adapter = new ProvincialBoardAdapter();
    vi.mocked(fetch)
      .mockResolvedValue(new Response("", { status: 200 }));
    const docs = await adapter.discover({});
    expect(docs).toEqual([]);
  });

  it("covers private helper branches directly", () => {
    const adapter = new ProvincialBoardAdapter() as unknown as {
      isRelevantLink: (text: string, href: string) => boolean;
      classifyDocType: (text: string, href: string) => string;
      detectSector: (text: string) => string | undefined;
      detectLanguage: (text: string, href: string) => "en" | "fr" | "bilingual";
      resolveUrl: (href: string, baseUrl: string) => string | null;
      parseBoardPage: (html: string, baseUrl: string, board: { key: string; jurisdiction: string; language: "en" | "fr" | "bilingual" }) => unknown[];
    };

    expect(adapter.isRelevantLink("decision agreement", "x")).toBe(true);
    expect(adapter.isRelevantLink("random", "x")).toBe(false);
    expect(adapter.classifyDocType("arbitration", "x")).toBe("arbitration_decision");
    expect(adapter.classifyDocType("certification", "x")).toBe("certification_order");
    expect(adapter.classifyDocType("agreement", "x")).toBe("collective_agreement");
    expect(adapter.classifyDocType("x", "/file.pdf")).toBe("board_decision");
    expect(adapter.classifyDocType("x", "other")).toBe("board_decision");
    expect(adapter.detectSector("health hospital")).toBe("healthcare");
    expect(adapter.detectSector("education école")).toBe("education");
    expect(adapter.detectSector("construction")).toBe("construction");
    expect(adapter.detectSector("city ville municipal")).toBe("municipal");
    expect(adapter.detectSector("police pompier")).toBe("protective_services");
    expect(adapter.detectSector("transit transport")).toBe("transportation");
    expect(adapter.detectSector("other")).toBeUndefined();
    expect(adapter.detectLanguage("décision", "/fr/")).toBe("fr");
    expect(adapter.detectLanguage("english", "/en/")).toBe("en");
    expect(adapter.resolveUrl("/doc", "https://example.ca")).toBe("https://example.ca/doc");
    expect(adapter.resolveUrl("http://[invalid]", "https://example.ca")).toBeNull();

    const parsed = adapter.parseBoardPage(
      '<a href="/decision/1.pdf">Decision agreement</a><a href="">Decision agreement</a><a href="#">Decision agreement</a><a href="javascript:void(0)">Decision agreement</a><a href="/decision/short.pdf">A</a><a href="http://[invalid]">Decision agreement</a>',
      "https://example.ca",
      { key: "tat", jurisdiction: "CA-QC", language: "bilingual" },
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ jurisdiction: "CA-QC" });
  });

  it("returns empty result when no links exist", () => {
    const adapter = new ProvincialBoardAdapter() as unknown as {
      parseBoardPage: (html: string, baseUrl: string, board: { key: string; jurisdiction: string; language: "en" | "fr" | "bilingual" }) => unknown[];
    };
    expect(adapter.parseBoardPage("<html></html>", "https://example.ca", { key: "olrb", jurisdiction: "CA-ON", language: "en" })).toEqual([]);
    expect(adapter.parseBoardPage('<a href="/x">hello</a>', "https://example.ca", { key: "olrb", jurisdiction: "CA-ON", language: "en" })).toEqual([]);
  });
});
