import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The fetch guard now resolves the host (B91); the fixtures use names that do not exist, so they resolve to a public address.
vi.mock('node:dns/promises', () => ({ lookup: async () => [{ address: '93.184.216.34', family: 4 }] }));
import { BaseAdapter } from "../base-adapter";

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: loggerMocks }));

class TestAdapter extends BaseAdapter {
  readonly key = "test";
  readonly name = "Test Adapter";
  readonly version = "1.0.0";

  async discover(): Promise<[]> {
    return [];
  }

  async fetchWithRetryPublic(url: string, options?: RequestInit, retries?: number) {
    return this.fetchWithRetry(url, options, retries);
  }

  stripHtmlPublic(html: string) {
    return this.stripHtml(html);
  }
}

describe("BaseAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetch defaults content type to text/html and counts words", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
      text: async () => "hello world",
    } as Response);

    const result = await adapter.fetch("https://example.com", {});
    expect(result.contentType).toBe("text/html");
    expect(result.wordCount).toBe(2);
  });

  // DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS
  it.each(["http://169.254.169.254/latest/meta-data", "http://localhost:5432/", "file:///etc/passwd", "http://10.0.0.1/admin"])(
    "refuses to fetch %s and makes no request",
    async (url) => {
      const adapter = new TestAdapter();
      await expect(adapter.fetchWithRetryPublic(url)).rejects.toMatchObject({ code: "OUTBOUND_URL_REFUSED" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("follows a redirect by hand and checks the next address again", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));

    await expect(adapter.fetchWithRetryPublic("https://example.com/start")).rejects.toMatchObject({ code: "OUTBOUND_URL_REFUSED" });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("follows a redirect to another public address, resolving a relative location", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final.pdf" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await adapter.fetchWithRetryPublic("https://example.com/start");

    expect(response.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[1]![0]).toBe("https://example.com/final.pdf");
  });

  it("stops after three redirects", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://example.com/again" } }));
    await expect(adapter.fetchWithRetryPublic("https://example.com/start")).rejects.toThrow("redirects");
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("refuses a source document larger than the allowed size", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, headers: { get: () => null }, text: async () => "x".repeat(10_000_001) } as Response);
    await expect(adapter.fetch("https://example.com", {})).rejects.toThrow("larger than the allowed size");
  });

  it("refuses a declared oversized response before consuming its body", async () => {
    const adapter = new TestAdapter();
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fetch).mockResolvedValueOnce({
      headers: { get: (name: string) => name === "content-length" ? "10000001" : null },
      body: { cancel },
      ok: true,
    } as unknown as Response);
    await expect(adapter.fetch("https://example.com/large", {})).rejects.toThrow("larger than the allowed size");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("refuses an oversized streaming response even when Content-Length is absent", async () => {
    const adapter = new TestAdapter();
    let emitted = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (emitted++ < 2) controller.enqueue(new Uint8Array(6_000_000));
        else controller.close();
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(stream, { status: 200 }));
    await expect(adapter.fetch("https://example.com/large", {})).rejects.toThrow("larger than the allowed size");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("decodes multi-byte UTF-8 split across streaming chunks", async () => {
    const adapter = new TestAdapter();
    const encoded = new TextEncoder().encode("A café B");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 6));
        controller.enqueue(encoded.slice(6));
        controller.close();
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(stream, { status: 200 }));
    const result = await adapter.fetch("https://example.com/text", {});
    expect(result.rawContent).toBe("A café B");
    expect(result.wordCount).toBe(3);
  });

  it("retries on 5xx responses and preserves custom headers", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("server error", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "content-type": "application/pdf" } }));

    const response = await adapter.fetchWithRetryPublic("https://example.com", {
      headers: { Authorization: "Bearer token" },
    });

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it("does not retry on non-5xx HTTP responses", async () => {
    const adapter = new TestAdapter();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("missing", { status: 404 }));

    await expect(adapter.fetchWithRetryPublic("https://example.com", {}, 2)).rejects.toThrow(
      "HTTP 404 fetching https://example.com",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on AbortError and rethrows other failures", async () => {
    const adapter = new TestAdapter();
    const abort = new Error("timeout");
    abort.name = "AbortError";

    vi.mocked(fetch)
      .mockRejectedValueOnce(abort)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await adapter.fetchWithRetryPublic("https://example.com", {}, 2);
    expect(response.status).toBe(200);
    expect(loggerMocks.warn).toHaveBeenCalled();

    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    await expect(adapter.fetchWithRetryPublic("https://example.com", {}, 1)).rejects.toThrow("network down");
  });

  it("aborts via timeout callback and retries", async () => {
    vi.useFakeTimers();
    const adapter = new TestAdapter();
    let firstCall = true;

    vi.mocked(fetch).mockImplementation((_, init) => {
      if (!firstCall) {
        return Promise.resolve(new Response("ok", { status: 200 }));
      }
      firstCall = false;
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal;
        signal.addEventListener("abort", () => {
          const error = new Error("timed out");
          error.name = "AbortError";
          reject(error);
        });
      });
    });

    const pending = adapter.fetchWithRetryPublic("https://example.com", {}, 2);
    await vi.advanceTimersByTimeAsync(30_000);
    const response = await pending;
    expect(response.status).toBe(200);
    vi.useRealTimers();
  });

  it("strips scripts, styles, tags, and collapses whitespace", () => {
    const adapter = new TestAdapter();
    const result = adapter.stripHtmlPublic(
      '<style>.x{}</style><script>alert(1)</script><div>Hello <strong>world</strong></div>\n\n<p>Next</p>',
    );
    expect(result).toBe("Hello world Next");
  });
});
