import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger before imports
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { HtmlBulletinAdapter } from "@/lib/services/cba-intelligence/adapters/html-bulletin-adapter";

describe("HtmlBulletinAdapter", () => {
  let adapter: HtmlBulletinAdapter;

  beforeEach(() => {
    adapter = new HtmlBulletinAdapter();
  });

  it("has the correct key, name, and version", () => {
    expect(adapter.key).toBe("html_bulletin");
    expect(adapter.name).toBe("HTML Bulletin Adapter");
    expect(adapter.version).toBe("1.0.0");
  });

  it("throws when config has no baseUrl or feedUrl", async () => {
    await expect(adapter.discover({})).rejects.toThrow(
      "HtmlBulletinAdapter requires baseUrl or feedUrl in config",
    );
  });

  it("discovers CBA-related links from HTML", async () => {
    const fakeHtml = `
      <html><body>
        <a href="/docs/collective-agreement-2026.pdf">Collective Agreement – CUPE Local 200</a>
        <a href="">Collective Agreement Empty Link</a>
        <a href="/contact">Contact Us</a>
        <a href="/docs/wage-settlement-report.html">Wage Settlement Report 2026</a>
        <a href="#top">Back to top</a>
        <a href="javascript:void(0)">Print</a>
      </body></html>
    `;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(fakeHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca/cba" });

    expect(docs.length).toBe(2);
    expect(docs[0].sourceUrl).toBe("https://example.ca/docs/collective-agreement-2026.pdf");
    expect(docs[0].title).toContain("Collective Agreement");
    expect(docs[1].sourceUrl).toBe("https://example.ca/docs/wage-settlement-report.html");

    fetchSpy.mockRestore();
  });

  it("detects French language from link text", async () => {
    const fakeHtml = `
      <html><body>
        <a href="/fr/convention-negociation">Convention négociation travail emploi</a>
      </body></html>
    `;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(fakeHtml, { status: 200 }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca" });
    expect(docs.length).toBe(1);
    expect(docs[0].language).toBe("fr");

    fetchSpy.mockRestore();
  });

  it("detects English-only language from link text", async () => {
    const fakeHtml = `
      <html><body>
        <a href="/en/agreement-settlement">Agreement Wage Settlement Union</a>
      </body></html>
    `;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(fakeHtml, { status: 200 }),
    );

    const docs = await adapter.discover({ baseUrl: "https://example.ca" });
    expect(docs).toHaveLength(1);
    expect(docs[0].language).toBe("en");

    fetchSpy.mockRestore();
  });

  it("rethrows and logs discover failures", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network fail"));

    await expect(adapter.discover({ baseUrl: "https://example.ca" })).rejects.toThrow("network fail");

    fetchSpy.mockRestore();
  });

  it("skips empty href CBA links during list parsing", () => {
    const parsed = (adapter as any as {
      parseListPage: (html: string, baseUrl: string, config: Record<string, unknown>) => any[];
    }).parseListPage(
      '<a href="">Collective Agreement Empty Link</a><a href="#top">Collective Agreement Anchor Link</a><a href="javascript:void(0)">Collective Agreement Script Link</a>',
      "https://example.ca",
      {},
    );

    expect(parsed).toEqual([]);
  });

  it("fetches and returns normalized content", async () => {
    const htmlContent = `<html><body><p>Collective Agreement between CUPE and City</p></body></html>`;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(htmlContent, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const result = await adapter.fetch("https://example.ca/doc/1", {});
    expect(result.contentType).toBe("text/html");
    expect(result.rawContent).toContain("Collective Agreement");
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.metadata?.normalizedText).toBeDefined();

    fetchSpy.mockRestore();
  });
});
