/**
 * Proof enrichment — augments Deal Engine account health data
 * with real evidence pack counts from the evidence_packs table.
 */
import "server-only";

import { db } from "@nzila/db";
import { evidencePacks } from "@nzila/db";
import { eq, sql, count } from "drizzle-orm";
import type { AccountHealth } from "@nzila/deal-engine/types";

interface EvidencePackSummary {
  orgId: string;
  total: number;
  sealed: number;
  verified: number;
}

/**
 * Fetches evidence pack counts grouped by org.
 */
async function getEvidencePackCountsByOrg(): Promise<Map<string, EvidencePackSummary>> {
  try {
    const rows = await db
      .select({
        orgId: evidencePacks.orgId,
        total: count(),
        sealed: sql<number>`count(*) filter (where ${evidencePacks.status} = 'sealed')`,
        verified: sql<number>`count(*) filter (where ${evidencePacks.status} = 'verified')`,
      })
      .from(evidencePacks)
      .groupBy(evidencePacks.orgId);

    const map = new Map<string, EvidencePackSummary>();
    for (const row of rows) {
      map.set(row.orgId, {
        orgId: row.orgId,
        total: Number(row.total),
        sealed: Number(row.sealed),
        verified: Number(row.verified),
      });
    }
    return map;
  } catch (err) {
    console.error("[ADAPTER:proof] getEvidencePackCountsByOrg failed", err);
    return new Map();
  }
}

/**
 * Enrich account health records with real evidence pack counts.
 * Falls back to existing values when DB data is unavailable.
 */
export async function enrichWithProofData(
  records: AccountHealth[],
): Promise<AccountHealth[]> {
  const packCounts = await getEvidencePackCountsByOrg();
  if (packCounts.size === 0) return records;

  return records.map((record) => {
    // Try to match account to org by accountId
    const summary = packCounts.get(record.accountId);
    if (!summary) return record;

    const verifiedOrSealed = summary.verified + summary.sealed;
    let proofStatus: AccountHealth["proofStatus"] = record.proofStatus;
    if (verifiedOrSealed > 0) {
      proofStatus = "ready";
    } else if (summary.total > 0) {
      proofStatus = "in_progress";
    }

    let governancePosture: AccountHealth["governancePosture"] = record.governancePosture;
    if (summary.verified > 0) {
      governancePosture = "compliant";
    } else if (summary.total > 0 && governancePosture === "non_compliant") {
      governancePosture = "partial";
    }

    return {
      ...record,
      evidencePacksAvailable: summary.total,
      proofStatus,
      governancePosture,
    };
  });
}
