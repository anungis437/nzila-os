import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * Union Bargaining Updates Adapter
 *
 * Discovers collective bargaining updates, ratification notices,
 * and settlement announcements from major Canadian union websites:
 *
 *  - CUPE (Canadian Union of Public Employees) — largest public sector union
 *  - Unifor — largest private sector union
 *  - USW (United Steelworkers) — industrial, mining, forestry
 *  - PSAC (Public Service Alliance of Canada) — federal public service
 *  - UFCW (United Food and Commercial Workers)
 *  - CUPW (Canadian Union of Postal Workers)
 *  - IBEW (International Brotherhood of Electrical Workers)
 *
 * These sources provide near-real-time signals about new CBAs,
 * ratification votes, strike actions, and wage settlements.
 */

interface UnionSource {
  key: string;
  name: string;
  urls: string[];
  jurisdiction: string;
  sectors: string[];
}

export class UnionBargainingAdapter extends BaseAdapter {
  readonly key = "union_bargaining";
  readonly name = "Union Bargaining Updates";
  readonly version = "1.0.0";

  private static readonly UNION_SOURCES: UnionSource[] = [
    {
      key: "cupe",
      name: "Canadian Union of Public Employees",
      urls: [
        "https://cupe.ca/bargaining",
        "https://cupe.ca/settlements",
      ],
      jurisdiction: "CA-FED",
      sectors: ["public", "healthcare", "education", "municipal"],
    },
    {
      key: "unifor",
      name: "Unifor",
      urls: [
        "https://www.unifor.org/campaigns/bargaining",
      ],
      jurisdiction: "CA-FED",
      sectors: ["auto", "media", "telecommunications", "transportation"],
    },
    {
      key: "usw",
      name: "United Steelworkers",
      urls: [
        "https://www.usw.ca/news",
      ],
      jurisdiction: "CA-FED",
      sectors: ["mining", "manufacturing", "forestry", "steel"],
    },
    {
      key: "psac",
      name: "Public Service Alliance of Canada",
      urls: [
        "https://psacunion.ca/bargaining",
      ],
      jurisdiction: "CA-FED",
      sectors: ["public_federal"],
    },
    {
      key: "ufcw",
      name: "United Food and Commercial Workers",
      urls: [
        "https://www.ufcw.ca/index.php?option=com_content&view=category&layout=blog&id=6&Itemid=104&lang=en",
      ],
      jurisdiction: "CA-FED",
      sectors: ["retail", "food_processing", "hospitality"],
    },
  ];

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    const targetUnions = (config.unions as string[]) ?? undefined;
    const sources = targetUnions
      ? UnionBargainingAdapter.UNION_SOURCES.filter((u) => targetUnions.includes(u.key))
      : UnionBargainingAdapter.UNION_SOURCES;

    const allDocs: DiscoveredDocument[] = [];

    for (const union of sources) {
      for (const url of union.urls) {
        try {
          const response = await this.fetchWithRetry(url);
          const html = await response.text();
          const docs = this.parseUnionPage(html, url, union);
          allDocs.push(...docs);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.warn(`Union adapter: failed ${union.key}`, { url, error: msg });
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = allDocs.filter((d) => {
      if (seen.has(d.sourceUrl)) return false;
      seen.add(d.sourceUrl);
      return true;
    });

    logger.info("Union bargaining adapter: discovered documents", {
      count: unique.length,
      unions: sources.map((u) => u.key),
    });

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
        source: "union_bargaining",
      },
    };
  }

  private parseUnionPage(
    html: string,
    baseUrl: string,
    union: UnionSource,
  ): DiscoveredDocument[] {
    const docs: DiscoveredDocument[] = [];

    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = this.stripHtml(match[2]).trim();

      if (!this.isRelevantLink(linkText)) continue;
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
      if (linkText.length < 5) continue;

      const resolvedUrl = this.resolveUrl(href, baseUrl);
      if (!resolvedUrl) continue;

      docs.push({
        sourceDocId: `${union.key}-${href}`,
        title: linkText.slice(0, 500),
        sourceUrl: resolvedUrl,
        documentType: this.classifyDocType(linkText),
        language: this.detectLanguage(linkText, resolvedUrl),
        jurisdiction: union.jurisdiction,
        sector: union.sectors[0],
      });
    }

    return docs;
  }

  private isRelevantLink(text: string): boolean {
    const lower = text.toLowerCase();
    const keywords = [
      "bargain", "ratif", "settlement", "agreement", "negotiate",
      "contract", "strike", "lockout", "arbitrat", "wage",
      "collective", "worker", "member", "deal", "tentative",
      "convention", "négociation", "grève", "entente",
    ];
    return keywords.some((kw) => lower.includes(kw));
  }

  private classifyDocType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("ratif")) return "ratification_notice";
    if (lower.includes("settlement") || lower.includes("deal") || lower.includes("entente")) return "settlement_notice";
    if (lower.includes("strike") || lower.includes("grève") || lower.includes("lockout")) return "work_stoppage";
    if (lower.includes("arbitrat")) return "arbitration_decision";
    return "bargaining_update";
  }

  private detectLanguage(text: string, url: string): "en" | "fr" | "bilingual" {
    if (url.includes("/fr/") || url.includes("lang=fr")) return "fr";
    const frIndicators = ["convention", "négociation", "grève", "entente", "travail"];
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
