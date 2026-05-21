/**
 * ARTIFACT TYPE: Engine Barrel
 * DOCTRINE_VERSION: 1.0.0
 *
 * Workbook engines. One per Workbook module (six). Plus stewardshipCartography
 * which is the named cartography engine consumed by the Memory Holders
 * module (the vertical slice).
 *
 * Self-Guided Edition implements stewardshipCartography fully. The other
 * six are typed scaffolds: shape, contract, and a passthrough seed
 * implementation. Facilitated Edition unlocks them.
 */

export * as stewardshipCartography from './stewardshipCartography';
export * as continuityMappingEngine from './continuityMappingEngine';
export * as governanceEntropyEngine from './governanceEntropyEngine';
export * as continuityLineageEngine from './continuityLineageEngine';
export * as continuityBreakpointEngine from './continuityBreakpointEngine';
export * as modernizationAlignmentEngine from './modernizationAlignmentEngine';
export * as transformationRoadmapEngine from './transformationRoadmapEngine';
