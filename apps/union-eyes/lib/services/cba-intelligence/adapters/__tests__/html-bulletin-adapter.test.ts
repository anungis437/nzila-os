import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWithRetry: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, info: mocks.loggerInfo, warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("../base-adapter", () => {
  class FakeBaseAdapter {
    fetchWithRetry = mocks.fetchWithRetry;
    protected stripHtml(input: string): string {
      return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return { BaseAdapter: FakeBaseAdapter };
});

describe("HtmlBulletinAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a baseUrl or feedUrl", async () => {
    const { HtmlBulletinAdapter } = await import("../html-bulletin-adapter");
    const adapter = new HtmlBulletinAdapter();
    await expect(adapter.discover({})).rejects.toThrow("requires baseUrl or feedUrl");
  });

  it("discovers only CBA-related valid links", async () => {
    const { HtmlBulletinAdapter } = await import("../html-bulletin-adapter");
    const adapter = new HtmlBulletinAdapter();

    mocks.fetchWithRetry.mockResolvedValueOnce({
      text: async () =>
        [
          '<a href="/collective/1">Collective agreement update</a>',
          '<a href="#skip">collective agreement anchor</a>',
          '<a href="mailto:test@example.com">collective agreement email</a>',
          '<a href="https://example.org/fr">Convention collective et agreement</a>',
          '<a href="/other">General bulletin</a>',
        ].join("\n"),
    });

    const docs = await adapter.discover({ baseUrl: "https://example.com/root" });
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({
      sourceUrl: "https://example.com/collective/1",
      documentType: "collective_agreement",
      language: "bilingual",
    });
    expect(docs[1].language).toBe("bilingual");
  });

  it("detects French-only bulletin links", async () => {
    const { HtmlBulletinAdapter } = await import("../html-bulletin-adapter");
    const adapter = new HtmlBulletinAdapter();

    mocks.fetchWithRetry.mockResolvedValueOnce({
      text: async () => '<a href="/fr/doc">Négociation du travail</a>',
    });

    const docs = await adapter.discover({ baseUrl: "https://example.com" });
    expect(docs).toHaveLength(1);
    expect(docs[0].language).toBe("fr");
  });

  it("falls back to English when no French indicators are present", async () => {
    const { HtmlBulletinAdapter } = await import("../html-bulletin-adapter");
    const adapter = new HtmlBulletinAdapter();

    mocks.fetchWithRetry.mockResolvedValueOnce({
      text: async () => '<a href="/en/doc">Union settlement update</a>',
    });

    const docs = await adapter.discover({ baseUrl: "https://example.com" });
    expect(docs).toHaveLength(1);
    expect(docs[0].language).toBe("en");
  });

  it("wraps discover failures with logging", async () => {
    const { HtmlBulletinAdapter } = await import("../html-bulletin-adapter");
    const adapter = new HtmlBulletinAdapter();

    mocks.fetchWithRetry.mockRejectedValueOnce(new Error("network down"));
    await expect(adapter.discover({ feedUrl: "https://example.com/feed" })).rejects.toThrow("network down");
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("fetches and normalizes html content", async () => {
    const { HtmlBulletinAdapter } = await import("../html-bulletin-adapter");
    const adapter = new HtmlBulletinAdapter();

    mocks.fetchWithRetry.mockResolvedValueOnce({
      text: async () => "<h1>Collective Agreement</h1><p>Wage increase 2%</p>",
    });

    const fetched = await adapter.fetch("https://example.com/doc", {});
    expect(fetched.contentType).toBe("text/html");
    expect(fetched.rawContent).toContain("Collective Agreement");
    expect(fetched.wordCount).toBeGreaterThan(0);
    expect((fetched.metadata as { normalizedText?: string }).normalizedText).toContain("Wage increase");
  });
});
