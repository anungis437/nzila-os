import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
