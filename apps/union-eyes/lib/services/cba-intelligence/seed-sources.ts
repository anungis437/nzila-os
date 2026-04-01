/**
 * CBA Intelligence — Real Source Registry Seed Data
 *
 * Seeds the source registry with actual Canadian CBA data sources.
 * Each source maps to a registered adapter and covers a specific
 * jurisdiction or data provider.
 *
 * Usage:
 *   npx tsx apps/union-eyes/lib/services/cba-intelligence/seed-sources.ts
 *   OR via API: POST /api/cba-intelligence/ingestion/seed
 */

import { db } from "@/db/db";
import { cbaIntelSources } from "@/db/schema";
import { logger } from "@/lib/logger";

export interface SeedSource {
  name: string;
  nameEn: string;
  slug: string;
  sourceType: "federal_labour" | "provincial_labour_board" | "provincial_ministry" | "quebec_labour" | "legal_arbitration" | "union_bulletin" | "stats_benchmark" | "academic" | "news";
  collectionMethod: "manual_upload" | "scheduled_fetch" | "api_sync" | "rss_feed" | "email_ingest";
  adapterKey: string;
  trustTier: "official" | "authoritative" | "curated" | "unverified";
  baseUrl: string;
  jurisdictions: string[];
  description: string;
  config: Record<string, unknown>;
}

export const SEED_SOURCES: SeedSource[] = [
  // ─── Tier 1: Official Government Sources ─────────────────────────────
  {
    name: "ESDC Wage Settlements",
    nameEn: "ESDC Wage Settlements",
    slug: "esdc-wage-settlements",
    sourceType: "federal_labour",
    collectionMethod: "scheduled_fetch",
    adapterKey: "esdc_federal",
    trustTier: "official",
    baseUrl: "https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data/wage-settlements.html",
    jurisdictions: ["CA-FED"],
    description: "Employment and Social Development Canada — Federal wage settlement bulletins, major settlement data covering 500+ federal bargaining units",
    config: {
      wageSettlementUrl: "https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data/wage-settlements.html",
      cbaDataUrl: "https://www.canada.ca/en/employment-social-development/services/collective-bargaining-data.html",
      fmcsUrl: "https://www.canada.ca/en/employment-social-development/services/labour-relations/collective-bargaining.html",
    },
  },
  {
    name: "FPSLREB Decisions",
    nameEn: "FPSLREB Decisions",
    slug: "fpslreb-decisions",
    sourceType: "federal_labour",
    collectionMethod: "scheduled_fetch",
    adapterKey: "fpslreb",
    trustTier: "official",
    baseUrl: "https://www.fpslreb-crtespf.gc.ca/en/decisions/index.html",
    jurisdictions: ["CA-FED"],
    description: "Federal Public Sector Labour Relations and Employment Board — Arbitration decisions, grievance awards, federal public service collective agreements",
    config: {
      urls: [
        "https://www.fpslreb-crtespf.gc.ca/en/decisions/index.html",
        "https://www.fpslreb-crtespf.gc.ca/en/decisions/arbitration.html",
      ],
    },
  },
  {
    name: "Ontario Labour Relations Board",
    nameEn: "Ontario Labour Relations Board",
    slug: "olrb-ontario",
    sourceType: "provincial_labour_board",
    collectionMethod: "scheduled_fetch",
    adapterKey: "provincial_board",
    trustTier: "official",
    baseUrl: "https://www.olrb.gov.on.ca/",
    jurisdictions: ["CA-ON"],
    description: "Ontario LRB — Certification orders, unfair labour practice decisions, and collective agreement interpretation rulings",
    config: {
      boards: ["olrb"],
    },
  },
  {
    name: "BC Labour Relations Board",
    nameEn: "BC Labour Relations Board",
    slug: "bclrb-bc",
    sourceType: "provincial_labour_board",
    collectionMethod: "scheduled_fetch",
    adapterKey: "provincial_board",
    trustTier: "official",
    baseUrl: "https://www.lrb.bc.ca/",
    jurisdictions: ["CA-BC"],
    description: "BC LRB — Labour relations decisions, essential services designations, and collective bargaining orders",
    config: {
      boards: ["bclrb"],
    },
  },
  {
    name: "Alberta Labour Relations Board",
    nameEn: "Alberta Labour Relations Board",
    slug: "alrb-alberta",
    sourceType: "provincial_labour_board",
    collectionMethod: "scheduled_fetch",
    adapterKey: "provincial_board",
    trustTier: "official",
    baseUrl: "https://www.alrb.gov.ab.ca/",
    jurisdictions: ["CA-AB"],
    description: "Alberta LRB — Decisions, policy interpretations, and collective agreement dispute resolutions",
    config: {
      boards: ["alrb"],
    },
  },
  {
    name: "Tribunal administratif du travail (Quebec)",
    nameEn: "Administrative Labour Tribunal (Quebec)",
    slug: "tat-quebec",
    sourceType: "quebec_labour",
    collectionMethod: "scheduled_fetch",
    adapterKey: "provincial_board",
    trustTier: "official",
    baseUrl: "https://www.tat.gouv.qc.ca/",
    jurisdictions: ["CA-QC"],
    description: "Quebec TAT — Labour tribunal decisions (bilingual), essential services, collective agreement disputes. Successor to CRT and CLP",
    config: {
      boards: ["tat"],
    },
  },
  {
    name: "Saskatchewan Labour Relations Board",
    nameEn: "Saskatchewan Labour Relations Board",
    slug: "slrb-saskatchewan",
    sourceType: "provincial_labour_board",
    collectionMethod: "scheduled_fetch",
    adapterKey: "provincial_board",
    trustTier: "official",
    baseUrl: "https://www.sasklabourrelationsboard.com/",
    jurisdictions: ["CA-SK"],
    description: "Saskatchewan LRB — Certification, unfair labour practices, and collective bargaining decisions",
    config: {
      boards: ["slrb"],
    },
  },
  {
    name: "Manitoba Labour Board",
    nameEn: "Manitoba Labour Board",
    slug: "mlrb-manitoba",
    sourceType: "provincial_labour_board",
    collectionMethod: "scheduled_fetch",
    adapterKey: "provincial_board",
    trustTier: "official",
    baseUrl: "https://www.manitobalabourboard.mb.ca/",
    jurisdictions: ["CA-MB"],
    description: "Manitoba Labour Board — Decisions on labour relations matters, collective agreements, and workplace disputes",
    config: {
      boards: ["mlrb"],
    },
  },

  // ─── Tier 2: Institutional Sources ────────────────────────────────────
  {
    name: "CanLII Labour Decisions",
    nameEn: "CanLII Labour Decisions",
    slug: "canlii-labour",
    sourceType: "legal_arbitration",
    collectionMethod: "scheduled_fetch",
    adapterKey: "canlii_legal",
    trustTier: "authoritative",
    baseUrl: "https://www.canlii.org/en/",
    jurisdictions: ["CA-FED", "CA-ON", "CA-BC", "CA-AB", "CA-QC", "CA-SK", "CA-MB"],
    description: "Canadian Legal Information Institute — Labour arbitration decisions and board rulings across all Canadian jurisdictions. Coverage: CIRB, OLRB, BCLRB, ALRB, TAT, SLRB, MLRB",
    config: {
      searchPaths: [
        "https://www.canlii.org/en/ca/cirb/",
        "https://www.canlii.org/en/on/onlrb/",
        "https://www.canlii.org/en/bc/bclrb/",
        "https://www.canlii.org/en/ab/ablrb/",
        "https://www.canlii.org/en/qc/qctat/",
        "https://www.canlii.org/en/sk/sklrb/",
        "https://www.canlii.org/en/mb/mblrb/",
      ],
      maxPages: 3,
    },
  },
  {
    name: "Statistics Canada Labour Data",
    nameEn: "Statistics Canada Labour Data",
    slug: "statscan-labour",
    sourceType: "stats_benchmark",
    collectionMethod: "scheduled_fetch",
    adapterKey: "statscan_csv",
    trustTier: "authoritative",
    baseUrl: "https://www150.statcan.gc.ca/",
    jurisdictions: ["CA-FED"],
    description: "Statistics Canada — Open data tables on wage settlements, union membership, average wages by union status, work stoppages, and labour force characteristics",
    config: {
      tables: [
        { pid: "1410013201", title: "Work stoppages data", category: "work_stoppages" },
        { pid: "1410007001", title: "Union membership and coverage", category: "union_coverage" },
        { pid: "1410006901", title: "Average hourly wages by union status", category: "wage_data" },
        { pid: "1410006401", title: "Employee wages by industry", category: "wage_data" },
        { pid: "1410031801", title: "Labour force by industry", category: "labour_force" },
      ],
    },
  },

  // ─── Tier 3: Curated Union Sources ────────────────────────────────────
  {
    name: "CUPE Bargaining Updates",
    nameEn: "CUPE Bargaining Updates",
    slug: "cupe-bargaining",
    sourceType: "union_bulletin",
    collectionMethod: "scheduled_fetch",
    adapterKey: "union_bargaining",
    trustTier: "curated",
    baseUrl: "https://cupe.ca/bargaining",
    jurisdictions: ["CA-FED", "CA-ON", "CA-BC", "CA-AB", "CA-QC", "CA-MB", "CA-SK", "CA-NS", "CA-NB", "CA-NL"],
    description: "Canadian Union of Public Employees — Canada's largest union (700,000+ members). Bargaining updates, ratification notices, and settlement summaries across healthcare, education, and municipal sectors",
    config: {
      unions: ["cupe"],
    },
  },
  {
    name: "Unifor Bargaining Updates",
    nameEn: "Unifor Bargaining Updates",
    slug: "unifor-bargaining",
    sourceType: "union_bulletin",
    collectionMethod: "scheduled_fetch",
    adapterKey: "union_bargaining",
    trustTier: "curated",
    baseUrl: "https://www.unifor.org/campaigns/bargaining",
    jurisdictions: ["CA-FED", "CA-ON", "CA-BC", "CA-AB", "CA-QC"],
    description: "Unifor — Canada's largest private sector union (315,000+ members). Auto, media, telecommunications, transportation bargaining",
    config: {
      unions: ["unifor"],
    },
  },
  {
    name: "USW Canada News",
    nameEn: "USW Canada News",
    slug: "usw-canada",
    sourceType: "union_bulletin",
    collectionMethod: "scheduled_fetch",
    adapterKey: "union_bargaining",
    trustTier: "curated",
    baseUrl: "https://www.usw.ca/news",
    jurisdictions: ["CA-FED", "CA-ON", "CA-QC", "CA-AB", "CA-BC"],
    description: "United Steelworkers — Mining, manufacturing, forestry, and steel sectors. 225,000+ Canadian members",
    config: {
      unions: ["usw"],
    },
  },
  {
    name: "PSAC Bargaining Updates",
    nameEn: "PSAC Bargaining Updates",
    slug: "psac-bargaining",
    sourceType: "union_bulletin",
    collectionMethod: "scheduled_fetch",
    adapterKey: "union_bargaining",
    trustTier: "curated",
    baseUrl: "https://psacunion.ca/bargaining",
    jurisdictions: ["CA-FED"],
    description: "Public Service Alliance of Canada — 230,000+ federal public service members. Treasury Board, CRA, separate agency bargaining",
    config: {
      unions: ["psac"],
    },
  },
  {
    name: "UFCW Canada Updates",
    nameEn: "UFCW Canada Updates",
    slug: "ufcw-canada",
    sourceType: "union_bulletin",
    collectionMethod: "scheduled_fetch",
    adapterKey: "union_bargaining",
    trustTier: "curated",
    baseUrl: "https://www.ufcw.ca/",
    jurisdictions: ["CA-FED", "CA-ON", "CA-BC", "CA-AB"],
    description: "United Food and Commercial Workers — 250,000+ Canadian members in retail, food processing, and hospitality",
    config: {
      unions: ["ufcw"],
    },
  },

  // ─── HTML Bulletin Sources ────────────────────────────────────────────
  {
    name: "CIRB Federal Decisions",
    nameEn: "CIRB Federal Decisions",
    slug: "cirb-federal",
    sourceType: "federal_labour",
    collectionMethod: "scheduled_fetch",
    adapterKey: "html_bulletin",
    trustTier: "official",
    baseUrl: "https://www.canada.ca/en/industrial-relations-board/services/decisions.html",
    jurisdictions: ["CA-FED"],
    description: "Canada Industrial Relations Board — Federal jurisdiction decisions on certification, unfair practices, and collective bargaining",
    config: {
      baseUrl: "https://www.canada.ca/en/industrial-relations-board/services/decisions.html",
    },
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

export async function seedSources(): Promise<{
  created: number;
  skipped: number;
  errors: string[];
}> {
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const seed of SEED_SOURCES) {
    try {
      // Check if source already exists by slug
      const existing = await db
        .select()
        .from(cbaIntelSources)
        .where(eq(cbaIntelSources.slug, seed.slug))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(cbaIntelSources).values({
        name: seed.name,
        nameEn: seed.nameEn,
        slug: seed.slug,
        sourceType: seed.sourceType as typeof cbaIntelSources.$inferSelect["sourceType"],
        collectionMethod: seed.collectionMethod as typeof cbaIntelSources.$inferSelect["collectionMethod"],
        adapterKey: seed.adapterKey,
        trustTier: seed.trustTier as typeof cbaIntelSources.$inferSelect["trustTier"],
        baseUrl: seed.baseUrl,
        jurisdictions: seed.jurisdictions,
        description: seed.description,
        config: seed.config,
        isActive: true,
        healthStatus: "unknown",
      });

      created++;
      logger.info("Seeded CBA source", { name: seed.name, adapter: seed.adapterKey });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to seed ${seed.name}: ${msg}`);
      logger.error("Failed to seed source", { name: seed.name, error: msg });
    }
  }

  logger.info("Source seeding complete", { created, skipped, errors: errors.length });
  return { created, skipped, errors };
}
