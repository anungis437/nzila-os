import type { IngestionAdapter, DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";
import { assertPublicHttpUrl } from "@/lib/security/outbound-url";

/** A source page larger than this is refused rather than read whole into memory. */
const MAX_SOURCE_CHARACTERS = 10_000_000;
const MAX_REDIRECTS = 3;

/**
 * Base adapter with shared fetch/retry/timeout logic.
 * Concrete adapters extend this and implement `discover` + `parseResponse`.
 */
export abstract class BaseAdapter implements IngestionAdapter {
  abstract readonly key: string;
  abstract readonly name: string;
  abstract readonly version: string;

  protected readonly defaultTimeoutMs = 30_000;
  protected readonly maxRetries = 2;

  abstract discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]>;

  async fetch(
    sourceUrl: string,
    _config: Record<string, unknown>,
  ): Promise<FetchedContent> {
    const response = await this.fetchWithRetry(sourceUrl);
    const contentType = response.headers.get("content-type") ?? "text/html";
    const rawContent = await response.text();
    if (rawContent.length > MAX_SOURCE_CHARACTERS) throw new Error("Source document is larger than the allowed size");

    return {
      rawContent,
      contentType,
      wordCount: rawContent.split(/\s+/).length,
    };
  }

  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = this.maxRetries,
    redirects = 0,
  ): Promise<Response> {
    // The address comes from a configured source or a discovered link: only a public http(s) address is fetched, and a
    // redirect is followed by hand so each hop is checked again.
    assertPublicHttpUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "NzilaOS-CBAIntel/1.0 (+https://nzila.io/cba-intel)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...options.headers,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get?.("location");
        if (!location || redirects >= MAX_REDIRECTS) throw new Error(`Too many or empty redirects fetching ${url}`);
        return this.fetchWithRetry(new URL(location, url).href, options, retries, redirects + 1);
      }

      if (!response.ok) {
        if (retries > 0 && response.status >= 500) {
          logger.warn(`Retrying ${url} (${response.status}), ${retries} retries left`);
          return this.fetchWithRetry(url, options, retries - 1, redirects);
        }
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      return response;
    } catch (error) {
      if (retries > 0 && error instanceof Error && error.name === "AbortError") {
        logger.warn(`Timeout fetching ${url}, retrying`);
        return this.fetchWithRetry(url, options, retries - 1, redirects);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extract plain text from HTML, stripping tags.
   * Used by HTML-based adapters during normalization.
   */
  protected stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "") // codeql[js/bad-tag-filter] - plain-text extraction for AI, not security sanitization
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ") // codeql[js/bad-tag-filter] - used for text extraction only
      .replace(/\s+/g, " ")
      .trim();
  }
}
