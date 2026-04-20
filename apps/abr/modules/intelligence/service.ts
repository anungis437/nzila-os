import { db } from '@nzila/db';
import { sql } from 'drizzle-orm';

import type { AbrDataMode } from '@/lib/data-mode';
import type {
  ExecutiveInsightWidgets,
  ImportJobRecord,
  IntelligenceCaseRecord,
  IntelligenceFilters,
  IntelligenceIngestInput,
  IntelligenceIngestResult,
  IntelligenceListResult,
  IntelligenceReviewStatus,
  IntelligenceTrustLevel,
  ManualReviewQueueItem,
  RiskSignal,
  SourceRegistryItem,
} from './types';

const GLOBAL_ORG_ID = 'global';
const CACHE_TTL_MS = 30_000;

const DEMO_SOURCES: SourceRegistryItem[] = [
  {
    id: 'src_hrto',
    sourceName: 'HRTO public decision registry',
    jurisdiction: 'Ontario',
    ingestionType: 'source_sync',
    sourceType: 'tribunal',
    lawfulBasis: 'Publicly available tribunal decisions used for institutional risk research.',
    freshnessDate: '2026-04-10',
    lastIngestedAt: '2026-04-10T07:45:00.000Z',
    trustLevel: 'high',
    dataMode: 'demo',
    stale: false,
  },
  {
    id: 'src_bchrt',
    sourceName: 'BCHRT public decisions',
    jurisdiction: 'British Columbia',
    ingestionType: 'source_sync',
    sourceType: 'tribunal',
    lawfulBasis: 'Publicly available human rights tribunal decisions.',
    freshnessDate: '2026-04-08',
    lastIngestedAt: '2026-04-08T10:20:00.000Z',
    trustLevel: 'high',
    dataMode: 'demo',
    stale: false,
  },
  {
    id: 'src_chrt',
    sourceName: 'CHRT decision archive',
    jurisdiction: 'Federal',
    ingestionType: 'source_sync',
    sourceType: 'tribunal',
    lawfulBasis: 'Publicly available federal human rights decisions.',
    freshnessDate: '2026-03-20',
    lastIngestedAt: '2026-03-20T09:30:00.000Z',
    trustLevel: 'medium',
    dataMode: 'demo',
    stale: true,
  },
];

const DEMO_CASES: IntelligenceCaseRecord[] = [
  {
    id: 'abr_case_001',
    sourceId: 'src_hrto',
    dataMode: 'demo',
    jurisdiction: 'Ontario',
    year: 2024,
    sector: 'University',
    decisionBody: 'Human Rights Tribunal of Ontario',
    issueType: 'Hiring discrimination',
    protectedGrounds: ['race', 'ancestry', 'ethnic origin'],
    remedyType: 'Damages and policy review',
    awardRange: '$25k-$50k',
    employerType: 'Public institution',
    title: 'Black faculty recruitment shortlisting complaint',
    conciseSummary:
      'Tribunal reviewed screening and interview practices that systematically excluded Black applicants.',
    keyHoldings: [
      'Opaque screening criteria amplified biased decision-making.',
      'Institution failed to evidence a consistent hiring rubric.',
    ],
    facts: 'Complaint arose from repeated shortlisting exclusions across two cycles.',
    issues: ['selection criteria', 'documentation gaps', 'manager accountability'],
    reasoningSummary:
      'Reasoning emphasized inconsistency, insufficient record-keeping, and weak oversight.',
    remedies: ['general damages', 'training order', 'policy review'],
    lessonsForInstitutions: [
      'Use standardized scorecards with calibration records.',
      'Audit shortlist conversion rates by protected group.',
    ],
    relatedCaseIds: ['abr_case_003'],
    timelines: ['Complaint filed in Q1', 'mediation failed', 'merits hearing completed in 9 months'],
    riskPatterns: ['panel discretion drift', 'insufficient rationale capture'],
    trendIndicators: ['higher scrutiny on documentation', 'remedy packages include governance follow-up'],
    source: 'HRTO public decision registry',
    ingestionType: 'source_sync',
    ingestionDate: '2026-04-10T07:45:00.000Z',
    confidenceLevel: 'high',
    lastReviewStatus: 'approved',
    lastReviewedAt: '2026-04-10T12:15:00.000Z',
    awardAmount: '$40,000',
    parsedConfidence: 95,
    sourceStatus: 'verified',
    freshnessDate: '2026-04-10',
    provenanceNote: 'Parsed from public decision and manually reviewed by ABR analyst.',
  },
  {
    id: 'abr_case_002',
    sourceId: 'src_bchrt',
    dataMode: 'demo',
    jurisdiction: 'British Columbia',
    year: 2023,
    sector: 'Municipality',
    decisionBody: 'BC Human Rights Tribunal',
    issueType: 'Service delivery discrimination',
    protectedGrounds: ['race', 'place of origin'],
    remedyType: 'Policy correction',
    awardRange: '$10k-$25k',
    employerType: 'Municipal government',
    title: 'Escalation handling bias in public-facing service counter',
    conciseSummary:
      'Repeated escalation and enforcement patterns disproportionately targeted Black residents.',
    keyHoldings: [
      'Service scripts and escalation pathways contributed to differential treatment.',
      'Management lacked monitoring for racialized complaint patterns.',
    ],
    facts: 'Matter centered on frontline conduct and weak escalation supervision.',
    issues: ['service delivery', 'complaint escalation', 'manager oversight'],
    reasoningSummary:
      'Tribunal focused on recurring pattern evidence rather than one-off intent.',
    remedies: ['policy revision', 'staff training', 'report-back requirement'],
    lessonsForInstitutions: [
      'Track escalation rates by site and supervisor.',
      'Review scripts for coded enforcement language.',
    ],
    relatedCaseIds: [],
    timelines: ['Complaint period spanned 14 months', 'decision issued after review of pattern evidence'],
    riskPatterns: ['coded language', 'repeat complaint clustering'],
    trendIndicators: ['service-delivery claims increasingly tied to governance evidence'],
    source: 'BCHRT public decisions',
    ingestionType: 'source_sync',
    ingestionDate: '2026-04-08T10:20:00.000Z',
    confidenceLevel: 'high',
    lastReviewStatus: 'approved',
    lastReviewedAt: '2026-04-08T15:00:00.000Z',
    awardAmount: '$18,500',
    parsedConfidence: 91,
    sourceStatus: 'verified',
    freshnessDate: '2026-04-08',
    provenanceNote: 'Public decision imported via source registry and cleared in review queue.',
  },
  {
    id: 'abr_case_003',
    sourceId: 'src_chrt',
    dataMode: 'demo',
    jurisdiction: 'Federal',
    year: 2025,
    sector: 'Healthcare',
    decisionBody: 'Canadian Human Rights Tribunal',
    issueType: 'Promotion discrimination',
    protectedGrounds: ['race', 'colour'],
    remedyType: 'Damages and monitoring',
    awardRange: '$50k-$100k',
    employerType: 'Crown agency',
    title: 'Promotion pathway disparity in clinical leadership stream',
    conciseSummary:
      'Decision found systemic barriers in advancement assessments and sponsorship access.',
    keyHoldings: [
      'Promotion criteria were not applied consistently across candidates.',
      'Leadership sponsorship patterns created adverse systemic effects.',
    ],
    facts: 'Evidence included multiple rounds of advancement panel records and internal workforce analytics.',
    issues: ['promotion criteria', 'leadership sponsorship', 'adverse impact analytics'],
    reasoningSummary:
      'Decision linked qualitative testimony with adverse trend data and weak remediation evidence.',
    remedies: ['special compensation', 'executive accountability plan', 'quarterly reporting'],
    lessonsForInstitutions: [
      'Pair promotion analytics with governance-owned remediation steps.',
      'Track leadership sponsorship access and calibration outcomes.',
    ],
    relatedCaseIds: ['abr_case_001'],
    timelines: ['Investigation lasted 11 months', 'monitoring order lasted 12 months'],
    riskPatterns: ['informal sponsorship bias', 'criteria inconsistency'],
    trendIndicators: ['larger awards where institutions cannot evidence remediation follow-through'],
    source: 'CHRT decision archive',
    ingestionType: 'source_sync',
    ingestionDate: '2026-03-20T09:30:00.000Z',
    confidenceLevel: 'medium',
    lastReviewStatus: 'pending',
    lastReviewedAt: null,
    awardAmount: '$72,000',
    parsedConfidence: 76,
    sourceStatus: 'review_required',
    freshnessDate: '2026-03-20',
    provenanceNote: 'Automated parse complete; summary awaiting secondary legal-editor review.',
  },
];

const DEMO_JOBS: ImportJobRecord[] = [
  {
    id: 'job_abr_001',
    sourceId: 'src_hrto',
    dataMode: 'demo',
    format: 'json',
    parseStatus: 'parsed',
    dedupeStatus: 'clear',
    confidenceLabel: 'high',
    startedAt: '2026-04-10T07:45:00.000Z',
    completedAt: '2026-04-10T07:49:00.000Z',
    errorCount: 0,
  },
  {
    id: 'job_abr_002',
    sourceId: 'src_chrt',
    dataMode: 'demo',
    format: 'json',
    parseStatus: 'review_required',
    dedupeStatus: 'possible_duplicate',
    confidenceLabel: 'medium',
    startedAt: '2026-03-20T09:30:00.000Z',
    completedAt: '2026-03-20T09:40:00.000Z',
    errorCount: 1,
  },
];

const DEMO_REVIEW_QUEUE: ManualReviewQueueItem[] = [
  {
    id: 'rvw_001',
    caseId: 'abr_case_003',
    status: 'pending',
    reason: 'Comparable matter overlap requires legal-editor confirmation.',
    priority: 'urgent',
    reviewerId: null,
    lastReviewedAt: null,
    dataMode: 'demo',
  },
];

const memory = {
  sources: [...DEMO_SOURCES],
  cases: [...DEMO_CASES],
  jobs: [...DEMO_JOBS],
  reviewQueue: [...DEMO_REVIEW_QUEUE],
  errors: [] as Array<{ id: string; jobId: string; message: string; createdAt: string }>,
};

// ga-check:exempt — short-lived TTL cache, not primary persistence (data in DB / in-memory demo store)
const cache = new Map<string, { expiresAt: number; value: unknown }>();
let tablesReady = false;

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cacheGet<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value as T;
}

function cacheSet<T>(key: string, value: T): T {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function buildDedupeKey(input: {
  title: string;
  jurisdiction: string;
  year: number;
  issueType: string;
  dataMode: AbrDataMode;
}): string {
  return [
    input.title.trim().toLowerCase(),
    input.jurisdiction.trim().toLowerCase(),
    String(input.year),
    input.issueType.trim().toLowerCase(),
    input.dataMode,
  ].join('::');
}

function midpointFromAward(awardRange: string): number {
  const values = Array.from(awardRange.matchAll(/\$?(\d+(?:\.\d+)?)k?/gi)).map((item) => {
    const raw = Number(item[1]);
    return /k/i.test(item[0]) ? raw * 1000 : raw;
  });
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  return Math.round((values[0] + values[1]) / 2);
}

function toConfidenceBand(value: number): IntelligenceTrustLevel {
  if (value >= 85) return 'high';
  if (value >= 65) return 'medium';
  return 'low';
}

function normalizeSourceStatus(status: string): IntelligenceCaseRecord['sourceStatus'] {
  if (status === 'verified' || status === 'review_required' || status === 'stale') {
    return status;
  }
  return 'review_required';
}

function asCase(row: Record<string, unknown>): IntelligenceCaseRecord {
  const details = (row.details_json as Record<string, unknown>) ?? {};
  const decisionDate = String(row.decision_date);
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    dataMode: row.data_mode as AbrDataMode,
    jurisdiction: String(row.jurisdiction),
    year: new Date(decisionDate).getUTCFullYear(),
    sector: String(row.sector),
    decisionBody: String(row.decision_body),
    issueType: String(row.issue_type),
    protectedGrounds: Array.isArray(details.protectedGrounds) ? (details.protectedGrounds as string[]) : [],
    remedyType: String(row.remedy_type),
    awardRange: String(details.awardRange ?? row.award_amount),
    employerType: String(row.employer_type),
    title: String(row.title),
    conciseSummary: String(row.summary),
    keyHoldings: Array.isArray(details.keyHoldings) ? (details.keyHoldings as string[]) : [],
    facts: String(details.facts ?? ''),
    issues: Array.isArray(details.issues) ? (details.issues as string[]) : [],
    reasoningSummary: String(details.reasoningSummary ?? ''),
    remedies: Array.isArray(details.remedies) ? (details.remedies as string[]) : [],
    lessonsForInstitutions: Array.isArray(details.lessonsForInstitutions)
      ? (details.lessonsForInstitutions as string[])
      : [],
    relatedCaseIds: Array.isArray(details.relatedCaseIds) ? (details.relatedCaseIds as string[]) : [],
    timelines: Array.isArray(details.timelines) ? (details.timelines as string[]) : [],
    riskPatterns: Array.isArray(details.riskPatterns) ? (details.riskPatterns as string[]) : [],
    trendIndicators: Array.isArray(details.trendIndicators) ? (details.trendIndicators as string[]) : [],
    source: String(details.source ?? row.source_name),
    ingestionType: row.ingestion_type as IntelligenceCaseRecord['ingestionType'],
    ingestionDate: String(row.ingestion_date),
    confidenceLevel: row.confidence_level as IntelligenceTrustLevel,
    lastReviewStatus: row.review_status as IntelligenceReviewStatus,
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
    awardAmount: String(row.award_amount),
    parsedConfidence: Number(row.parsed_confidence),
    sourceStatus: normalizeSourceStatus(String(row.source_status)),
    freshnessDate: String(row.freshness_date),
    provenanceNote: String(row.provenance_note),
  };
}

function asSource(row: Record<string, unknown>): SourceRegistryItem {
  return {
    id: String(row.id),
    sourceName: String(row.source_name),
    jurisdiction: String(row.jurisdiction),
    ingestionType: row.ingestion_type as SourceRegistryItem['ingestionType'],
    sourceType: row.source_type as SourceRegistryItem['sourceType'],
    lawfulBasis: String(row.lawful_basis),
    freshnessDate: String(row.freshness_date),
    lastIngestedAt: String(row.last_ingested_at),
    trustLevel: row.trust_level as IntelligenceTrustLevel,
    dataMode: row.data_mode as AbrDataMode,
    stale: Boolean(row.stale),
  };
}

function asJob(row: Record<string, unknown>): ImportJobRecord {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    dataMode: row.data_mode as AbrDataMode,
    format: row.format as ImportJobRecord['format'],
    parseStatus: row.parse_status as ImportJobRecord['parseStatus'],
    dedupeStatus: row.dedupe_status as ImportJobRecord['dedupeStatus'],
    confidenceLabel: row.confidence_label as IntelligenceTrustLevel,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    errorCount: Number(row.error_count),
  };
}

function asReviewQueue(row: Record<string, unknown>): ManualReviewQueueItem {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    status: row.status as IntelligenceReviewStatus,
    reason: String(row.reason),
    priority: row.priority as ManualReviewQueueItem['priority'],
    reviewerId: row.reviewer_id ? String(row.reviewer_id) : null,
    lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
    dataMode: row.data_mode as AbrDataMode,
  };
}

async function ensureTables(): Promise<void> {
  if (!hasDatabase() || tablesReady) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_intelligence_sources (
      id text PRIMARY KEY,
      source_name text NOT NULL,
      jurisdiction text NOT NULL,
      ingestion_type text NOT NULL,
      source_type text NOT NULL,
      lawful_basis text NOT NULL,
      freshness_date date NOT NULL,
      last_ingested_at timestamptz NOT NULL,
      trust_level text NOT NULL,
      data_mode text NOT NULL,
      stale boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_cases (
      id text PRIMARY KEY,
      org_id text NOT NULL,
      source_id text NOT NULL,
      title text NOT NULL,
      jurisdiction text NOT NULL,
      decision_date date NOT NULL,
      sector text NOT NULL,
      issue_type text NOT NULL,
      summary text NOT NULL,
      outcome text NOT NULL,
      award_amount text NOT NULL,
      parsed_confidence integer NOT NULL,
      review_status text NOT NULL,
      confidence_level text NOT NULL,
      ingestion_type text NOT NULL,
      ingestion_date timestamptz NOT NULL,
      last_reviewed_at timestamptz,
      source_status text NOT NULL,
      freshness_date date NOT NULL,
      provenance_note text NOT NULL,
      employer_type text NOT NULL,
      decision_body text NOT NULL,
      remedy_type text NOT NULL,
      data_mode text NOT NULL,
      dedupe_key text NOT NULL UNIQUE,
      details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_case_review_queue (
      id text PRIMARY KEY,
      case_id text NOT NULL,
      status text NOT NULL,
      reason text NOT NULL,
      priority text NOT NULL,
      reviewer_id text,
      last_reviewed_at timestamptz,
      data_mode text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_intelligence_ingest_jobs (
      id text PRIMARY KEY,
      source_id text NOT NULL,
      data_mode text NOT NULL,
      format text NOT NULL,
      parse_status text NOT NULL,
      dedupe_status text NOT NULL,
      confidence_label text NOT NULL,
      started_at timestamptz NOT NULL,
      completed_at timestamptz,
      error_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_intelligence_ingest_errors (
      id text PRIMARY KEY,
      job_id text NOT NULL,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  tablesReady = true;
}

async function ensureDemoSeed(mode: AbrDataMode): Promise<void> {
  if (mode !== 'demo') return;
  if (!hasDatabase()) return;

  await ensureTables();

  const existing = (await db.execute(sql`
    SELECT id FROM abr_intelligence_sources
    WHERE data_mode = ${mode}
    LIMIT 1
  `)) as Array<Record<string, unknown>>;

  if (existing.length > 0) return;

  for (const source of DEMO_SOURCES) {
    await db.execute(sql`
      INSERT INTO abr_intelligence_sources (
        id, source_name, jurisdiction, ingestion_type, source_type, lawful_basis,
        freshness_date, last_ingested_at, trust_level, data_mode, stale
      ) VALUES (
        ${source.id}, ${source.sourceName}, ${source.jurisdiction}, ${source.ingestionType}, ${source.sourceType},
        ${source.lawfulBasis}, ${source.freshnessDate}::date, ${source.lastIngestedAt}::timestamptz,
        ${source.trustLevel}, ${source.dataMode}, ${source.stale}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  for (const item of DEMO_CASES) {
    const dedupeKey = buildDedupeKey({
      title: item.title,
      jurisdiction: item.jurisdiction,
      year: item.year,
      issueType: item.issueType,
      dataMode: item.dataMode,
    });
    await db.execute(sql`
      INSERT INTO abr_cases (
        id, org_id, source_id, title, jurisdiction, decision_date, sector, issue_type,
        summary, outcome, award_amount, parsed_confidence, review_status, confidence_level,
        ingestion_type, ingestion_date, last_reviewed_at, source_status, freshness_date,
        provenance_note, employer_type, decision_body, remedy_type, data_mode, dedupe_key, details_json
      ) VALUES (
        ${item.id}, ${GLOBAL_ORG_ID}, ${item.sourceId}, ${item.title}, ${item.jurisdiction},
        ${`${item.year}-01-01`}::date, ${item.sector}, ${item.issueType}, ${item.conciseSummary},
        ${item.reasoningSummary}, ${item.awardAmount}, ${item.parsedConfidence}, ${item.lastReviewStatus},
        ${item.confidenceLevel}, ${item.ingestionType}, ${item.ingestionDate}::timestamptz,
        ${item.lastReviewedAt}::timestamptz, ${item.sourceStatus}, ${item.freshnessDate}::date,
        ${item.provenanceNote}, ${item.employerType}, ${item.decisionBody}, ${item.remedyType},
        ${item.dataMode}, ${dedupeKey}, ${JSON.stringify(item)}::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  for (const job of DEMO_JOBS) {
    await db.execute(sql`
      INSERT INTO abr_intelligence_ingest_jobs (
        id, source_id, data_mode, format, parse_status, dedupe_status,
        confidence_label, started_at, completed_at, error_count
      ) VALUES (
        ${job.id}, ${job.sourceId}, ${job.dataMode}, ${job.format}, ${job.parseStatus}, ${job.dedupeStatus},
        ${job.confidenceLabel}, ${job.startedAt}::timestamptz, ${job.completedAt}::timestamptz, ${job.errorCount}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  for (const item of DEMO_REVIEW_QUEUE) {
    await db.execute(sql`
      INSERT INTO abr_case_review_queue (
        id, case_id, status, reason, priority, reviewer_id, last_reviewed_at, data_mode
      ) VALUES (
        ${item.id}, ${item.caseId}, ${item.status}, ${item.reason}, ${item.priority},
        ${item.reviewerId}, ${item.lastReviewedAt}::timestamptz, ${item.dataMode}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
}

function listMemorySources(mode: AbrDataMode): SourceRegistryItem[] {
  return memory.sources.filter((item) => item.dataMode === mode);
}

function listMemoryCases(mode: AbrDataMode): IntelligenceCaseRecord[] {
  return memory.cases.filter((item) => item.dataMode === mode);
}

function listMemoryJobs(mode: AbrDataMode): ImportJobRecord[] {
  return memory.jobs.filter((item) => item.dataMode === mode);
}

function listMemoryQueue(mode: AbrDataMode): ManualReviewQueueItem[] {
  return memory.reviewQueue.filter((item) => item.dataMode === mode);
}

async function listSources(mode: AbrDataMode): Promise<SourceRegistryItem[]> {
  await ensureDemoSeed(mode);
  const key = `sources:${mode}`;
  const cached = cacheGet<SourceRegistryItem[]>(key);
  if (cached) return cached;

  if (hasDatabase()) {
    const rows = (await db.execute(sql`
      SELECT *
      FROM abr_intelligence_sources
      WHERE data_mode = ${mode}
      ORDER BY source_name ASC
    `)) as Array<Record<string, unknown>>;
    return cacheSet(key, rows.map(asSource));
  }

  return cacheSet(key, listMemorySources(mode));
}

async function listCases(mode: AbrDataMode): Promise<IntelligenceCaseRecord[]> {
  await ensureDemoSeed(mode);
  const key = `cases:${mode}`;
  const cached = cacheGet<IntelligenceCaseRecord[]>(key);
  if (cached) return cached;

  if (hasDatabase()) {
    await ensureTables();
    const rows = (await db.execute(sql`
      SELECT *
      FROM abr_cases
      WHERE data_mode = ${mode}
      ORDER BY decision_date DESC, created_at DESC
    `)) as Array<Record<string, unknown>>;
    return cacheSet(key, rows.map(asCase));
  }

  return cacheSet(key, listMemoryCases(mode));
}

async function listJobs(mode: AbrDataMode): Promise<ImportJobRecord[]> {
  await ensureDemoSeed(mode);
  const key = `jobs:${mode}`;
  const cached = cacheGet<ImportJobRecord[]>(key);
  if (cached) return cached;

  if (hasDatabase()) {
    const rows = (await db.execute(sql`
      SELECT *
      FROM abr_intelligence_ingest_jobs
      WHERE data_mode = ${mode}
      ORDER BY started_at DESC
    `)) as Array<Record<string, unknown>>;
    return cacheSet(key, rows.map(asJob));
  }

  return cacheSet(key, listMemoryJobs(mode));
}

async function listReviewQueue(mode: AbrDataMode): Promise<ManualReviewQueueItem[]> {
  await ensureDemoSeed(mode);
  const key = `queue:${mode}`;
  const cached = cacheGet<ManualReviewQueueItem[]>(key);
  if (cached) return cached;

  if (hasDatabase()) {
    const rows = (await db.execute(sql`
      SELECT *
      FROM abr_case_review_queue
      WHERE data_mode = ${mode}
      ORDER BY created_at DESC
    `)) as Array<Record<string, unknown>>;
    return cacheSet(key, rows.map(asReviewQueue));
  }

  return cacheSet(key, listMemoryQueue(mode));
}

function filterCases(items: IntelligenceCaseRecord[], filters: IntelligenceFilters = {}): IntelligenceCaseRecord[] {
  const search = filters.search?.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.jurisdiction && item.jurisdiction !== filters.jurisdiction) return false;
    if (filters.year && String(item.year) !== filters.year) return false;
    if (filters.sector && item.sector !== filters.sector) return false;
    if (filters.decisionBody && item.decisionBody !== filters.decisionBody) return false;
    if (filters.issueType && item.issueType !== filters.issueType) return false;
    if (filters.protectedGround && !item.protectedGrounds.includes(filters.protectedGround)) return false;
    if (filters.remedyType && item.remedyType !== filters.remedyType) return false;
    if (filters.awardRange && item.awardRange !== filters.awardRange) return false;
    if (filters.employerType && item.employerType !== filters.employerType) return false;
    if (filters.reviewStatus && item.lastReviewStatus !== filters.reviewStatus) return false;
    if (search) {
      const haystack = [
        item.title,
        item.conciseSummary,
        item.issueType,
        item.decisionBody,
        item.source,
        ...item.issues,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function paginateCases(items: IntelligenceCaseRecord[], page = 1, pageSize = 12): IntelligenceListResult {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(50, pageSize));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
  };
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',').map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? '';
      return accumulator;
    }, {});
  });
}

function coerceCaseRecord(
  raw: Record<string, unknown>,
  source: SourceRegistryItem,
  dataMode: AbrDataMode,
): { case: IntelligenceCaseRecord | null; error?: string } {
  const title = String(raw.title ?? '').trim();
  const jurisdiction = String(raw.jurisdiction ?? source.jurisdiction).trim();
  const year = Number(raw.year ?? raw.date ?? 0);
  const sector = String(raw.sector ?? '').trim();
  const issueType = String(raw.issueType ?? raw.issue_type ?? '').trim();
  const summary = String(raw.summary ?? raw.conciseSummary ?? '').trim();

  if (!title || !jurisdiction || !year || !sector || !issueType || !summary) {
    return { case: null, error: `Invalid record: missing required fields for ${title || 'untitled case'}.` };
  }

  const completenessSignals = [
    title,
    jurisdiction,
    String(year),
    sector,
    issueType,
    summary,
    String(raw.outcome ?? ''),
    String(raw.decisionBody ?? raw.decision_body ?? ''),
    String(raw.remedyType ?? raw.remedy_type ?? ''),
  ].filter(Boolean).length;
  const parsedConfidence = Math.min(99, Math.max(45, completenessSignals * 10 + (source.trustLevel === 'high' ? 5 : 0)));
  const confidenceLevel = toConfidenceBand(parsedConfidence);
  const lastReviewStatus: IntelligenceReviewStatus = parsedConfidence >= 85 ? 'approved' : 'pending';
  const sourceStatus: IntelligenceCaseRecord['sourceStatus'] = lastReviewStatus === 'approved' ? 'verified' : 'review_required';
  const ingestionDate = nowIso();
  const awardRange = String(raw.awardRange ?? raw.award_amount ?? 'Unknown');

  return {
    case: {
      id: genId('case'),
      sourceId: source.id,
      dataMode,
      jurisdiction,
      year,
      sector,
      decisionBody: String(raw.decisionBody ?? raw.decision_body ?? 'Unknown tribunal'),
      issueType,
      protectedGrounds: String(raw.protectedGrounds ?? raw.protected_grounds ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      remedyType: String(raw.remedyType ?? raw.remedy_type ?? 'Unknown remedy'),
      awardRange,
      employerType: String(raw.employerType ?? raw.employer_type ?? 'Unknown employer type'),
      title,
      conciseSummary: summary,
      keyHoldings: String(raw.keyHoldings ?? raw.key_holdings ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      facts: String(raw.facts ?? ''),
      issues: String(raw.issues ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      reasoningSummary: String(raw.reasoningSummary ?? raw.reasoning_summary ?? raw.outcome ?? ''),
      remedies: String(raw.remedies ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      lessonsForInstitutions: String(raw.lessonsForInstitutions ?? raw.lessons ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      relatedCaseIds: String(raw.relatedCaseIds ?? raw.related_case_ids ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      timelines: String(raw.timelines ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      riskPatterns: String(raw.riskPatterns ?? raw.risk_patterns ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      trendIndicators: String(raw.trendIndicators ?? raw.trend_indicators ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      source: source.sourceName,
      ingestionType: source.ingestionType,
      ingestionDate,
      confidenceLevel,
      lastReviewStatus,
      lastReviewedAt: lastReviewStatus === 'approved' ? ingestionDate : null,
      awardAmount: String(raw.awardAmount ?? raw.award_amount ?? awardRange),
      parsedConfidence,
      sourceStatus,
      freshnessDate: ingestionDate.slice(0, 10),
      provenanceNote: `Manual ${source.ingestionType === 'manual_csv' ? 'CSV' : 'JSON'} import via ${source.sourceName}.`,
    },
  };
}

async function upsertSource(input: IntelligenceIngestInput): Promise<SourceRegistryItem> {
  const id = input.sourceId ?? genId('src');
  const source: SourceRegistryItem = {
    id,
    sourceName: input.sourceName,
    jurisdiction: input.jurisdiction,
    ingestionType: input.ingestionType,
    sourceType: 'manual_upload',
    lawfulBasis: 'Manual institutional or lawful public record import.',
    freshnessDate: nowIso().slice(0, 10),
    lastIngestedAt: nowIso(),
    trustLevel: 'medium',
    dataMode: input.dataMode,
    stale: false,
  };

  if (hasDatabase()) {
    await ensureTables();
    await db.execute(sql`
      INSERT INTO abr_intelligence_sources (
        id, source_name, jurisdiction, ingestion_type, source_type, lawful_basis,
        freshness_date, last_ingested_at, trust_level, data_mode, stale
      ) VALUES (
        ${source.id}, ${source.sourceName}, ${source.jurisdiction}, ${source.ingestionType}, ${source.sourceType},
        ${source.lawfulBasis}, ${source.freshnessDate}::date, ${source.lastIngestedAt}::timestamptz,
        ${source.trustLevel}, ${source.dataMode}, ${source.stale}
      )
      ON CONFLICT (id) DO UPDATE SET
        source_name = excluded.source_name,
        jurisdiction = excluded.jurisdiction,
        ingestion_type = excluded.ingestion_type,
        freshness_date = excluded.freshness_date,
        last_ingested_at = excluded.last_ingested_at,
        trust_level = excluded.trust_level,
        data_mode = excluded.data_mode,
        stale = excluded.stale
    `);
  } else {
    const existing = memory.sources.find((item) => item.id === source.id);
    if (existing) {
      Object.assign(existing, source);
    } else {
      memory.sources.push(source);
    }
  }

  invalidateCache(`sources:${input.dataMode}`);
  return source;
}

async function insertCaseRecord(item: IntelligenceCaseRecord): Promise<boolean> {
  const dedupeKey = buildDedupeKey({
    title: item.title,
    jurisdiction: item.jurisdiction,
    year: item.year,
    issueType: item.issueType,
    dataMode: item.dataMode,
  });

  if (hasDatabase()) {
    const existing = (await db.execute(sql`
      SELECT id FROM abr_cases WHERE dedupe_key = ${dedupeKey} LIMIT 1
    `)) as Array<Record<string, unknown>>;
    if (existing.length > 0) return false;

    await db.execute(sql`
      INSERT INTO abr_cases (
        id, org_id, source_id, title, jurisdiction, decision_date, sector, issue_type,
        summary, outcome, award_amount, parsed_confidence, review_status, confidence_level,
        ingestion_type, ingestion_date, last_reviewed_at, source_status, freshness_date,
        provenance_note, employer_type, decision_body, remedy_type, data_mode, dedupe_key, details_json
      ) VALUES (
        ${item.id}, ${GLOBAL_ORG_ID}, ${item.sourceId}, ${item.title}, ${item.jurisdiction},
        ${`${item.year}-01-01`}::date, ${item.sector}, ${item.issueType}, ${item.conciseSummary},
        ${item.reasoningSummary}, ${item.awardAmount}, ${item.parsedConfidence}, ${item.lastReviewStatus},
        ${item.confidenceLevel}, ${item.ingestionType}, ${item.ingestionDate}::timestamptz,
        ${item.lastReviewedAt}::timestamptz, ${item.sourceStatus}, ${item.freshnessDate}::date,
        ${item.provenanceNote}, ${item.employerType}, ${item.decisionBody}, ${item.remedyType},
        ${item.dataMode}, ${dedupeKey}, ${JSON.stringify(item)}::jsonb
      )
    `);
    return true;
  }

  const exists = memory.cases.some((candidate) => buildDedupeKey({
    title: candidate.title,
    jurisdiction: candidate.jurisdiction,
    year: candidate.year,
    issueType: candidate.issueType,
    dataMode: candidate.dataMode,
  }) === dedupeKey);
  if (exists) return false;
  memory.cases.push(item);
  return true;
}

async function insertReviewQueueItem(item: ManualReviewQueueItem): Promise<void> {
  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_case_review_queue (
        id, case_id, status, reason, priority, reviewer_id, last_reviewed_at, data_mode
      ) VALUES (
        ${item.id}, ${item.caseId}, ${item.status}, ${item.reason}, ${item.priority},
        ${item.reviewerId}, ${item.lastReviewedAt}::timestamptz, ${item.dataMode}
      )
    `);
  } else {
    memory.reviewQueue.push(item);
  }
}

async function insertJob(job: ImportJobRecord): Promise<void> {
  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_intelligence_ingest_jobs (
        id, source_id, data_mode, format, parse_status, dedupe_status,
        confidence_label, started_at, completed_at, error_count
      ) VALUES (
        ${job.id}, ${job.sourceId}, ${job.dataMode}, ${job.format}, ${job.parseStatus}, ${job.dedupeStatus},
        ${job.confidenceLabel}, ${job.startedAt}::timestamptz, ${job.completedAt}::timestamptz, ${job.errorCount}
      )
      ON CONFLICT (id) DO UPDATE SET
        parse_status = excluded.parse_status,
        dedupe_status = excluded.dedupe_status,
        confidence_label = excluded.confidence_label,
        completed_at = excluded.completed_at,
        error_count = excluded.error_count
    `);
  } else {
    const index = memory.jobs.findIndex((item) => item.id === job.id);
    if (index >= 0) {
      memory.jobs[index] = job;
    } else {
      memory.jobs.push(job);
    }
  }
}

async function logJobError(jobId: string, message: string): Promise<void> {
  const entry = { id: genId('ingest_err'), jobId, message, createdAt: nowIso() };
  if (hasDatabase()) {
    await db.execute(sql`
      INSERT INTO abr_intelligence_ingest_errors (id, job_id, message, created_at)
      VALUES (${entry.id}, ${entry.jobId}, ${entry.message}, ${entry.createdAt}::timestamptz)
    `);
  } else {
    memory.errors.push(entry);
  }
}

export async function listIntelligenceListing(filters: IntelligenceFilters = {}): Promise<IntelligenceListResult> {
  const mode = filters.dataMode ?? 'demo';
  const filtered = filterCases(await listCases(mode), filters);
  return paginateCases(filtered, filters.page, filters.pageSize);
}

export function listRiskSignals(orgId: string, dataMode: AbrDataMode = 'demo'): RiskSignal[] {
  const items = dataMode === 'demo'
    ? DEMO_CASES.filter((item) => item.dataMode === dataMode)
    : memory.cases.filter((item) => item.dataMode === dataMode);
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.issueType, (counts.get(item.issueType) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issueType, count], index) => ({
      id: `sig_${dataMode}_${index}`,
      orgId,
      signal: `${issueType} matters now represent ${count} tracked cases in ${dataMode} mode.`,
      category: issueType.toLowerCase().includes('promotion')
        ? 'promotion'
        : issueType.toLowerCase().includes('service')
          ? 'service_delivery'
          : issueType.toLowerCase().includes('policy')
            ? 'policy'
            : issueType.toLowerCase().includes('discipline')
              ? 'discipline'
              : 'hiring',
      confidenceBand: count >= 2 ? 'high' : 'medium',
      trend: count >= 2 ? 'up' : 'flat',
      observedAt: nowIso(),
    }));
}

export function listIntelligenceCases(filters: IntelligenceFilters = {}): IntelligenceCaseRecord[] {
  const mode = filters.dataMode ?? 'demo';
  const items = mode === 'demo' ? DEMO_CASES : memory.cases.filter((item) => item.dataMode === mode);
  return paginateCases(filterCases(items, filters), filters.page, filters.pageSize).items;
}

export async function getIntelligenceCase(
  caseId: string,
  dataMode: AbrDataMode = 'demo',
): Promise<IntelligenceCaseRecord | null> {
  const items = await listCases(dataMode);
  return items.find((item) => item.id === caseId) ?? null;
}

export async function getComparableCases(
  caseId: string,
  dataMode: AbrDataMode = 'demo',
): Promise<IntelligenceCaseRecord[]> {
  const items = await listCases(dataMode);
  const item = items.find((candidate) => candidate.id === caseId);
  if (!item) return [];
  if (item.relatedCaseIds.length > 0) {
    return items.filter((candidate) => item.relatedCaseIds.includes(candidate.id));
  }
  return items.filter((candidate) =>
    candidate.id !== caseId &&
    (candidate.issueType === item.issueType || candidate.sector === item.sector || candidate.jurisdiction === item.jurisdiction),
  ).slice(0, 3);
}

export async function getExecutiveInsightWidgets(
  dataMode: AbrDataMode = 'demo',
): Promise<ExecutiveInsightWidgets> {
  const items = await listCases(dataMode);
  const issueCounts = new Map<string, number>();
  const sectorPatterns = new Map<string, string>();
  const byYear = new Map<number, number[]>();

  for (const item of items) {
    issueCounts.set(item.issueType, (issueCounts.get(item.issueType) ?? 0) + 1);
    if (!sectorPatterns.has(item.sector) && item.trendIndicators[0]) {
      sectorPatterns.set(item.sector, item.trendIndicators[0]);
    }
    byYear.set(item.year, [...(byYear.get(item.year) ?? []), midpointFromAward(item.awardRange)]);
  }

  return {
    risingIssueCategories: Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, deltaPct: count * 6 + 6 })),
    repeatSectorTrends: Array.from(sectorPatterns.entries())
      .slice(0, 3)
      .map(([sector, pattern]) => ({ sector, pattern })),
    averageAwardsOverTime: Array.from(byYear.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, values]) => ({
        year,
        averageRange: `$${Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toLocaleString()}`,
      })),
    complaintLifecycleBenchmarks: [
      { stage: 'Source ingest', avgDays: 2 },
      { stage: 'Legal review', avgDays: 5 },
      { stage: 'Executive packaging', avgDays: 3 },
    ],
  };
}

export async function listSourceRegistry(dataMode: AbrDataMode = 'demo'): Promise<SourceRegistryItem[]> {
  return listSources(dataMode);
}

export async function listImportJobs(dataMode: AbrDataMode = 'demo'): Promise<ImportJobRecord[]> {
  return listJobs(dataMode);
}

export async function listManualReviewQueue(dataMode: AbrDataMode = 'demo'): Promise<ManualReviewQueueItem[]> {
  return listReviewQueue(dataMode);
}

export async function getIntelligenceFacets(dataMode: AbrDataMode = 'demo') {
  const items = await listCases(dataMode);
  return {
    jurisdictions: [...new Set(items.map((item) => item.jurisdiction))],
    years: [...new Set(items.map((item) => String(item.year)))],
    sectors: [...new Set(items.map((item) => item.sector))],
    decisionBodies: [...new Set(items.map((item) => item.decisionBody))],
    issueTypes: [...new Set(items.map((item) => item.issueType))],
    protectedGrounds: [...new Set(items.flatMap((item) => item.protectedGrounds))],
    remedyTypes: [...new Set(items.map((item) => item.remedyType))],
    awardRanges: [...new Set(items.map((item) => item.awardRange))],
    employerTypes: [...new Set(items.map((item) => item.employerType))],
    reviewStatuses: [...new Set(items.map((item) => item.lastReviewStatus))],
  };
}

export async function ingestIntelligenceRecords(
  input: IntelligenceIngestInput,
): Promise<IntelligenceIngestResult> {
  await ensureTables();
  const source = await upsertSource(input);
  const startedAt = nowIso();
  const job: ImportJobRecord = {
    id: genId('job'),
    sourceId: source.id,
    dataMode: input.dataMode,
    format: input.format,
    parseStatus: 'queued',
    dedupeStatus: 'clear',
    confidenceLabel: 'medium',
    startedAt,
    completedAt: null,
    errorCount: 0,
  };
  await insertJob(job);

  const parsed = input.format === 'json'
    ? (JSON.parse(input.content) as Array<Record<string, unknown>>)
    : parseCsv(input.content);

  const rows = Array.isArray(parsed) ? parsed : [];
  const errors: string[] = [];
  let insertedCount = 0;
  let duplicateCount = 0;
  let reviewCount = 0;
  const confidences: number[] = [];

  for (const raw of rows) {
    const coerced = coerceCaseRecord(raw, source, input.dataMode);
    if (!coerced.case) {
      const message = coerced.error ?? 'Invalid intelligence row.';
      errors.push(message);
      await logJobError(job.id, message);
      continue;
    }

    confidences.push(coerced.case.parsedConfidence);
    const inserted = await insertCaseRecord(coerced.case);
    if (!inserted) {
      duplicateCount += 1;
      continue;
    }

    insertedCount += 1;
    if (coerced.case.lastReviewStatus !== 'approved') {
      reviewCount += 1;
      await insertReviewQueueItem({
        id: genId('review'),
        caseId: coerced.case.id,
        status: 'pending',
        reason: 'Imported record requires analyst review before executive use.',
        priority: coerced.case.parsedConfidence >= 70 ? 'normal' : 'urgent',
        reviewerId: null,
        lastReviewedAt: null,
        dataMode: input.dataMode,
      });
    }
  }

  const averageConfidence = confidences.length > 0
    ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
    : 50;
  const updatedJob: ImportJobRecord = {
    ...job,
    parseStatus: errors.length > 0 ? (insertedCount > 0 ? 'review_required' : 'error') : (reviewCount > 0 ? 'review_required' : 'parsed'),
    dedupeStatus: duplicateCount > 0 ? (insertedCount > 0 ? 'possible_duplicate' : 'deduped') : (errors.length > 0 ? 'error' : 'clear'),
    confidenceLabel: toConfidenceBand(averageConfidence),
    completedAt: nowIso(),
    errorCount: errors.length,
  };
  await insertJob(updatedJob);

  invalidateCache(`cases:${input.dataMode}`);
  invalidateCache(`jobs:${input.dataMode}`);
  invalidateCache(`queue:${input.dataMode}`);
  invalidateCache(`sources:${input.dataMode}`);

  return {
    job: updatedJob,
    insertedCount,
    duplicateCount,
    reviewCount,
    errors,
  };
}
