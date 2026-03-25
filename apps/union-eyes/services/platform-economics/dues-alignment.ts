/**
 * Dues Alignment Layer (Read-Only)
 * 
 * Layer 4: Ingests read-only signals from the member dues domain
 * (member counts, remittance summaries, employer contributions)
 * to validate allocation inputs and enrich reporting.
 * 
 * DOES NOT modify dues systems, intercept payroll, or collect dues.
 * 
 * @domain platform-economics
 * @layer 4 — Dues Alignment
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface OrgDuesSnapshot {
  organizationId: string;
  totalMembers: number;
  activeMembers: number;
  totalRemittancesCad: string;
  avgDuesPerMember: string;
  employerCount: number;
  arrearsCount: number;
  arrearsAmountCad: string;
  snapshotDate: string;
}

export interface LocalDuesSnapshot {
  localId: string;
  memberCount: number;
  activeMembers: number;
  remittanceTotalCad: string;
  arrearsCount: number;
}

export interface DuesAlignmentReport {
  organizationId: string;
  period: string;
  orgSnapshot: OrgDuesSnapshot;
  localSnapshots: LocalDuesSnapshot[];
  anomalies: DuesAnomaly[];
}

export interface DuesAnomaly {
  type: 'member_count_mismatch' | 'remittance_gap' | 'arrears_spike' | 'employer_missing';
  localId?: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  details: Record<string, unknown>;
}

// ============================================================================
// Read-Only Ingestion
// ============================================================================

/**
 * Gather org-level dues snapshot from existing dues domain tables.
 * This is read-only — no mutations.
 */
export async function getOrgDuesSnapshot(
  organizationId: string,
): Promise<OrgDuesSnapshot> {
  // Member count from member_dues_ledger
  const [memberResult] = await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id) AS total_members,
      COUNT(DISTINCT CASE WHEN status = 'posted' THEN user_id END) AS active_members
    FROM member_dues_ledger
    WHERE organization_id = ${organizationId}
  `);

  // Remittance totals
  const [remittanceResult] = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_amount), 0) AS total_remittances,
      COUNT(DISTINCT employer_id) AS employer_count
    FROM employer_remittances
    WHERE organization_id = ${organizationId}
      AND processing_status = 'completed'
  `);

  // Arrears
  const [arrearsResult] = await db.execute(sql`
    SELECT
      COUNT(*) AS arrears_count,
      COALESCE(SUM(total_owed), 0) AS arrears_amount
    FROM member_arrears
    WHERE organization_id = ${organizationId}
      AND arrears_status != 'current'
  `);

  const totalMembers = Number(memberResult?.total_members ?? 0);
  const totalRemittances = String(remittanceResult?.total_remittances ?? '0');
  const avgDues = totalMembers > 0
    ? (parseFloat(totalRemittances) / totalMembers).toFixed(2)
    : '0.00';

  return {
    organizationId,
    totalMembers,
    activeMembers: Number(memberResult?.active_members ?? 0),
    totalRemittancesCad: totalRemittances,
    avgDuesPerMember: avgDues,
    employerCount: Number(remittanceResult?.employer_count ?? 0),
    arrearsCount: Number(arrearsResult?.arrears_count ?? 0),
    arrearsAmountCad: String(arrearsResult?.arrears_amount ?? '0'),
    snapshotDate: new Date().toISOString(),
  };
}

/**
 * Gather per-local dues snapshots for allocation basis validation.
 */
export async function getLocalDuesSnapshots(
  organizationId: string,
): Promise<LocalDuesSnapshot[]> {
  const rows = await db.execute(sql`
    SELECT
      o.id AS local_id,
      COALESCE(m.member_count, 0) AS member_count,
      COALESCE(m.active_members, 0) AS active_members,
      COALESCE(r.remittance_total, 0) AS remittance_total,
      COALESCE(a.arrears_count, 0) AS arrears_count
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT user_id) AS member_count,
        COUNT(DISTINCT CASE WHEN status = 'posted' THEN user_id END) AS active_members
      FROM member_dues_ledger
      WHERE organization_id = o.id
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(total_amount), 0) AS remittance_total
      FROM employer_remittances
      WHERE organization_id = o.id AND processing_status = 'completed'
    ) r ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS arrears_count
      FROM member_arrears
      WHERE organization_id = o.id AND arrears_status != 'current'
    ) a ON true
    WHERE o.parent_organization_id = ${organizationId}
      OR o.id = ${organizationId}
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    localId: String(row.local_id),
    memberCount: Number(row.member_count),
    activeMembers: Number(row.active_members),
    remittanceTotalCad: String(row.remittance_total ?? '0'),
    arrearsCount: Number(row.arrears_count),
  }));
}

/**
 * Detect anomalies between dues data and allocation basis.
 */
export function detectAnomalies(
  orgSnapshot: OrgDuesSnapshot,
  localSnapshots: LocalDuesSnapshot[],
): DuesAnomaly[] {
  const anomalies: DuesAnomaly[] = [];

  // Check member count consistency
  const localTotal = localSnapshots.reduce((s, l) => s + l.memberCount, 0);
  if (localTotal !== orgSnapshot.totalMembers && orgSnapshot.totalMembers > 0) {
    anomalies.push({
      type: 'member_count_mismatch',
      description: `Local member sum (${localTotal}) differs from org total (${orgSnapshot.totalMembers})`,
      severity: 'warning',
      details: { localTotal, orgTotal: orgSnapshot.totalMembers },
    });
  }

  // Arrears spike detection (>10% in arrears)
  if (orgSnapshot.totalMembers > 0) {
    const arrearsRate = orgSnapshot.arrearsCount / orgSnapshot.totalMembers;
    if (arrearsRate > 0.10) {
      anomalies.push({
        type: 'arrears_spike',
        description: `${(arrearsRate * 100).toFixed(1)}% members in arrears`,
        severity: arrearsRate > 0.25 ? 'critical' : 'warning',
        details: { arrearsCount: orgSnapshot.arrearsCount, totalMembers: orgSnapshot.totalMembers },
      });
    }
  }

  // Employer missing check
  if (orgSnapshot.employerCount === 0 && orgSnapshot.totalMembers > 50) {
    anomalies.push({
      type: 'employer_missing',
      description: 'No completed employer remittances on record',
      severity: 'warning',
      details: {},
    });
  }

  // Per-local remittance gaps
  for (const local of localSnapshots) {
    if (local.memberCount > 0 && parseFloat(local.remittanceTotalCad) === 0) {
      anomalies.push({
        type: 'remittance_gap',
        localId: local.localId,
        description: `Local ${local.localId} has ${local.memberCount} members but zero remittances`,
        severity: 'warning',
        details: { memberCount: local.memberCount },
      });
    }
  }

  return anomalies;
}

/**
 * Generate a full dues alignment report for a billing period.
 */
export async function generateDuesAlignmentReport(
  organizationId: string,
  periodLabel: string,
): Promise<DuesAlignmentReport> {
  const orgSnapshot = await getOrgDuesSnapshot(organizationId);
  const localSnapshots = await getLocalDuesSnapshots(organizationId);
  const anomalies = detectAnomalies(orgSnapshot, localSnapshots);

  return {
    organizationId,
    period: periodLabel,
    orgSnapshot,
    localSnapshots,
    anomalies,
  };
}
