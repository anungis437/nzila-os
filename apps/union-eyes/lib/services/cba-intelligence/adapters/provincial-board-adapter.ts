import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * Provincial Labour Relations Board Adapter
 *
 * Covers major provincial labour boards that publish CBA-related decisions,
 * wage settlements, and collective agreement registries:
 *
 *  - OLRB  (Ontario Labour Relations Board)
 *  - BCLRB (British Columbia Labour Relations Board)
 *  - ALRB  (Alberta Labour Relations Board)
 *  - TAT   (Tribunal administratif du travail, Quebec — CNESST successor)
 *  - SLRB  (Saskatchewan Labour Relations Board)
 *  - MLRB  (Manitoba Labour Board)
 *
 * Each board has its own HTML structure; the adapter uses per-board
 * configuration with shared discovery/fetch logic.
 */

interface BoardConfig {
  key: string;
  name: string;
  jurisdiction: string;
  urls: string[];
  language: "en" | "fr" | "bilingual";
}

export class ProvincialBoardAdapter extends BaseAdapter {
  readonly key = "provincial_board";
  readonly name = "Provincial Labour Relations Boards";
  readonly version = "1.0.0";

  private static readonly BOARDS: BoardConfig[] = [
    {
      key: "olrb",
      name: "Ontario Labour Relations Board",
      jurisdiction: "CA-ON",
      urls: [
        "https://www.olrb.gov.on.ca/Decision/decisions.htm",
        "https://www.olrb.gov.on.ca/",
      ],
      language: "en",
    },
    {
      key: "bclrb",
      name: "BC Labour Relations Board",
      jurisdiction: "CA-BC",
      urls: [
        "https://www.lrb.bc.ca/decisions",
        "https://www.lrb.bc.ca/",
      ],
      language: "en",
    },
    {
      key: "alrb",
      name: "Alberta Labour Relations Board",
      jurisdiction: "CA-AB",
      urls: [
        "https://www.alrb.gov.ab.ca/decisions/",
        "https://www.alrb.gov.ab.ca/",
      ],
      language: "en",
    },
    {
      key: "tat",
      name: "Tribunal administratif du travail (Quebec)",
      jurisdiction: "CA-QC",
      urls: [
        "https://www.tat.gouv.qc.ca/en/documentation/decisions/",
        "https://www.tat.gouv.qc.ca/documentation/decisions/",
      ],
      language: "bilingual",
    },
    {
      key: "slrb",
      name: "Saskatchewan Labour Relations Board",
      jurisdiction: "CA-SK",
      urls: [
        "https://www.sasklabourrelationsboard.com/decisions",
      ],
      language: "en",
    },
    {
      key: "mlrb",
      name: "Manitoba Labour Board",
      jurisdiction: "CA-MB",
      urls: [
        "https://www.manitobalabourboard.mb.ca/decisions.html",
      ],
      language: "en",
    },
  ];

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    // Allow filtering to specific boards via config
    const targetBoards = (config.boards as string[]) ?? undefined;
    const boards = targetBoards
      ? ProvincialBoardAdapter.BOARDS.filter((b) => targetBoards.includes(b.key))
      : ProvincialBoardAdapter.BOARDS;

    const allDocs: DiscoveredDocument[] = [];

    for (const board of boards) {
      for (const url of board.urls) {
        try {
          const response = await this.fetchWithRetry(url);
          const html = await response.text();
          const docs = this.parseBoardPage(html, url, board);
          allDocs.push(...docs);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.warn(`Provincial board adapter: failed ${board.key}`, {
            url,
            error: msg,
          });
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

    logger.info("Provincial board adapter: discovered documents", {
      count: unique.length,
      boards: boards.map((b) => b.key),
    });

    return unique;
  }

  async fetch(sourceUrl: string, _config: Record<string, unknown>): Promise<FetchedContent> {
    const response = await this.fetchWithRetry(sourceUrl);
    const rawContent = await response.text();
    const contentType = response.headers.get("content-type") ?? "text/html";
    const normalizedText = this.stripHtml(rawContent);

    return {
      rawContent,
      contentType,
      wordCount: normalizedText.split(/\s+/).length,
      metadata: {
        normalizedText,
        source: "provincial_board",
      },
    };
  }

  private parseBoardPage(
    html: string,
    baseUrl: string,
    board: BoardConfig,
  ): DiscoveredDocument[] {
    const docs: DiscoveredDocument[] = [];

    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = this.stripHtml(match[2]).trim();

      if (!this.isRelevantLink(linkText, href)) continue;
      if (!href || href.startsWith("#") || (href.includes(':') && !/^https?:/i.test(href))) continue;
      if (linkText.length < 3) continue;

      const resolvedUrl = this.resolveUrl(href, baseUrl);
      if (!resolvedUrl) continue;

      docs.push({
        sourceDocId: `${board.key}-${href}`,
        title: linkText.slice(0, 500),
        sourceUrl: resolvedUrl,
        documentType: this.classifyDocType(linkText, href),
        language: board.language === "bilingual" ? this.detectLanguage(linkText, href) : board.language,
        jurisdiction: board.jurisdiction,
        sector: this.detectSector(linkText),
      });
    }

    return docs;
  }

  private isRelevantLink(text: string, href: string): boolean {
    const lower = (text + " " + href).toLowerCase();
    const keywords = [
      "decision", "décision", "order", "ordonnance",
      "collective", "agreement", "convention",
      "bargaining", "négociation", "arbitration",
      "settlement", "certification", "accréditation",
      "unfair", "plainte", "grievance", "grief",
      ".pdf", "ruling", "jugement",
    ];
    return keywords.some((kw) => lower.includes(kw));
  }

  private classifyDocType(text: string, href: string): string {
    const lower = (text + " " + href).toLowerCase();
    if (lower.includes("arbitration") || lower.includes("arbitrage")) return "arbitration_decision";
    if (lower.includes("certification") || lower.includes("accréditation")) return "certification_order";
    if (lower.includes("agreement") || lower.includes("convention")) return "collective_agreement";
    if (lower.includes(".pdf")) return "board_decision";
    return "board_decision";
  }

  private detectSector(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("health") || lower.includes("santé") || lower.includes("hospital")) return "healthcare";
    if (lower.includes("education") || lower.includes("school") || lower.includes("école")) return "education";
    if (lower.includes("construction")) return "construction";
    if (lower.includes("municipal") || lower.includes("city") || lower.includes("ville")) return "municipal";
    if (lower.includes("police") || lower.includes("fire") || lower.includes("pompier")) return "protective_services";
    if (lower.includes("transit") || lower.includes("transport")) return "transportation";
    return undefined;
  }

  private detectLanguage(text: string, href: string): "en" | "fr" | "bilingual" {
    const frWords = ["décision", "convention", "négociation", "ordonnance", "travail"];
    const lower = text.toLowerCase();
    const hasFr = frWords.some((w) => lower.includes(w)) || href.includes("/fr/");
    const hasEn = !hasFr;
    return hasFr && !hasEn ? "fr" : "en";
  }

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }
}
