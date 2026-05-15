import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * ESDC (Employment and Social Development Canada) Adapter
 *
 * Targets the Federal Mediation and Conciliation Service (FMCS) and
 * ESDC Labour Program major wage settlement data:
 *  - https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data/wage-settlements.html
 *  - https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data.html
 *
 * Discovers settlement bulletins, statistical releases, and CBA summaries
 * published by the federal government covering 500+ bargaining units.
 */
export class EsdcFederalAdapter extends BaseAdapter {
  readonly key = "esdc_federal";
  readonly name = "ESDC Federal Labour Program";
  readonly version = "1.0.0";

  private static readonly WAGE_SETTLEMENT_URL =
    "https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data/wage-settlements.html";

  private static readonly CBA_DATA_URL =
    "https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data.html";

  private static readonly FMCS_URL =
    "https://www.canada.ca/en/employment-social-development/services/labour-relations/collective-bargaining.html";

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    const urls = [
      config.wageSettlementUrl as string ?? EsdcFederalAdapter.WAGE_SETTLEMENT_URL,
      config.cbaDataUrl as string ?? EsdcFederalAdapter.CBA_DATA_URL,
      config.fmcsUrl as string ?? EsdcFederalAdapter.FMCS_URL,
    ];

    const allDocs: DiscoveredDocument[] = [];

    for (const url of urls) {
      try {
        const response = await this.fetchWithRetry(url);
        const html = await response.text();
        const docs = this.parseCanadaPage(html, url);
        allDocs.push(...docs);
      } catch (error) {
        logger.warn("ESDC adapter: failed to discover from URL", { url, error });
      }
    }

    // Deduplicate by sourceUrl
    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      if (seen.has(d.sourceUrl)) return false;
      seen.add(d.sourceUrl);
      return true;
    });

    logger.info("ESDC adapter: discovered documents", { count: unique.length });
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
        source: "esdc_federal",
      },
    };
  }

  /**
   * Parse canada.ca pages for CBA-related links.
   * Canada.ca uses a specific HTML structure with <main> content areas.
   */
  private parseCanadaPage(html: string, baseUrl: string): DiscoveredDocument[] {
    const docs: DiscoveredDocument[] = [];

    // Extract links from the main content area
    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = this.stripHtml(match[2]).trim();

      if (!this.isCbaRelated(linkText, href)) continue;
      if (!href || href.startsWith("#") || (href.includes(':') && !/^https?:/i.test(href))) continue;

      const resolvedUrl = this.resolveUrl(href, baseUrl);
      if (!resolvedUrl) continue;

      docs.push({
        sourceDocId: href,
        title: linkText.slice(0, 500),
        sourceUrl: resolvedUrl,
        documentType: this.classifyDocType(linkText),
        language: this.detectLanguage(linkText, resolvedUrl),
        jurisdiction: "CA-FED",
        sector: this.detectSector(linkText),
      });
    }

    return docs;
  }

  private isCbaRelated(text: string, href: string): boolean {
    const lower = (text + " " + href).toLowerCase();
    const keywords = [
      "collective", "bargaining", "agreement", "settlement",
      "wage", "negotiation", "arbitration", "labour", "labor",
      "convention collective", "négociation", "salaire",
      "conciliation", "mediation", "strike", "lockout",
      "bulletin", "major settlement", "wage adjustment",
    ];
    return keywords.some((kw) => lower.includes(kw));
  }

  private classifyDocType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("settlement") || lower.includes("bulletin")) return "wage_settlement";
    if (lower.includes("arbitration")) return "arbitration_decision";
    if (lower.includes("statistics") || lower.includes("data")) return "statistical_report";
    return "collective_agreement";
  }

  private detectSector(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("public") || lower.includes("federal")) return "public_federal";
    if (lower.includes("transport") || lower.includes("rail")) return "transportation";
    if (lower.includes("telecom")) return "telecommunications";
    if (lower.includes("bank") || lower.includes("financial")) return "banking";
    if (lower.includes("postal") || lower.includes("mail")) return "postal";
    return undefined;
  }

  private detectLanguage(text: string, url: string): "en" | "fr" | "bilingual" {
    if (url.includes("/fr/")) return "fr";
    const frIndicators = ["convention", "négociation", "travail", "salaire"];
    const lower = text.toLowerCase();
    if (frIndicators.some((w) => lower.includes(w))) return "bilingual";
    return "en";
  }

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }
}
