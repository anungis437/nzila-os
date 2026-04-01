import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * FPSLREB (Federal Public Sector Labour Relations and Employment Board) Adapter
 *
 * The FPSLREB publishes:
 *  - Decisions and orders on grievances, complaints, and applications
 *  - Collective agreement summaries for federal public service
 *  - Arbitration awards between Treasury Board and federal unions (PSAC, PIPSC, CAPE, etc.)
 *
 * Source: https://www.fpslreb-crtespf.gc.ca/
 */
export class FpslrebAdapter extends BaseAdapter {
  readonly key = "fpslreb";
  readonly name = "Federal Public Sector Labour Relations and Employment Board";
  readonly version = "1.0.0";

  private static readonly BASE_URLS = [
    "https://www.fpslreb-crtespf.gc.ca/en/decisions/index.html",
    "https://www.fpslreb-crtespf.gc.ca/en/decisions/arbitration.html",
  ];

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    const urls = (config.urls as string[]) ?? FpslrebAdapter.BASE_URLS;
    const allDocs: DiscoveredDocument[] = [];

    for (const url of urls) {
      try {
        const response = await this.fetchWithRetry(url);
        const html = await response.text();
        const docs = this.parseDecisionListing(html, url);
        allDocs.push(...docs);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn("FPSLREB adapter: failed to discover", { url, error: msg });
      }
    }

    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      if (seen.has(d.sourceUrl)) return false;
      seen.add(d.sourceUrl);
      return true;
    });

    logger.info("FPSLREB adapter: discovered documents", { count: unique.length });
    return unique;
  }

  async fetch(sourceUrl: string, _config: Record<string, unknown>): Promise<FetchedContent> {
    const response = await this.fetchWithRetry(sourceUrl);
    const rawContent = await response.text();
    const normalizedText = this.stripHtml(rawContent);

    return {
      rawContent,
      contentType: response.headers.get("content-type") ?? "text/html",
      wordCount: normalizedText.split(/\s+/).length,
      metadata: {
        normalizedText,
        source: "fpslreb",
      },
    };
  }

  private parseDecisionListing(html: string, baseUrl: string): DiscoveredDocument[] {
    const docs: DiscoveredDocument[] = [];

    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = this.stripHtml(match[2]).trim();

      // FPSLREB decision links typically contain year/case references
      const isDecision =
        href.includes("/decisions/") ||
        href.includes("/cas/") ||
        /\d{4}/.test(linkText);

      if (!isDecision) continue;
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      if (linkText.length < 3) continue;

      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }

      docs.push({
        sourceDocId: href,
        title: linkText.slice(0, 500),
        sourceUrl: resolvedUrl,
        documentType: "arbitration_decision",
        language: baseUrl.includes("/fr/") ? "fr" : "en",
        jurisdiction: "CA-FED",
        sector: "public_federal",
      });
    }

    return docs;
  }
}
