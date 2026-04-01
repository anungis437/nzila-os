import { BaseAdapter } from "./base-adapter";
import type { DiscoveredDocument, FetchedContent } from "./types";
import { logger } from "@/lib/logger";

/**
 * Statistics Canada CSV Adapter
 *
 * Targets StatsCan open data tables for collective bargaining and wage data:
 *  - Table 14-10-0132: Work stoppages, workers involved, and person-days not worked
 *  - Table 14-10-0070: Union membership and coverage by selected characteristics
 *  - Table 14-10-0069: Average hourly wages by union status and coverage
 *
 * StatsCan publishes data at:
 *  https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=XXXXXXXXXX
 *  Download CSV: https://www150.statcan.gc.ca/n1/tbl/csv/XXXXXXXX-eng.zip
 *
 * This adapter discovers available CSV downloads and fetches them for
 * extraction into the CBA intelligence benchmark pipeline.
 */
export class StatsCanCsvAdapter extends BaseAdapter {
  readonly key = "statscan_csv";
  readonly name = "Statistics Canada Open Data (CSV)";
  readonly version = "1.0.0";

  /**
   * Known StatsCan tables relevant to collective bargaining analysis.
   * Each entry: { pid, title, category }
   */
  private static readonly TABLES = [
    {
      pid: "1410013201",
      title: "Work stoppages, workers involved and person-days not worked, by jurisdiction and industry",
      category: "work_stoppages",
    },
    {
      pid: "1410007001",
      title: "Union membership and coverage by selected characteristics",
      category: "union_coverage",
    },
    {
      pid: "1410006901",
      title: "Average hourly wages by union status and coverage",
      category: "wage_data",
    },
    {
      pid: "1410006401",
      title: "Employee wages by industry, annual",
      category: "wage_data",
    },
    {
      pid: "1410031801",
      title: "Labour force characteristics by industry, annual",
      category: "labour_force",
    },
  ];

  async discover(config: Record<string, unknown>): Promise<DiscoveredDocument[]> {
    const tables = (config.tables as typeof StatsCanCsvAdapter.TABLES) ?? StatsCanCsvAdapter.TABLES;

    const docs: DiscoveredDocument[] = [];

    for (const table of tables) {
      // StatsCan table viewer URL
      const viewUrl = `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${table.pid}`;
      // CSV download URL pattern
      const csvUrl = `https://www150.statcan.gc.ca/n1/tbl/csv/${table.pid.slice(0, 8)}-eng.zip`;

      docs.push({
        sourceDocId: `statscan-${table.pid}`,
        title: table.title,
        sourceUrl: viewUrl,
        documentType: "statistical_report",
        language: "en",
        jurisdiction: "CA-FED",
        sector: table.category,
      });

      // Also register the CSV download as a separate discoverable document
      docs.push({
        sourceDocId: `statscan-csv-${table.pid}`,
        title: `${table.title} (CSV Download)`,
        sourceUrl: csvUrl,
        documentType: "statistical_report",
        language: "en",
        jurisdiction: "CA-FED",
        sector: table.category,
      });
    }

    logger.info("StatsCan CSV adapter: discovered tables", { count: docs.length });
    return docs;
  }

  async fetch(sourceUrl: string, _config: Record<string, unknown>): Promise<FetchedContent> {
    const response = await this.fetchWithRetry(sourceUrl);
    const contentType = response.headers.get("content-type") ?? "text/html";

    // If it's a ZIP/CSV, read as text (the orchestrator handles binary later)
    const rawContent = await response.text();

    // For HTML pages, extract structured data
    if (contentType.includes("text/html")) {
      const normalizedText = this.stripHtml(rawContent);
      return {
        rawContent,
        contentType,
        wordCount: normalizedText.split(/\s+/).length,
        metadata: {
          normalizedText,
          source: "statscan_csv",
          isTableView: true,
        },
      };
    }

    // CSV content
    const lines = rawContent.split("\n").filter((l) => l.trim().length > 0);
    return {
      rawContent,
      contentType: contentType.includes("csv") ? "text/csv" : contentType,
      wordCount: rawContent.split(/\s+/).length,
      metadata: {
        source: "statscan_csv",
        rowCount: lines.length - 1, // minus header
        headers: lines[0]?.split(","),
      },
    };
  }
}
