/**
 * CLC Decision Intelligence — Cross-Affiliate Correlation Engine
 *
 * Detects movement-level patterns across affiliates and sectors
 * from governed aggregates. Never exposes individual affiliates
 * unless explicitly permitted — all outputs are aggregate-safe.
 *
 * @module correlation
 */

import type {
  CorrelatedPattern,
  PatternType,
  TimeSeriesPoint,
} from '../contracts/index';
import { computeConfidence, confidenceBandFromScore } from '../confidence/index';
import { computeTrendVelocity, classifySignalPersistence } from '../signals/index';

// ── Input Types (from governed aggregates) ──────────────────────────────────

/** Aggregated sector data consumed from governed query outputs */
export interface SectorAggregate {
  sector: string;
  clauseCount: number;
  precedentCount: number;
  totalCitations: number;
  totalViews: number;
  uniqueOrgs: number;
  topClauseTypes: { clauseType: string; count: number }[];
}

/** Aggregated affiliate-type data consumed from governed query outputs */
export interface AffiliateTypeAggregate {
  organizationType: string;
  affiliateCount: number;
  clausesShared: number;
  precedentsShared: number;
}

/** Time-indexed sector data for temporal correlation */
export interface SectorTimeSeries {
  sector: string;
  series: TimeSeriesPoint[];
}

// ── Correlation Engine ──────────────────────────────────────────────────────

/**
 * Detect cross-affiliate issue clusters.
 *
 * Looks for the same clause type appearing prominently across
 * multiple sectors — indicating a movement-wide issue.
 */
export function detectIssueCluster(sectors: SectorAggregate[]): CorrelatedPattern[] {
  const patterns: CorrelatedPattern[] = [];
  if (sectors.length < 2) return patterns;

  // Build a map of clauseType → sectors where it appears prominently
  const clauseTypeMap = new Map<string, { sector: string; count: number }[]>();

  for (const s of sectors) {
    for (const ct of s.topClauseTypes) {
      const entries = clauseTypeMap.get(ct.clauseType) ?? [];
      entries.push({ sector: s.sector, count: ct.count });
      clauseTypeMap.set(ct.clauseType, entries);
    }
  }

  // A clause type appearing in 3+ sectors is a cross-affiliate cluster
  for (const [clauseType, entries] of clauseTypeMap) {
    if (entries.length >= 3) {
      const totalCount = entries.reduce((s, e) => s + e.count, 0);
      const affectedSectors = entries.map((e) => e.sector);

      const confidence = computeConfidence({
        cohortSize: affectedSectors.length * 3, // rough approximation
        recencyDays: 7,
        signalAgreement: Math.min(1, entries.length / sectors.length),
        sourceCount: entries.length,
        persistenceScore: 0.6,
        missingDataPenalty: 0,
      });

      patterns.push({
        id: `CLUSTER-${clauseType.replace(/\s+/g, '-').toLowerCase()}`,
        patternType: 'cross_affiliate_issue_cluster',
        title: `"${clauseType}" appears across ${entries.length} sectors`,
        summary: `The clause type "${clauseType}" is prominent in ${affectedSectors.join(', ')} with ${totalCount} total instances. This cross-sector concentration suggests a movement-wide bargaining priority.`,
        affectedSectors,
        affectedAffiliateTypes: [],
        confidence: confidence.confidence,
        watchLevel: entries.length >= 5 ? 'high' : entries.length >= 4 ? 'elevated' : 'monitor',
        evidenceRefs: affectedSectors.map((s) => `sector:${s}:clauseType:${clauseType}`),
      });
    }
  }

  return patterns;
}

/**
 * Detect cross-sector shifts.
 *
 * Identifies sectors that are diverging significantly from the
 * movement-wide baseline (average clause/precedent activity).
 */
export function detectSectorShift(sectors: SectorAggregate[]): CorrelatedPattern[] {
  const patterns: CorrelatedPattern[] = [];
  if (sectors.length < 3) return patterns;

  const avgClauses = sectors.reduce((s, x) => s + x.clauseCount, 0) / sectors.length;
  const avgPrecedents = sectors.reduce((s, x) => s + x.precedentCount, 0) / sectors.length;

  for (const s of sectors) {
    // Divergence = combined deviation from both averages
    const clauseDeviation = avgClauses > 0 ? Math.abs(s.clauseCount - avgClauses) / avgClauses : 0;
    const precDeviation = avgPrecedents > 0 ? Math.abs(s.precedentCount - avgPrecedents) / avgPrecedents : 0;
    const combinedDeviation = (clauseDeviation + precDeviation) / 2;

    if (combinedDeviation > 0.8) {
      const direction = s.clauseCount > avgClauses ? 'above' : 'below';
      patterns.push({
        id: `SHIFT-${s.sector.replace(/\s+/g, '-').toLowerCase()}`,
        patternType: 'cross_sector_shift',
        title: `${s.sector} diverges ${direction} movement baseline`,
        summary: `${s.sector} has ${s.clauseCount} clauses and ${s.precedentCount} precedents, deviating ${(combinedDeviation * 100).toFixed(0)}% from the movement average (${avgClauses.toFixed(0)} clauses, ${avgPrecedents.toFixed(0)} precedents). ${direction === 'above' ? 'Unusually active' : 'Under-represented'} sector.`,
        affectedSectors: [s.sector],
        affectedAffiliateTypes: [],
        confidence: Math.min(0.85, 0.5 + combinedDeviation * 0.2),
        watchLevel: combinedDeviation > 1.5 ? 'high' : 'elevated',
        evidenceRefs: [`sector:${s.sector}:clauseCount:${s.clauseCount}`, `sector:${s.sector}:precedentCount:${s.precedentCount}`],
      });
    }
  }

  return patterns;
}

/**
 * Detect precedent concentration patterns.
 *
 * Finds sectors where precedent counts are disproportionately high
 * relative to clause counts — suggesting systemic dispute areas.
 */
export function detectPrecedentConcentration(sectors: SectorAggregate[]): CorrelatedPattern[] {
  const patterns: CorrelatedPattern[] = [];
  if (sectors.length < 2) return patterns;

  const totalClauses = sectors.reduce((s, x) => s + x.clauseCount, 0);
  const totalPrecedents = sectors.reduce((s, x) => s + x.precedentCount, 0);
  const avgRatio = totalClauses > 0 ? totalPrecedents / totalClauses : 0;

  for (const s of sectors) {
    if (s.clauseCount > 0) {
      const ratio = s.precedentCount / s.clauseCount;
      if (ratio > Math.max(avgRatio * 2.5, 2) && s.precedentCount >= 3) {
        patterns.push({
          id: `PREC-CONC-${s.sector.replace(/\s+/g, '-').toLowerCase()}`,
          patternType: 'precedent_concentration',
          title: `${s.sector}: precedent concentration (${ratio.toFixed(1)}x ratio)`,
          summary: `${s.sector} has ${s.precedentCount} precedents against ${s.clauseCount} clauses (${ratio.toFixed(1)}x ratio vs. movement avg of ${avgRatio.toFixed(1)}x). High dispute density relative to bargaining output suggests systemic employer resistance or ambiguous clause language.`,
          affectedSectors: [s.sector],
          affectedAffiliateTypes: [],
          confidence: 0.7,
          watchLevel: ratio > avgRatio * 4 ? 'high' : 'elevated',
          evidenceRefs: [`sector:${s.sector}:precedentRatio:${ratio.toFixed(1)}`],
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect bargaining pressure build-up from time-series data.
 *
 * Uses trend velocity and concentration to identify sectors
 * where bargaining pressure is increasing.
 */
export function detectBargainingPressure(
  sectorTimeSeries: SectorTimeSeries[],
  sectors: SectorAggregate[],
): CorrelatedPattern[] {
  const patterns: CorrelatedPattern[] = [];

  for (const sts of sectorTimeSeries) {
    if (sts.series.length < 3) continue;

    const velocity = computeTrendVelocity(sts.series);
    const { persistenceScore, isPersistent } = classifySignalPersistence(sts.series);

    // Rising velocity + persistent = pressure building
    if (velocity > 1 && isPersistent) {
      const sectorData = sectors.find((s) => s.sector === sts.sector);
      const concentration = sectorData
        ? sectorData.clauseCount / Math.max(sectors.reduce((s, x) => s + x.clauseCount, 0), 1)
        : 0;

      patterns.push({
        id: `BARG-${sts.sector.replace(/\s+/g, '-').toLowerCase()}`,
        patternType: 'bargaining_pressure_signal',
        title: `${sts.sector}: bargaining pressure building`,
        summary: `${sts.sector} shows accelerating clause activity (velocity: ${velocity.toFixed(1)}/period, persistence: ${(persistenceScore * 100).toFixed(0)}%). ${concentration > 0.3 ? 'Combined with high clause concentration, this signals significant pre-bargaining activity.' : 'This trend may indicate upcoming bargaining cycles.'}`,
        affectedSectors: [sts.sector],
        affectedAffiliateTypes: [],
        confidence: Math.min(0.85, 0.5 + persistenceScore * 0.3),
        watchLevel: velocity > 3 && isPersistent ? 'high' : 'elevated',
        evidenceRefs: [
          `sector:${sts.sector}:velocity:${velocity.toFixed(1)}`,
          `sector:${sts.sector}:persistence:${persistenceScore.toFixed(2)}`,
        ],
      });
    }
  }

  return patterns;
}

/**
 * Run all correlation detectors and return combined patterns.
 */
export function detectAllPatterns(
  sectors: SectorAggregate[],
  affiliateTypes: AffiliateTypeAggregate[],
  sectorTimeSeries: SectorTimeSeries[],
): CorrelatedPattern[] {
  return [
    ...detectIssueCluster(sectors),
    ...detectSectorShift(sectors),
    ...detectPrecedentConcentration(sectors),
    ...detectBargainingPressure(sectorTimeSeries, sectors),
  ].sort((a, b) => {
    const watchOrder = { critical: 0, high: 1, elevated: 2, monitor: 3 };
    return (watchOrder[a.watchLevel] - watchOrder[b.watchLevel]) || (b.confidence - a.confidence);
  });
}
