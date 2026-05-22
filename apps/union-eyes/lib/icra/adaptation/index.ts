/**
 * Barrel export for the OCRA adaptation surface. Downstream code should
 * import from `@/lib/icra/adaptation` (or relative equivalent) rather than
 * reach into individual modules — this keeps the surface auditable.
 */

export * from './types';
export * from './orgComplexityModel';
export * from './orgContextClassifier';
export * from './institutionalProfileLens';
export * from './routingTypes';
export * from './questionEligibilityRules';
export * from './questionPriorityModel';
export * from './questionRoutingEngine';
export * from './domainWeightingModel';
export * from './contextualScoreNormalizer';
export * from './adaptiveScoringModel';
export * from './adaptivePassageLibrary';
export * from './adaptiveNarrativeEngine';
export * from './facilitatorAdaptationGuide';
export * from './adaptiveTelemetry';
