import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * Adapter for HTML-based CBA information sources.
 *
 * Targets government labour-board websites that publish CBA summaries,
 * wage settlement bulletins, and collective agreement registries as HTML pages.
 *
 * Examples: Federal CIRB, Ontario LRB settlement listings, BC LRB bulletins.
 */
export class HtmlBulletinAdapter extends BaseAdapter {
  readonly key = "html_bulletin";
  readonly name = "HTML Bulletin Adapter";
  readonly version = "1.0.0";

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    const baseUrl = config.baseUrl as string | undefined;
    const feedUrl = config.feedUrl as string | undefined;
    const listUrl = feedUrl ?? baseUrl;

    if (!listUrl) {
      throw new Error("HtmlBulletinAdapter requires baseUrl or feedUrl in config");
    }

    try {
      const response = await this.fetchWithRetry(listUrl);
      const html = await response.text();
      return this.parseListPage(html, listUrl, config);
    } catch (error) {
      logger.error("HtmlBulletinAdapter discover failed", { error, listUrl });
      throw error;
    }
  }

  async fetch(
    sourceUrl: string,
    _config: Record<string, unknown>,
  ): Promise<FetchedContent> {
    const response = await this.fetchWithRetry(sourceUrl);
    const rawContent = await response.text();
    const normalizedText = this.stripHtml(rawContent);

    return {
      rawContent,
      contentType: "text/html",
      wordCount: normalizedText.split(/\s+/).length,
      metadata: {
        normalizedText,
      },
    };
  }

  /**
   * Parse a listing page to discover individual document links.
   * Override in source-specific subclass if needed.
   */
  private parseListPage(
    html: string,
    baseUrl: string,
    _config: Record<string, unknown>,
  ): DiscoveredDocument[] {
    const docs: DiscoveredDocument[] = [];
    // Generic link extraction — matches <a href="..."> tags
    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = this.stripHtml(match[2]).trim();

      // Filter for likely CBA-related links (heuristic)
      const lowerText = linkText.toLowerCase();
      const isCbaRelated =
        lowerText.includes("collective") ||
        lowerText.includes("agreement") ||
        lowerText.includes("convention") ||
        lowerText.includes("settlement") ||
        lowerText.includes("bargain") ||
        lowerText.includes("wage") ||
        lowerText.includes("négociation") ||
        lowerText.includes("convention collective");

      if (!isCbaRelated || !href || href.startsWith("#") || (href.includes(':') && !/^https?:/i.test(href))) {
        continue;
      }

      const resolvedUrl = new URL(href, baseUrl).toString();

      docs.push({
        sourceDocId: href,
        title: linkText.slice(0, 500),
        sourceUrl: resolvedUrl,
        documentType: "collective_agreement",
        language: this.detectLanguage(linkText),
      });
    }

    logger.info("HtmlBulletinAdapter discovered documents", {
      baseUrl,
      count: docs.length,
    });

    return docs;
  }

  private detectLanguage(text: string): "en" | "fr" | "bilingual" {
    const frIndicators = ["convention", "collective", "négociation", "travail", "emploi"];
    const enIndicators = ["agreement", "collective", "bargaining", "settlement", "union"];

    const lower = text.toLowerCase();
    const hasFr = frIndicators.some((w) => lower.includes(w));
    const hasEn = enIndicators.some((w) => lower.includes(w));

    if (hasFr && hasEn) return "bilingual";
    if (hasFr) return "fr";
    return "en";
  }
}
