/**
 * CLC Decision Intelligence — Strategic Reasoning / Data Products
 *
 * High-level data products derived from governed aggregates:
 * - MovementRiskPosture: overall movement risk assessment
 * - SectorDivergence: per-sector deviation analysis
 * - BargainingWatch: pre-bargaining alert construct
 * - ExecutiveBriefingCard: card-level executive insights
 *
 * All functions consume already-governed aggregates —
 * they never query data directly.
 *
 * @module reasoning
 */

import type {
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
  CorrelatedPattern,
  DecisionRecommendation,
  TrendClassification,
} from '../contracts/index';
import type { SectorAggregate, SectorTimeSeries } from '../correlation/index';
import { computeConfidence, confidenceBandFromScore } from '../confidence/index';
import { analyzeTrend } from '../signals/index';
import { detectAllPatterns } from '../correlation/index';
import { generateRecommendations } from '../recommendations/index';

// ── Movement Risk Posture ───────────────────────────────────────────────────

type RiskPosture = MovementRiskPosture['posture'];

function classifyPosture(patterns: CorrelatedPattern[]): RiskPosture {
  const highOrCritical = patterns.filter((p) => p.watchLevel === 'high' || p.watchLevel === 'critical');
  if (highOrCritical.length >= 3) return 'heightened';
  if (highOrCritical.length >= 1) return 'vigilant';
  const elevated = patterns.filter((p) => p.watchLevel === 'elevated');
  if (elevated.length >= 3) return 'vigilant';
  if (elevated.length >= 1) return 'steady';
  return 'steady';
}

/**
 * Derive a movement-wide risk posture from detected patterns.
 *
 * Summarizes the overall movement state: how many watch areas,
 * which sectors are rising, and what issue clusters exist.
 */
export function deriveMovementRiskPosture(
  patterns: CorrelatedPattern[],
  sectors: SectorAggregate[],
): MovementRiskPosture {
  const watchAreas = patterns
    .filter((p) => p.watchLevel === 'high' || p.watchLevel === 'critical')
    .map((p) => p.title);

  const risingSectors = patterns
    .filter((p) => p.patternType === 'bargaining_pressure_signal' || p.patternType === 'cross_sector_shift')
    .flatMap((p) => p.affectedSectors)
    .filter((v, i, a) => a.indexOf(v) === i);

  const issueClusters = patterns
    .filter((p) => p.patternType === 'cross_affiliate_issue_cluster')
    .map((p) => p.title);

  const posture = classifyPosture(patterns);

  const postureSummaries: Record<RiskPosture, string> = {
    steady: 'Movement risk is stable. No immediate watch areas require attention.',
    vigilant: `Movement posture is vigilant with ${watchAreas.length} active watch area(s). Monitor for escalation.`,
    heightened: `Movement posture is heightened. ${watchAreas.length} high-priority patterns detected across ${risingSectors.length} sector(s). Executive review recommended.`,
  };

  const confidence = computeConfidence({
    cohortSize: sectors.length * 3,
    recencyDays: 7,
    signalAgreement: patterns.length > 0 ? 0.7 : 0.3,
    sourceCount: sectors.length,
    persistenceScore: 0.6,
    missingDataPenalty: 0,
  });

  return {
    posture,
    watchAreas,
    risingSectors,
    issueClusters,
    summary: postureSummaries[posture],
    confidence: confidence.confidence,
  };
}

// ── Sector Divergence ───────────────────────────────────────────────────────

/**
 * Analyze sector-level divergence from the movement average.
 *
 * Returns a SectorDivergence for each sector, scoring how far
 * its activity deviates from the norm.
 */
export function analyzeSectorDivergence(
  sectors: SectorAggregate[],
  sectorTimeSeries: SectorTimeSeries[],
): SectorDivergence[] {
  if (sectors.length < 2) return [];

  const avgClauses = sectors.reduce((s, x) => s + x.clauseCount, 0) / sectors.length;
  const avgPrecedents = sectors.reduce((s, x) => s + x.precedentCount, 0) / sectors.length;

  const allClauseTypes = new Set<string>();
  for (const s of sectors) {
    for (const ct of s.topClauseTypes) {
      allClauseTypes.add(ct.clauseType);
    }
  }

  return sectors.map((s) => {
    const clauseDeviation = avgClauses > 0 ? Math.abs(s.clauseCount - avgClauses) / avgClauses : 0;
    const precDeviation = avgPrecedents > 0 ? Math.abs(s.precedentCount - avgPrecedents) / avgPrecedents : 0;
    const divergenceScore = (clauseDeviation + precDeviation) / 2;

    const sectorClauseTypes = new Set(s.topClauseTypes.map((ct) => ct.clauseType));
    const uniqueFactors = [...sectorClauseTypes].filter(
      (ct) => {
        const otherSectors = sectors.filter((os) => os.sector !== s.sector);
        return !otherSectors.some((os) => os.topClauseTypes.some((oct) => oct.clauseType === ct));
      },
    );
    const commonFactors = [...sectorClauseTypes].filter((ct) => !uniqueFactors.includes(ct));

    const ts = sectorTimeSeries.find((t) => t.sector === s.sector);
    const trend = ts && ts.series.length >= 2 ? analyzeTrend(ts.series) : null;

    return {
      sector: s.sector,
      divergenceScore,
      uniqueFactors,
      commonFactors,
      velocity: trend?.velocity ?? 0,
      classification: (trend?.classification ?? 'stable') as TrendClassification,
    };
  });
}

// ── Bargaining Watch ────────────────────────────────────────────────────────

/**
 * Generate a bargaining watch alert when pre-bargaining signals
 * are detected across one or more sectors.
 *
 * Returns null if no bargaining pressure is detected.
 */
export function deriveBargainingWatch(
  patterns: CorrelatedPattern[],
  recommendations: DecisionRecommendation[],
): BargainingWatch | null {
  const bargainingPatterns = patterns.filter(
    (p) => p.patternType === 'bargaining_pressure_signal',
  );

  if (bargainingPatterns.length === 0) return null;

  const affectedSectors = bargainingPatterns
    .flatMap((p) => p.affectedSectors)
    .filter((v, i, a) => a.indexOf(v) === i);

  const preparationIndicators = bargainingPatterns.map((p) => p.summary);

  const avgConfidence =
    bargainingPatterns.reduce((s, p) => s + p.confidence, 0) / bargainingPatterns.length;

  const highestWatchPattern = bargainingPatterns.find((p) => p.watchLevel === 'high');
  const relatedRec = recommendations.find(
    (r) => bargainingPatterns.some((p) => r.signalId === p.id),
  );

  return {
    sectors: affectedSectors,
    headline: affectedSectors.length > 1
      ? `Bargaining pressure building across ${affectedSectors.length} sectors`
      : `Bargaining pressure building in ${affectedSectors[0]}`,
    preparationIndicators,
    signalStrength: highestWatchPattern ? 'strong' : 'moderate',
    recommendedAction: relatedRec?.recommendedAction ?? 'monitor',
    confidence: avgConfidence,
    evidenceRefs: bargainingPatterns.flatMap((p) => p.evidenceRefs),
  };
}

// ── Executive Briefing Cards ────────────────────────────────────────────────

/**
 * Convert correlated patterns and recommendations into
 * executive-level briefing cards.
 */
export function generateExecutiveBriefingCards(
  patterns: CorrelatedPattern[],
  recommendations: DecisionRecommendation[],
): ExecutiveBriefingCard[] {
  const categoryMap: Record<string, ExecutiveBriefingCard['category']> = {
    cross_affiliate_issue_cluster: 'risk',
    cross_sector_shift: 'opportunity',
    employer_pattern: 'risk',
    precedent_concentration: 'risk',
    bargaining_pressure_signal: 'trend',
  };

  return patterns.map((p) => {
    const rec = recommendations.find((r) => r.signalId === p.id);

    return {
      id: `BRIEF-${p.id}`,
      category: categoryMap[p.patternType] ?? 'trend',
      headline: p.title,
      significance: p.summary,
      confidence: p.confidence,
      confidenceBand: confidenceBandFromScore(p.confidence),
      recommendedAction: rec?.recommendedAction ?? 'monitor',
      timeframe: rec?.timeframe ?? 'this_quarter',
      watchLevel: p.watchLevel,
      evidenceRefs: p.evidenceRefs,
    };
  });
}

// ── Full Pipeline ───────────────────────────────────────────────────────────

export interface DecisionIntelligenceOutput {
  riskPosture: MovementRiskPosture;
  sectorDivergence: SectorDivergence[];
  bargainingWatch: BargainingWatch | null;
  patterns: CorrelatedPattern[];
  recommendations: DecisionRecommendation[];
  briefingCards: ExecutiveBriefingCard[];
}

/**
 * Run the full decision intelligence pipeline.
 *
 * Takes governed aggregates as input, runs correlation detection,
 * recommendation generation, and produces all data products.
 */
export function runDecisionIntelligencePipeline(
  sectors: SectorAggregate[],
  affiliateTypes: { organizationType: string; affiliateCount: number; clausesShared: number; precedentsShared: number }[],
  sectorTimeSeries: SectorTimeSeries[],
): DecisionIntelligenceOutput {
  const patterns = detectAllPatterns(sectors, affiliateTypes, sectorTimeSeries);
  const recommendations = generateRecommendations(patterns);
  const riskPosture = deriveMovementRiskPosture(patterns, sectors);
  const sectorDivergence = analyzeSectorDivergence(sectors, sectorTimeSeries);
  const bargainingWatch = deriveBargainingWatch(patterns, recommendations);
  const briefingCards = generateExecutiveBriefingCards(patterns, recommendations);

  return {
    riskPosture,
    sectorDivergence,
    bargainingWatch,
    patterns,
    recommendations,
    briefingCards,
  };
}
