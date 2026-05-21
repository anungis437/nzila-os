/**
 * ARTIFACT TYPE: Engine Barrel
 * DOCTRINE_VERSION: 2.0.0
 *
 * Workbook engines (Governance Entropy Workbook™). Six module engines,
 * plus the stewardshipCartography engine consumed by the Memory Holders
 * module, plus a cross-module synthesis engine and the internal helpers
 * each module composes.
 */

// Module engines.
export * as stewardshipCartography from './stewardshipCartography';
export * as continuityMappingEngine from './continuityMappingEngine';
export * as governanceEntropyEngine from './governanceEntropyEngine';
export * as continuityLineageEngine from './continuityLineageEngine';
export * as continuityBreakpointEngine from './continuityBreakpointEngine';
export * as modernizationAlignmentEngine from './modernizationAlignmentEngine';
export * as transformationRoadmapEngine from './transformationRoadmapEngine';

// Cross-module synthesis.
export * as workbookSynthesisEngine from './workbookSynthesisEngine';
export * as crossModuleContinuitySignals from './crossModuleContinuitySignals';
export * as ociOperationalProfile from './ociOperationalProfile';

// Helpers — Continuity Landscape.
export * as continuityTopologyMapper from './continuityTopologyMapper';
export * as operationalSurfaceAnalysis from './operationalSurfaceAnalysis';
export * as continuityDependencyGraph from './continuityDependencyGraph';

// Helpers — Governance Lineage.
export * as precedentContinuityMapper from './precedentContinuityMapper';
export * as governanceInterpretationMatrix from './governanceInterpretationMatrix';
export * as institutionalEvolutionTracker from './institutionalEvolutionTracker';

// Helpers — Continuity Breakpoint.
export * as reconstructionBurdenAnalyzer from './reconstructionBurdenAnalyzer';
export * as onboardingFragilityAnalysis from './onboardingFragilityAnalysis';
export * as continuityCollapsePredictor from './continuityCollapsePredictor';

// Helpers — Modernization Alignment.
export * as continuitySafeModernization from './continuitySafeModernization';
export * as governanceModernizationReview from './governanceModernizationReview';
export * as operationalTraceabilityReview from './operationalTraceabilityReview';

// Helpers — Transformation Roadmap.
export * as stabilizationPriorityEngine from './stabilizationPriorityEngine';
export * as continuityRedistributionPlanner from './continuityRedistributionPlanner';
export * as ociMaturityPathway from './ociMaturityPathway';
