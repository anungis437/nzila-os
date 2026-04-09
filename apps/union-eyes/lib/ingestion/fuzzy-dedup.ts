/**
 * Fuzzy Deduplication Engine (§5-§7)
 *
 * Edge-case duplicate detection beyond exact external_case_id matching:
 *
 * §5 Case Dedup  — title similarity (Jaccard), timestamp proximity (±24h), same parties
 * §6 Document Dedup — content-hash blocking + metadata similarity flagging
 * §7 Timeline Event Dedup — enhanced content-hash + temporal proximity matching
 *
 * This module does NOT modify the core ingestion pipeline. It runs as a
 * post-import analysis step, writing results to duplicate_groups and
 * data_quality_warnings tables.
 */

import { createHash } from 'crypto';
import { db } from '@/db/db';
import { sql, eq, and, inArray } from 'drizzle-orm';
import {
  duplicateGroups,
  duplicateGroupMembers,
  dataQualityWarnings,
  ingestionRecords,
} from '@/db/schema/ingestion-schema';
import { grievances } from '@/db/schema/grievance-schema';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FuzzyMatch {
  recordIdA: string;
  recordIdB: string;
  score: number;
  reasons: MatchReason[];
}

export interface MatchReason {
  reason: string;
  score: number;
  detail?: string;
}

export interface DedupScanResult {
  scanned: number;
  groupsCreated: number;
  warningsCreated: number;
  matches: FuzzyMatch[];
}

// ─── String Similarity (Jaccard on word bigrams) ─────────────────────────────

function wordBigrams(str: string): Set<string> {
  const words = str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const bigrams = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i + 1]}`);
  }
  // Also add individual words for short strings
  for (const w of words) {
    bigrams.add(w);
  }
  return bigrams;
}

export function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = wordBigrams(a);
  const setB = wordBigrams(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

// ─── Timestamp Proximity ─────────────────────────────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function timestampProximity(dateA: string | null, dateB: string | null): number {
  if (!dateA || !dateB) return 0;
  const tA = new Date(dateA).getTime();
  const tB = new Date(dateB).getTime();
  if (isNaN(tA) || isNaN(tB)) return 0;

  const diff = Math.abs(tA - tB);
  if (diff === 0) return 1;
  if (diff <= TWENTY_FOUR_HOURS_MS) return 1 - diff / TWENTY_FOUR_HOURS_MS;
  return 0;
}

// ─── Party Name Similarity ───────────────────────────────────────────────────

function normalizePartyName(name: string | null | undefined): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

export function partyNameMatch(nameA: string | null | undefined, nameB: string | null | undefined): number {
  const a = normalizePartyName(nameA);
  const b = normalizePartyName(nameB);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return jaccardSimilarity(a, b);
}

// ─── Composite Case Similarity ──────────────────────────────────────────────

export interface CaseRecord {
  id: string;
  title: string;
  description?: string | null;
  incidentDate?: string | null;
  filedDate?: string | null;
  grievantName?: string | null;
  organizationId: string;
}

export function computeCaseSimilarity(a: CaseRecord, b: CaseRecord): FuzzyMatch | null {
  // Only compare within same org
  if (a.organizationId !== b.organizationId) return null;

  const reasons: MatchReason[] = [];

  // Title similarity
  const titleScore = jaccardSimilarity(a.title, b.title);
  if (titleScore >= 0.75) {
    reasons.push({ reason: 'title_similarity', score: titleScore, detail: `"${a.title}" vs "${b.title}"` });
  }

  // Timestamp proximity (incident_date or filed_date)
  const dateA = a.incidentDate ?? a.filedDate;
  const dateB = b.incidentDate ?? b.filedDate;
  const timeScore = timestampProximity(dateA, dateB);
  if (timeScore > 0) {
    reasons.push({ reason: 'timestamp_proximity', score: timeScore, detail: `${dateA} vs ${dateB}` });
  }

  // Grievant name match
  const partyScore = partyNameMatch(a.grievantName, b.grievantName);
  if (partyScore >= 0.8) {
    reasons.push({ reason: 'same_parties', score: partyScore });
  }

  // Need at least 2 signals for a fuzzy match
  if (reasons.length < 2) return null;

  // Weighted composite score
  const weights = { title_similarity: 0.5, timestamp_proximity: 0.3, same_parties: 0.2 };
  let totalWeight = 0;
  let weightedScore = 0;
  for (const r of reasons) {
    const w = weights[r.reason as keyof typeof weights] ?? 0.1;
    weightedScore += r.score * w;
    totalWeight += w;
  }
  const compositeScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  if (compositeScore < 0.7) return null;

  return {
    recordIdA: a.id,
    recordIdB: b.id,
    score: Math.round(compositeScore * 1000) / 1000,
    reasons,
  };
}

// ─── Document Hash Dedup ─────────────────────────────────────────────────────

export function computeDocumentHash(name: string, fileType?: string | null, fileUrl?: string | null): string {
  const canonical = JSON.stringify({
    name: name.toLowerCase().trim(),
    type: (fileType ?? '').toLowerCase(),
    url: (fileUrl ?? '').toLowerCase(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Batch Fuzzy Scan ────────────────────────────────────────────────────────

/**
 * Scans cases from a specific batch for fuzzy duplicates against existing cases.
 * Creates duplicate_groups and data_quality_warnings for matches found.
 */
export async function scanBatchForDuplicates(
  batchId: string,
  organizationId: string,
): Promise<DedupScanResult> {
  const result: DedupScanResult = {
    scanned: 0,
    groupsCreated: 0,
    warningsCreated: 0,
    matches: [],
  };

  try {
    // Get records from this batch that were successfully imported
    const batchRecords = await db
      .select({
        id: ingestionRecords.id,
        resolvedId: ingestionRecords.resolvedId,
        externalId: ingestionRecords.externalId,
      })
      .from(ingestionRecords)
      .where(
        and(
          eq(ingestionRecords.batchId, batchId),
          eq(ingestionRecords.status, 'succeeded'),
        ),
      );

    if (batchRecords.length === 0) return result;

    const resolvedIds = batchRecords
      .map((r) => r.resolvedId)
      .filter((id): id is string => id !== null);

    if (resolvedIds.length === 0) return result;

    // Load the imported grievances
    const importedCases = await db
      .select({
        id: grievances.id,
        title: grievances.title,
        description: grievances.description,
        organizationId: grievances.organizationId,
      })
      .from(grievances)
      .where(inArray(grievances.id, resolvedIds));

    // Load all org grievances NOT in this batch for comparison
    const existingCases = await db
      .select({
        id: grievances.id,
        title: grievances.title,
        description: grievances.description,
        organizationId: grievances.organizationId,
      })
      .from(grievances)
      .where(
        and(
          eq(grievances.organizationId, organizationId),
          sql`${grievances.id} NOT IN (${sql.join(resolvedIds.map(id => sql`${id}::uuid`), sql`, `)})`,
        ),
      );

    result.scanned = importedCases.length;

    // Compare each imported case against existing cases
    for (const imported of importedCases) {
      for (const existing of existingCases) {
        const caseA: CaseRecord = {
          id: imported.id,
          title: imported.title,
          organizationId: imported.organizationId,
        };
        const caseB: CaseRecord = {
          id: existing.id,
          title: existing.title,
          organizationId: existing.organizationId,
        };

        const match = computeCaseSimilarity(caseA, caseB);
        if (match) {
          result.matches.push(match);

          // Create a duplicate group
          const [group] = await db
            .insert(duplicateGroups)
            .values({
              organizationId,
              groupType: 'case',
              status: 'pending',
              autoScore: match.score,
              matchReasons: match.reasons,
            })
            .returning({ id: duplicateGroups.id });

          if (group) {
            // Add both members
            await db.insert(duplicateGroupMembers).values([
              {
                groupId: group.id,
                recordType: 'grievance',
                recordId: existing.id,
                similarityScore: match.score,
                isAnchor: true,
              },
              {
                groupId: group.id,
                recordType: 'grievance',
                recordId: imported.id,
                similarityScore: match.score,
                isAnchor: false,
              },
            ]);

            result.groupsCreated++;
          }

          // Data quality warning on the imported record
          await db.insert(dataQualityWarnings).values({
            organizationId,
            recordType: 'grievance',
            recordId: imported.id,
            batchId,
            severity: match.score >= 0.9 ? 'error' : 'warning',
            category: 'suspicious_duplicate',
            message: `Possible duplicate of case ${existing.id} (score: ${match.score}). Reasons: ${match.reasons.map(r => r.reason).join(', ')}`,
          });
          result.warningsCreated++;
        }
      }
    }

    logger.info('Fuzzy dedup scan complete', {
      batchId,
      scanned: result.scanned,
      groupsCreated: result.groupsCreated,
      warningsCreated: result.warningsCreated,
    });
  } catch (error) {
    logger.error('Fuzzy dedup scan failed', error as Error, { batchId });
    throw error;
  }

  return result;
}
