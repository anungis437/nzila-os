/**
 * CBA Intelligence — Extraction Orchestrator
 *
 * Processes raw documents through a multi-stage extraction pipeline:
 *  1. Text normalization (HTML strip, whitespace cleanup)
 *  2. Metadata extraction (parties, dates, jurisdiction, sector)
 *  3. Clause classification (26 clause families)
 *  4. Wage table parsing (adjustment %, effective dates)
 *  5. Agreement creation/update from extracted data
 *
 * Uses rule-based NLP for initial extraction.
 * The pipeline is designed to be extended with ML/LLM extractors.
 */

import { db } from "@/db/db";
import { cbaIntelDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";
import {
  cbaIntelExtractionConfidence,
} from "@/lib/observability/metrics";
import {
  createExtractionRun,
  completeExtractionRun,
  createFindingsBatch,
  type NewFinding,
} from "./extraction-service";
import { updateDocumentStatus, type CbaIntelDocument } from "./document-service";
import { flagForFollowupReview } from "./review-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  documentId: string;
  extractionRunId: string;
  findings: ExtractedFinding[];
  agreement: ExtractedAgreementData | null;
  wageAdjustments: ExtractedWageData[];
  clauses: ExtractedClauseData[];
  errors: string[];
}

interface ExtractedFinding {
  findingType: string;
  label: string;
  value: string;
  confidence: number;
  clauseFamily: string | null;
  sourceSpan: string | null;
}

interface ExtractedAgreementData {
  employerName: string | null;
  unionName: string | null;
  bargainingUnit: string | null;
  jurisdiction: string | null;
  sector: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  termMonths: number | null;
  language: string;
}

interface ExtractedWageData {
  year: number;
  adjustmentPercent: number;
  effectiveDate: string | null;
  description: string | null;
}

interface ExtractedClauseData {
  clauseFamily: string;
  clauseTitle: string;
  rawText: string;
  confidence: number;
}

interface ExtractionPolicy {
  followupConfidenceThreshold: number;
  maxAutoReviewEnqueues: number;
}

function parseThreshold(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(parsed, 1));
}

function getExtractionPolicy(): ExtractionPolicy {
  return {
    followupConfidenceThreshold: parseThreshold(
      process.env.CBA_INTEL_REVIEW_CONFIDENCE_THRESHOLD,
      0.65,
    ),
    maxAutoReviewEnqueues: Math.max(
      1,
      Number.parseInt(process.env.CBA_INTEL_MAX_AUTO_REVIEW_ENQUEUES ?? "20", 10) || 20,
    ),
  };
}

function deriveActionRecommendations(input: {
  agreement: ExtractedAgreementData;
  wageAdjustments: ExtractedWageData[];
  clauses: ExtractedClauseData[];
}): Array<{ label: string; value: string; confidence: number; clauseFamily: string | null }> {
  const recommendations: Array<{ label: string; value: string; confidence: number; clauseFamily: string | null }> = [];

  const hasArbitration = input.clauses.some((c) => c.clauseFamily === "grievance");
  if (!hasArbitration) {
    recommendations.push({
      label: "Add grievance and arbitration readiness check",
      value: "No grievance/arbitration clause detected. Route for legal review before relying on this agreement for precedent.",
      confidence: 0.78,
      clauseFamily: "grievance",
    });
  }

  const maxWage = input.wageAdjustments.reduce((max, item) => Math.max(max, item.adjustmentPercent), 0);
  if (maxWage >= 4) {
    recommendations.push({
      label: "Budget impact review required",
      value: `Detected wage adjustment up to ${maxWage.toFixed(1)}%. Trigger finance impact simulation and escalation workflow.`,
      confidence: 0.84,
      clauseFamily: "wages",
    });
  }

  if (!input.agreement.expiryDate) {
    recommendations.push({
      label: "Missing expiry date follow-up",
      value: "Agreement expiry date was not confidently extracted. Add to reviewer queue for term verification.",
      confidence: 0.8,
      clauseFamily: null,
    });
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Clause family keywords for classification
// ---------------------------------------------------------------------------

const CLAUSE_FAMILY_KEYWORDS: Record<string, string[]> = {
  wages: ["wage", "salary", "pay", "compensation", "remuneration", "salaire", "rémunération"],
  benefits: ["benefit", "insurance", "dental", "vision", "health plan", "avantage", "assurance"],
  pension: ["pension", "retirement", "rrsp", "defined benefit", "retraite", "régime"],
  vacation: ["vacation", "holiday", "leave", "annual leave", "vacances", "congé"],
  sick_leave: ["sick", "illness", "medical leave", "disability", "maladie", "invalidité"],
  overtime: ["overtime", "time and a half", "double time", "heures supplémentaires"],
  seniority: ["seniority", "tenure", "years of service", "ancienneté"],
  grievance: ["grievance", "arbitration", "dispute", "complaint", "grief", "plainte"],
  discipline: ["discipline", "discharge", "termination", "just cause", "dismissal", "congédiement"],
  health_safety: ["health and safety", "occupational", "workplace safety", "santé et sécurité"],
  union_security: ["union dues", "rand formula", "check-off", "membership", "cotisation"],
  management_rights: ["management rights", "employer rights", "droits de la direction"],
  hours_of_work: ["hours of work", "schedule", "shift", "horaire", "quart de travail"],
  layoff_recall: ["layoff", "recall", "bumping", "mise à pied", "rappel"],
  contracting_out: ["contracting out", "subcontracting", "outsourc", "sous-traitance"],
  job_posting: ["job posting", "posting", "vacancy", "promotion", "affichage"],
  training: ["training", "education", "professional development", "formation"],
  technological_change: ["technological change", "automation", "changement technologique"],
  parental_leave: ["parental", "maternity", "paternity", "family leave", "parental"],
  bereavement: ["bereavement", "funeral", "death", "décès", "funérailles"],
  jury_duty: ["jury duty", "court leave", "devoir de juré"],
  uniforms: ["uniform", "clothing", "dress code", "uniforme", "vêtement"],
  travel: ["travel", "mileage", "vehicle", "déplacement", "kilométrage"],
  duration: ["duration", "term", "renewal", "reopener", "durée"],
  no_strike: ["no strike", "no lockout", "industrial peace", "pas de grève"],
  general: ["general", "miscellaneous", "other", "général", "divers"],
};

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

function normalizeText(rawContent: string, contentType: string): string {
  if (contentType.includes("text/html")) {
    return rawContent
      .replace(/<script[\s\S]*?<\/script>/gi, "") // codeql[js/bad-tag-filter] - plain-text extraction for AI ingestion
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ") // codeql[js/bad-tag-filter]
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&") // codeql[js/double-escaping] - decoding for plain-text AI ingestion, not re-rendered as HTML
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
  return rawContent.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

function extractMetadata(text: string, document: CbaIntelDocument): ExtractedAgreementData {
  const lower = text.toLowerCase();

  // Extract employer name — patterns like "between X and Y"
  const betweenMatch = text.match(
    /between\s+(?:the\s+)?(.+?)\s+(?:and|,)\s+(?:the\s+)?(.+?)(?:\s+(?:local|unit|bargaining)|\.|,)/i,
  );

  const employerName = betweenMatch?.[1]?.trim().slice(0, 255) ?? null;
  const unionName = betweenMatch?.[2]?.trim().slice(0, 255) ?? null;

  // Detect jurisdiction from text
  const jurisdiction = document.jurisdiction ?? detectJurisdiction(lower);

  // Detect sector
  const sector = detectSector(lower);

  // Extract dates
  const datePatterns = [
    /effective\s+(?:date:?\s*)?(\w+\s+\d{1,2},?\s+\d{4})/i,
    /commencing\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
    /from\s+(\w+\s+\d{1,2},?\s+\d{4})\s+to/i,
  ];
  const expiryPatterns = [
    /expir(?:es?|y|ation)\s*(?:date)?:?\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /to\s+(\w+\s+\d{1,2},?\s+\d{4})\s*(?:\.|$)/i,
    /until\s+(\w+\s+\d{1,2},?\s+\d{4})/i,
  ];

  let effectiveDate: string | null = null;
  let expiryDate: string | null = null;

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      effectiveDate = tryParseDate(match[1]);
      break;
    }
  }

  for (const pattern of expiryPatterns) {
    const match = text.match(pattern);
    if (match) {
      expiryDate = tryParseDate(match[1]);
      break;
    }
  }

  // Compute term months
  let termMonths: number | null = null;
  if (effectiveDate && expiryDate) {
    const start = new Date(effectiveDate);
    const end = new Date(expiryDate);
    termMonths = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44),
    );
  }

  // Check for explicit term mentions
  if (termMonths === null) {
    const termMatch = text.match(/(\d+)[\s-]*year\s+(?:agreement|term|contract)/i);
    if (termMatch) {
      termMonths = parseInt(termMatch[1], 10) * 12;
    }
  }

  return {
    employerName,
    unionName,
    bargainingUnit: null,
    jurisdiction,
    sector,
    effectiveDate,
    expiryDate,
    termMonths,
    language: document.language ?? "en",
  };
}

function detectJurisdiction(text: string): string | null {
  const jurisdictionMap: Record<string, string> = {
    "ontario": "CA-ON",
    "british columbia": "CA-BC",
    "alberta": "CA-AB",
    "quebec": "CA-QC",
    "québec": "CA-QC",
    "manitoba": "CA-MB",
    "saskatchewan": "CA-SK",
    "nova scotia": "CA-NS",
    "new brunswick": "CA-NB",
    "prince edward island": "CA-PE",
    "newfoundland": "CA-NL",
    "northwest territories": "CA-NT",
    "nunavut": "CA-NU",
    "yukon": "CA-YT",
    "federal": "CA-FED",
    "canada labour code": "CA-FED",
  };

  for (const [key, value] of Object.entries(jurisdictionMap)) {
    if (text.includes(key)) return value;
  }
  return null;
}

function detectSector(text: string): string | null {
  const sectorMap: Record<string, string> = {
    "healthcare": "healthcare",
    "hospital": "healthcare",
    "nursing": "healthcare",
    "education": "education",
    "school": "education",
    "university": "education",
    "construction": "construction",
    "municipal": "municipal",
    "city of": "municipal",
    "police": "protective_services",
    "firefighter": "protective_services",
    "transit": "transportation",
    "transport": "transportation",
    "retail": "retail",
    "manufacturing": "manufacturing",
    "mining": "mining",
    "forestry": "forestry",
    "telecommunications": "telecommunications",
    "postal": "postal",
    "banking": "banking",
  };

  for (const [key, value] of Object.entries(sectorMap)) {
    if (text.includes(key)) return value;
  }
  return null;
}

function tryParseDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr.trim());
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Wage extraction
// ---------------------------------------------------------------------------

function extractWages(text: string): ExtractedWageData[] {
  const wages: ExtractedWageData[] = [];

  // Pattern: "X% wage increase" or "X per cent" or "X percent"
  const wagePatterns = [
    /(\d+(?:\.\d+)?)\s*(?:%|per\s*cent|percent)\s+(?:wage\s+)?(?:increase|raise|adjustment|hike)/gi,
    /(?:wage\s+)?(?:increase|raise|adjustment)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:%|per\s*cent|percent)/gi,
    /year\s+(\d+).*?(\d+(?:\.\d+)?)\s*(?:%|per\s*cent)/gi,
  ];

  for (const pattern of wagePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const pct = parseFloat(match[1]);
      if (pct > 0 && pct < 30) {
        // Sanity check: wage increases >30% are unlikely
        wages.push({
          year: new Date().getFullYear(),
          adjustmentPercent: pct,
          effectiveDate: null,
          description: match[0].trim().slice(0, 200),
        });
      }
    }
  }

  // Year-specific patterns: "2025: 3.5%", "Year 1 — 2.5%"
  const yearPatterns = [
    /(?:year\s+)?(\d{4})\s*[:—–-]\s*(\d+(?:\.\d+)?)\s*%/gi,
    /year\s+(\d+)\s*[:—–-]\s*(\d+(?:\.\d+)?)\s*%/gi,
  ];

  for (const pattern of yearPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const yearOrNum = parseInt(match[1], 10);
      const pct = parseFloat(match[2]);
      if (pct > 0 && pct < 30) {
        const year = yearOrNum > 2000 ? yearOrNum : new Date().getFullYear() + yearOrNum - 1;
        // Avoid duplicates
        if (!wages.some((w) => w.year === year && w.adjustmentPercent === pct)) {
          wages.push({
            year,
            adjustmentPercent: pct,
              effectiveDate: `${year}-01-01`,
            description: match[0].trim().slice(0, 200),
          });
        }
      }
    }
  }

  return wages;
}

// ---------------------------------------------------------------------------
// Clause classification
// ---------------------------------------------------------------------------

function classifyClauses(text: string): ExtractedClauseData[] {
  const clauses: ExtractedClauseData[] = [];

  // Split text into paragraphs/sections
  const sections = text.split(/(?:\n\n|\r\n\r\n|(?:article|section|clause)\s+\d+)/i);

  for (const section of sections) {
    if (section.trim().length < 50) continue;

    const lower = section.toLowerCase();
    let bestFamily: string | null = null;
    let bestScore = 0;

    for (const [family, keywords] of Object.entries(CLAUSE_FAMILY_KEYWORDS)) {
      const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
      const score = matchCount / keywords.length;
      if (score > bestScore && matchCount >= 1) {
        bestScore = score;
        bestFamily = family;
      }
    }

    if (bestFamily && bestScore > 0) {
      // Extract the first line as title
      const lines = section.trim().split(/\n/);
        const title = lines[0].trim().slice(0, 255);

      clauses.push({
        clauseFamily: bestFamily,
        clauseTitle: title,
        rawText: section.trim().slice(0, 5000),
        confidence: Math.min(bestScore * 2, 1), // Scale up but cap at 1
      });
    }
  }

  return clauses;
}

// ---------------------------------------------------------------------------
// Main extraction pipeline
// ---------------------------------------------------------------------------

export async function extractDocument(
  documentId: string,
): Promise<ExtractionResult> {
  const errors: string[] = [];
  const policy = getExtractionPolicy();

  // Load document
  const [document] = await db
    .select()
    .from(cbaIntelDocuments)
    .where(eq(cbaIntelDocuments.id, documentId))
    .limit(1);

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  if (!document.rawContent) {
    throw new Error(`Document has no raw content: ${documentId}`);
  }

  // Create extraction run
  const run = await createExtractionRun({
    documentId,
    extractionMethod: "deterministic",
    status: "running",
    startedAt: new Date(),
  });

  try {
    // Phase 1: Normalize text
    const normalizedText = normalizeText(
      document.rawContent,
      document.documentType ?? "text/html",
    );

    await updateDocumentStatus(documentId, "normalized", {
      normalizedText,
      wordCount: normalizedText.split(/\s+/).length,
    });

    // Phase 2: Extract metadata (parties, dates, jurisdiction)
    const metadata = extractMetadata(normalizedText, document);

    // Phase 3: Extract wages
    const wageData = extractWages(normalizedText);

    // Phase 4: Classify clauses
    const clauseData = classifyClauses(normalizedText);

    // Phase 5: Build findings
    const findings: ExtractedFinding[] = [];

    if (metadata.employerName) {
      findings.push({
        findingType: "employer_name",
        label: "Employer",
        value: metadata.employerName,
        confidence: 0.7,
        clauseFamily: null,
        sourceSpan: null,
      });
    }

    if (metadata.unionName) {
      findings.push({
        findingType: "union_name",
        label: "Union",
        value: metadata.unionName,
        confidence: 0.7,
        clauseFamily: null,
        sourceSpan: null,
      });
    }

    if (metadata.jurisdiction) {
      findings.push({
        findingType: "jurisdiction",
        label: "Jurisdiction",
        value: metadata.jurisdiction,
        confidence: 0.8,
        clauseFamily: null,
        sourceSpan: null,
      });
    }

    if (metadata.sector) {
      findings.push({
        findingType: "sector",
        label: "Sector",
        value: metadata.sector,
        confidence: 0.6,
        clauseFamily: null,
        sourceSpan: null,
      });
    }

    for (const wage of wageData) {
      findings.push({
        findingType: "wage_adjustment",
        label: `Wage ${wage.year}`,
        value: `${wage.adjustmentPercent}%`,
        confidence: 0.75,
        clauseFamily: "wages",
        sourceSpan: wage.description,
      });
    }

    for (const clause of clauseData) {
      findings.push({
        findingType: "clause_classification",
          label: clause.clauseTitle,
        value: clause.clauseFamily,
        confidence: clause.confidence,
        clauseFamily: clause.clauseFamily,
        sourceSpan: clause.rawText.slice(0, 500),
      });
    }

    const recommendations = deriveActionRecommendations({
      agreement: metadata,
      wageAdjustments: wageData,
      clauses: clauseData,
    });

    for (const rec of recommendations) {
      findings.push({
        findingType: "action_recommendation",
        label: rec.label,
        value: rec.value,
        confidence: rec.confidence,
        clauseFamily: rec.clauseFamily,
        sourceSpan: null,
      });
    }

    // Persist findings
    const findingRecords: NewFinding[] = findings.map((f) => ({
      documentId,
      extractionRunId: run.id,
      findingType: f.findingType,
      label: f.label,
      value: f.value,
      confidence: f.confidence.toString(),
      clauseFamily: f.clauseFamily as NewFinding["clauseFamily"],
      citationText: f.sourceSpan,
      extractionMethod: "deterministic" as const,
      contentHash: createHash("sha256")
        .update(`${documentId}:${f.findingType}:${f.label}:${f.value}`)
        .digest("hex"),
      reviewStatus: "pending_review",
    }));

    const createdFindings = await createFindingsBatch(findingRecords);

    const followups = createdFindings
      .filter((f) => Number(f.confidence) < policy.followupConfidenceThreshold)
      .slice(0, policy.maxAutoReviewEnqueues);

    await Promise.all(
      followups.map(async (f) => {
        await flagForFollowupReview({
          targetType: "finding",
          targetId: f.id,
          reason: "low_confidence_extraction",
          comment: `Auto-queued due to confidence ${f.confidence} below threshold ${policy.followupConfidenceThreshold}`,
        });
      }),
    );

    // Emit extraction confidence metrics
    for (const clause of clauseData) {
      cbaIntelExtractionConfidence.observe(
        { clause_family: clause.clauseFamily },
        clause.confidence,
      );
    }

    // Update document status
    await updateDocumentStatus(documentId, "extracted", {
      parsedMetadata: metadata as unknown as Record<string, unknown>,
    });

    // Complete extraction run
    await completeExtractionRun(run.id, {
      findingsCount: findings.length,
      errorCount: errors.length,
        errors: undefined,
    });

    logger.info("Extraction completed", {
      documentId,
      runId: run.id,
      findingsCount: findings.length,
      wagesFound: wageData.length,
      clausesFound: clauseData.length,
    });

    return {
      documentId,
      extractionRunId: run.id,
      findings,
      agreement: metadata,
      wageAdjustments: wageData,
      clauses: clauseData,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(msg);

    await completeExtractionRun(run.id, {
      findingsCount: 0,
      errorCount: 1,
      errors: { messages: [msg] },
    });

    await updateDocumentStatus(documentId, "failed");

    logger.error("Extraction failed", { documentId, runId: run.id, error: msg });

    return {
      documentId,
      extractionRunId: run.id,
      findings: [],
      agreement: null,
      wageAdjustments: [],
      clauses: [],
      errors,
    };
  }
}

// ---------------------------------------------------------------------------
// Bulk extraction — process all raw/normalized documents
// ---------------------------------------------------------------------------

export async function runBulkExtraction(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: ExtractionResult[];
}> {
  // Find documents that haven't been extracted yet
  const documents = await db
    .select()
    .from(cbaIntelDocuments)
    .where(
      and(
        eq(cbaIntelDocuments.isLatest, true),
        eq(cbaIntelDocuments.processingStatus, "fetched"),
      ),
    )
    .limit(100);

  const results: ExtractionResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const doc of documents) {
    const result = await extractDocument(doc.id);
    results.push(result);

    if (result.errors.length === 0) {
      succeeded++;
    } else {
      failed++;
    }
  }

  logger.info("Bulk extraction completed", {
    processed: documents.length,
    succeeded,
    failed,
  });

  return { processed: documents.length, succeeded, failed, results };
}

export const __test__ = {
  parseThreshold,
  getExtractionPolicy,
  deriveActionRecommendations,
  normalizeText,
  extractMetadata,
  detectJurisdiction,
  detectSector,
  tryParseDate,
  extractWages,
  classifyClauses,
};
