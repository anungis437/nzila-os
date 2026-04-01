import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * CanLII (Canadian Legal Information Institute) Adapter
 *
 * Targets CanLII's publicly accessible labour arbitration decisions and
 * collective agreement references:
 *  - https://www.canlii.org/en/
 *  - Labour arbitration boards across all provinces
 *
 * Uses HTML scraping of CanLII search results for labour/arbitration topics
 * since CanLII doesn't offer a public REST API for bulk access.
 *
 * Focuses on:
 *  - Federal: Canada Industrial Relations Board (CIRB)
 *  - Provincial labour board decisions referencing CBAs
 *  - Arbitration awards with CBA clause analysis
 */
export class CanliiAdapter extends BaseAdapter {
  readonly key = "canlii_legal";
  readonly name = "CanLII Legal Resources";
  readonly version = "1.0.0";

  private static readonly SEARCH_BASE = "https://www.canlii.org/en/#search";
  private static readonly CIRB_URL =
    "https://www.canlii.org/en/ca/cirb/";
  private static readonly LABOUR_SEARCH_PATHS = [
    // Federal industrial relations
    "https://www.canlii.org/en/ca/cirb/",
    // Ontario Labour Relations Board
    "https://www.canlii.org/en/on/onlrb/",
    // BC Labour Relations Board
    "https://www.canlii.org/en/bc/bclrb/",
    // Alberta Labour Relations Board
    "https://www.canlii.org/en/ab/ablrb/",
    // Quebec Administrative Labour Tribunal
    "https://www.canlii.org/en/qc/qctat/",
    // Saskatchewan Labour Relations Board
    "https://www.canlii.org/en/sk/sklrb/",
    // Manitoba Labour Board
    "https://www.canlii.org/en/mb/mblrb/",
  ];

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    const searchPaths = (config.searchPaths as string[]) ?? CanliiAdapter.LABOUR_SEARCH_PATHS;
    const maxPagesPerSource = (config.maxPages as number) ?? 3;

    const allDocs: DiscoveredDocument[] = [];

    for (const searchUrl of searchPaths) {
      try {
        // Discover from listing/index pages
        for (let page = 1; page <= maxPagesPerSource; page++) {
          const url = page === 1 ? searchUrl : `${searchUrl}?page=${page}`;
          const response = await this.fetchWithRetry(url);
          const html = await response.text();
          const docs = this.parseCanliiListing(html, url, searchUrl);
          allDocs.push(...docs);

          // Stop pagination if no new results
          if (docs.length === 0) break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn("CanLII adapter: failed to discover from path", {
          searchUrl,
          error: msg,
        });
      }
    }

    // Deduplicate by sourceUrl
    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      if (seen.has(d.sourceUrl)) return false;
      seen.add(d.sourceUrl);
      return true;
    });

    logger.info("CanLII adapter: discovered documents", { count: unique.length });
    return unique;
  }

  async fetch(sourceUrl: string, _config: Record<string, unknown>): Promise<FetchedContent> {
    const response = await this.fetchWithRetry(sourceUrl);
    const rawContent = await response.text();
    const normalizedText = this.stripHtml(rawContent);

    return {
      rawContent,
      contentType: "text/html",
      wordCount: normalizedText.split(/\s+/).length,
      metadata: {
        normalizedText,
        source: "canlii_legal",
      },
    };
  }

  /**
   * Parse CanLII listing pages for decision/document links.
   * CanLII uses a consistent structure:
   *   <a class="decision" href="/en/xx/board/doc/...">Title</a>
   *   <a href="/en/xx/board/doc/2026/2026xxxNNN/2026xxxNNN.html">...</a>
   */
  private parseCanliiListing(
    html: string,
    pageUrl: string,
    boardUrl: string,
  ): DiscoveredDocument[] {
    const docs: DiscoveredDocument[] = [];

    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = this.stripHtml(match[2]).trim();

      // Only consider links that point to CanLII case documents
      if (!href.includes("/doc/") && !href.includes("/case/")) continue;
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      if (linkText.length < 5) continue;

      const resolvedUrl = this.resolveUrl(href, pageUrl);
      if (!resolvedUrl) continue;

      const jurisdiction = this.detectJurisdiction(boardUrl);

      docs.push({
        sourceDocId: href,
        title: linkText.slice(0, 500),
        sourceUrl: resolvedUrl,
        documentType: "arbitration_decision",
        language: this.detectLanguage(pageUrl),
        jurisdiction,
        sector: this.detectSectorFromText(linkText),
      });
    }

    return docs;
  }

  private detectJurisdiction(boardUrl: string): string {
    if (boardUrl.includes("/ca/")) return "CA-FED";
    if (boardUrl.includes("/on/")) return "CA-ON";
    if (boardUrl.includes("/bc/")) return "CA-BC";
    if (boardUrl.includes("/ab/")) return "CA-AB";
    if (boardUrl.includes("/qc/")) return "CA-QC";
    if (boardUrl.includes("/sk/")) return "CA-SK";
    if (boardUrl.includes("/mb/")) return "CA-MB";
    if (boardUrl.includes("/ns/")) return "CA-NS";
    if (boardUrl.includes("/nb/")) return "CA-NB";
    if (boardUrl.includes("/pe/")) return "CA-PE";
    if (boardUrl.includes("/nl/")) return "CA-NL";
    return "CA-FED";
  }

  private detectLanguage(url: string): "en" | "fr" {
    return url.includes("/fr/") ? "fr" : "en";
  }

  private detectSectorFromText(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("health") || lower.includes("hospital") || lower.includes("nurse")) return "healthcare";
    if (lower.includes("education") || lower.includes("school") || lower.includes("university")) return "education";
    if (lower.includes("construction") || lower.includes("building")) return "construction";
    if (lower.includes("municipal") || lower.includes("city") || lower.includes("town")) return "municipal";
    if (lower.includes("police") || lower.includes("fire")) return "protective_services";
    if (lower.includes("transport") || lower.includes("transit")) return "transportation";
    if (lower.includes("retail") || lower.includes("food")) return "retail";
    return undefined;
  }

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }
}
