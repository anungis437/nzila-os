import type { IngestionAdapter, DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

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
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "NzilaOS-CBAIntel/1.0 (+https://nzila.io/cba-intel)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (retries > 0 && response.status >= 500) {
          logger.warn(`Retrying ${url} (${response.status}), ${retries} retries left`);
          return this.fetchWithRetry(url, options, retries - 1);
        }
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      return response;
    } catch (error) {
      if (retries > 0 && error instanceof Error && error.name === "AbortError") {
        logger.warn(`Timeout fetching ${url}, retrying`);
        return this.fetchWithRetry(url, options, retries - 1);
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
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
