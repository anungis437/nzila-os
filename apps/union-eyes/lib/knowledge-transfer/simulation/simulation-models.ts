/**
 * Continuity Impact Simulation Models
 *
 * Data structures for simulating organizational continuity degradation
 * under various scenarios (retirement, departure, vendor loss, etc.).
 *
 * All models remain organizationally scoped — understanding organizational
 * resilience, not evaluating individuals.
 */

export type SimulationType =
  | 'retirement'
  | 'sudden_departure'
  | 'vendor_loss'
  | 'governance_knowledge_loss'
  | 'undocumented_process_loss'
  | 'procedural_fragmentation'
  | 'bottleneck_collapse';

export interface SimulationScenario {
  /** Type of continuity failure being simulated */
  simulationType: SimulationType;
  /** Node/nodes affected by this scenario */
  affectedNodeIds: string[];
  /** For role-based scenarios: the union role(s) affected */
  affectedRoles?: string[];
  /** Estimated timeline for loss/departure (weeks into future) */
  timelineWeeks?: number;
  /** Any additional context */
  context?: string;
}

export interface SimulatedContinuityImpact {
  /** Domain (expertise area, system, vendor, governance) */
  domain: string;
  /** Severity of impact: low | medium | high | critical */
  impactSeverity: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated percentage degradation of operational capability (0-100) */
  degradationPercentage: number;
  /** Time until impact becomes critical (weeks) */
  timeToExposure: number;
  /** Whether manual workarounds exist */
  hasWorkarounds: boolean;
  /** Workaround complexity: trivial | simple | moderate | complex | impossible */
  workaroundComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'impossible';
}

export interface ContinuityDegradationTimeline {
  /** Weeks from scenario start */
  week: number;
  /** Overall continuity health score (0-100, higher is better) */
  healthScore: number;
  /** Accumulated operational domains affected */
  domainsAtRisk: number;
  /** Knowledge loss acceleration factor (1.0 = baseline) */
  accelerationFactor: number;
  /** Specific critical events at this week (if any) */
  criticalEvents: string[];
}

export interface ResilienceWeaknessIndicator {
  /** Weakness type: single_source | undocumented | vendor_dependency | governance_gap | redundancy_failure */
  weaknessType: 'single_source' | 'undocumented' | 'vendor_dependency' | 'governance_gap' | 'redundancy_failure';
  /** What operational area this weakness affects */
  affectedArea: string;
  /** How critical this weakness is */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether this weakness is directly triggered by the simulation */
  isExacerbated: boolean;
  /** Mitigation strategy */
  mitigation: string;
}

export interface ContinuitySimulationResult {
  organizationId: string;
  generatedAt: string;
  scenario: SimulationScenario;
  /** Pre-simulation continuity baseline score */
  baselineContinuityScore: number;
  /** Post-simulation continuity score (immediate impact) */
  immediateImpactScore: number;
  /** Estimated continuity score after 12 weeks */
  twelveWeekProjection: number;
  /** Severity of overall impact: low | medium | high | critical */
  overallImpactSeverity: 'low' | 'medium' | 'high' | 'critical';
  /** Per-domain continuity impacts */
  domainImpacts: SimulatedContinuityImpact[];
  /** Timeline of how impact unfolds over time */
  degradationTimeline: ContinuityDegradationTimeline[];
  /** Resilience weaknesses exposed or exacerbated by this scenario */
  exacerbatedWeaknesses: ResilienceWeaknessIndicator[];
  /** Recommended immediate actions */
  immediateActions: string[];
  /** Recommended 30-day mitigation plan */
  mitigation30Day: string[];
  /** Recommended 90-day remediation plan */
  remediation90Day: string[];
  /** Estimated cost of recovery (qualitative: low | medium | high | extreme) */
  recoveryEffortEstimate: 'low' | 'medium' | 'high' | 'extreme';
  /** Probability organization could recover from this scenario without external help */
  autonomousRecoveryProbability: number; // 0-100
  /** Number of governance bodies that would be affected */
  governanceBodiesAffected: number;
  /** Whether any compliance obligations would be immediately at risk */
  complianceRiskCreated: boolean;
  /** Human-readable executive summary of simulation results */
  executiveSummary: string;
}

export interface SimulationComparison {
  organizationId: string;
  generatedAt: string;
  scenarios: ContinuitySimulationResult[];
  /** Scenario that poses least risk */
  bestCase: SimulationScenario;
  /** Scenario that poses greatest risk */
  worstCase: SimulationScenario;
  /** Common vulnerabilities across all scenarios */
  commonVulnerabilities: string[];
  /** Resilience recommendations that address multiple scenarios */
  crossScenarioMitigations: string[];
}

/**
 * Compute continuity degradation for a domain given:
 * - Loss of knowledge/system/process
 * - Current documentation state
 * - Existing redundancy
 * - Governance dependencies
 */
export function computeDomainDegradation(
  documentationQuality: 'minimal' | 'partial' | 'good',
  redundancyLevel: 'none' | 'weak' | 'moderate' | 'strong',
  isGovernanceCritical: boolean,
  affectedRoleCount: number,
  hasVendorDependency: boolean,
): SimulatedContinuityImpact {
  let degradation = 0;
  let impactSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let timeToExposure = 8; // weeks

  // Documentation quality affects degradation significantly
  if (documentationQuality === 'minimal') {
    degradation += 60;
    timeToExposure = 2; // Minimal docs = immediate exposure
  } else if (documentationQuality === 'partial') {
    degradation += 40;
    timeToExposure = 4;
  } else {
    degradation += 20;
    timeToExposure = 8;
  }

  // Redundancy level offsets degradation
  if (redundancyLevel === 'strong') {
    degradation -= 25;
    timeToExposure += 4;
  } else if (redundancyLevel === 'moderate') {
    degradation -= 10;
    timeToExposure += 2;
  } else if (redundancyLevel === 'weak') {
    // minimal reduction
  } else {
    // no redundancy
    degradation += 15;
  }

  // Governance criticality amplifies impact
  if (isGovernanceCritical) {
    degradation += 20;
    timeToExposure = Math.max(timeToExposure - 2, 1);
  }

  // Multiple roles affected = broader impact
  degradation += Math.min(affectedRoleCount * 5, 15);

  // Vendor dependencies create external coordination delays
  if (hasVendorDependency) {
    degradation += 10;
    timeToExposure += 2;
  }

  degradation = Math.min(degradation, 100);

  // Determine severity
  if (degradation >= 80) impactSeverity = 'critical';
  else if (degradation >= 60) impactSeverity = 'high';
  else if (degradation >= 40) impactSeverity = 'medium';

  // Determine workarounds
  const hasWorkarounds = documentationQuality !== 'minimal' || redundancyLevel !== 'none';
  let complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'impossible' = 'moderate';
  if (!hasWorkarounds) {
    complexity = 'impossible';
  } else if (documentationQuality === 'good' && redundancyLevel === 'strong') {
    complexity = 'trivial';
  } else if (documentationQuality === 'good' || redundancyLevel === 'moderate') {
    complexity = 'simple';
  } else if (hasVendorDependency) {
    complexity = 'complex';
  }

  return {
    domain: 'operational_domain',
    impactSeverity,
    degradationPercentage: degradation,
    timeToExposure,
    hasWorkarounds,
    workaroundComplexity: complexity,
  };
}

/**
 * Compute timeline of how continuity degrades over weeks following a loss event.
 * Models acceleration (initial shock + cascading failures).
 */
export function buildDegradationTimeline(
  initialImpactScore: number,
  scenarioType: SimulationType,
  exacerbatedWeaknesses: number,
): ContinuityDegradationTimeline[] {
  const timeline: ContinuityDegradationTimeline[] = [];
  let healthScore = 100 - initialImpactScore;

  // Different scenarios have different degradation curves
  const baseAcceleration =
    scenarioType === 'sudden_departure' ? 1.3 :
    scenarioType === 'vendor_loss' ? 1.5 :
    scenarioType === 'bottleneck_collapse' ? 2.0 :
    1.0;

  for (let week = 0; week <= 12; week++) {
    // Acceleration factor increases as dependencies unravel
    const accelerationFactor = baseAcceleration + (week * 0.1) + (exacerbatedWeaknesses * 0.05);

    // Health score degrades week by week
    healthScore = Math.max(0, healthScore - (initialImpactScore * 0.05 * accelerationFactor));

    // Identify critical events at certain milestones
    const criticalEvents: string[] = [];
    if (week === 1) {
      criticalEvents.push(`Initial impact: ${initialImpactScore}% operational disruption`);
    }
    if (week === 2 && exacerbatedWeaknesses > 2) {
      criticalEvents.push('Cascading failures begin affecting downstream processes');
    }
    if (week === 4) {
      criticalEvents.push('Documentation gaps become critical');
    }
    if (healthScore < 30 && timeline[week - 1]?.healthScore >= 30) {
      criticalEvents.push('CRITICAL: Organization near continuity collapse threshold');
    }

    timeline.push({
      week,
      healthScore: Math.round(healthScore),
      domainsAtRisk: Math.ceil((100 - healthScore) / 15),
      accelerationFactor: Math.round(accelerationFactor * 100) / 100,
      criticalEvents,
    });
  }

  return timeline;
}

/**
 * Estimate probability of autonomous recovery without external intervention.
 */
export function estimateAutonomousRecoveryProbability(
  baselineContinuityScore: number,
  immediateImpactScore: number,
  documentationQuality: 'minimal' | 'partial' | 'good',
  redundancyLevel: 'none' | 'weak' | 'moderate' | 'strong',
): number {
  let probability = 50; // Base 50%

  // Current continuity health helps
  probability += Math.min(baselineContinuityScore / 2, 20);

  // Documentation quality is critical
  if (documentationQuality === 'good') {
    probability += 20;
  } else if (documentationQuality === 'partial') {
    probability += 5;
  }

  // Redundancy helps recovery
  if (redundancyLevel === 'strong') {
    probability += 15;
  } else if (redundancyLevel === 'moderate') {
    probability += 8;
  }

  // Impact severity reduces recovery probability
  if (immediateImpactScore > 80) {
    probability -= 30;
  } else if (immediateImpactScore > 60) {
    probability -= 15;
  }

  return Math.max(0, Math.min(probability, 100));
}
