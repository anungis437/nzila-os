/**
 * Workbook module result loader.
 *
 * Translates current workbook DB state into engine-ready inputs and
 * runs every engine whose inputs can be sourced authoritatively from
 * the schema today. Engines whose inputs require facilitator-captured
 * forms that do not yet exist (entropy interpretation matrix,
 * structured breakpoint reconstruction, modernization initiative
 * surveys, transformation stabilization plans) are intentionally
 * skipped so the PDF falls back to the Reserved for Facilitated
 * Edition note rather than fabricating data.
 *
 * Anti-surveillance: only structural fields cross the engine boundary.
 * Holder names, lineage prose, and notes never leave the row.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  workbookGovernanceLineageEntries,
  workbookMemoryHolders,
} from '@/db/schema/workbook-schema';
import {
  runStewardshipCartography,
  type CartographyHolderInput,
  type CartographyResult,
} from '@/lib/workbook/engines/stewardshipCartography';
import {
  runContinuityMapping,
  type ContinuityLandscapeResult,
} from '@/lib/workbook/engines/continuityMappingEngine';
import {
  runContinuityLineage,
  type ContinuityLineageResult,
} from '@/lib/workbook/engines/continuityLineageEngine';
import { runWorkbookSynthesis } from '@/lib/workbook/engines/workbookSynthesisEngine';
import { runGovernanceRecovery } from '@/lib/workbook/engines/governanceRecoveryEngine';
import type { PrecedentInput, PrecedentEra } from '@/lib/workbook/engines/precedentContinuityMapper';
import type { WorkbookModuleResults } from './GovernanceEntropyWorkbookTemplate';

export interface LoadedWorkbookContext {
  cartography: CartographyResult;
  holders: ReadonlyArray<{
    role: string;
    displayName: string | null;
    responsibility: string;
    tenureBand: string | null;
    criticality: string | null;
    successorIdentified: boolean;
  }>;
  modules: WorkbookModuleResults;
}

/**
 * Load every module result the engines can produce today, plus the
 * cartography + raw holder rows the existing Chapter 01 expects.
 */
export async function loadWorkbookContext(input: {
  workbookId: string;
  status: 'facilitated' | 'self-guided';
}): Promise<LoadedWorkbookContext> {
  const holderRows = await loadHolderRows(input.workbookId);
  const cartographyHolders: CartographyHolderInput[] = holderRows.map((h, idx) => ({
    id: String(idx),
    role: h.role,
    criticality: h.criticality as CartographyHolderInput['criticality'],
    tenureBand: h.tenureBand as CartographyHolderInput['tenureBand'],
    successorIdentified: h.successorIdentified,
  }));

  const cartography = runStewardshipCartography(cartographyHolders);
  const lineageRows = await loadLineageRows(input.workbookId);

  const modules: WorkbookModuleResults = {};

  // Landscape: always derivable from holders.
  const landscape = runContinuityMapping({
    workbookId: input.workbookId,
    holders: cartographyHolders,
  });
  modules.landscape = landscape;

  // Lineage: only when the institution has recorded at least one precedent.
  let lineage: ContinuityLineageResult | undefined;
  if (lineageRows.length > 0) {
    lineage = runContinuityLineage({
      workbookId: input.workbookId,
      precedents: lineageRows.map(toPrecedentInput),
      // governanceDomains require an interpretation-matrix capture form
      // that is not yet in schema. Pass empty until that form exists.
      governanceDomains: [],
    });
    modules.lineage = lineage;
  }

  // Governance recovery (Product 3 / Stabilization): composable from lineage
  // rows alone. Stewardship redistribution remains reserved for the
  // facilitated edition because its carrier/process inputs require a
  // facilitator-captured form that does not exist in schema yet.
  if (lineage) {
    modules.governanceRecovery = runGovernanceRecovery({
      status: input.status,
      lineage: {
        workbookId: input.workbookId,
        precedents: lineageRows.map(toPrecedentInput),
        governanceDomains: [],
      },
      governanceRatificationCommitted: false,
    });
  }

  // Synthesis: only meaningful when at least landscape + lineage are present,
  // because the OCI Operational Profile needs more than a single facet to
  // resolve a defensible composite posture.
  if (landscape && lineage) {
    modules.synthesis = runWorkbookSynthesis({
      status: input.status,
      aggregates: {
        densityIndex: cartography.density.index,
        onboardingCriticalCount: 0,
        breakpointCriticalCount: 0,
        modernizationErodingCount: 0,
        lineageLapsedOrFadingCount:
          lineage.survivability.lapsed + lineage.survivability.fading,
        governanceDriftAggregate: lineage.aggregateInterpretationDrift,
        reconstructionBurdenMean: 0,
        mappingComplete: true,
        stabilizationRatified: false,
        governanceReviewPresent: false,
        landscapePosture: normalizeLandscapePosture(landscape.overallPosture),
      },
      profileInput: {
        densityIndex: cartography.density.index,
        governanceDriftAggregate: lineage.aggregateInterpretationDrift,
        breakpointCriticalCount: 0,
        modernizationErodingCount: 0,
        lineageLapsedOrFadingCount:
          lineage.survivability.lapsed + lineage.survivability.fading,
        stabilizationCandidateCount: 0,
      },
    });
  }

  return { cartography, holders: holderRows, modules };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal projections
// ─────────────────────────────────────────────────────────────────────────────

async function loadHolderRows(workbookId: string) {
  return db
    .select({
      role: workbookMemoryHolders.role,
      displayName: workbookMemoryHolders.displayName,
      responsibility: workbookMemoryHolders.responsibility,
      tenureBand: workbookMemoryHolders.tenureBand,
      criticality: workbookMemoryHolders.criticality,
      successorIdentified: workbookMemoryHolders.successorIdentified,
    })
    .from(workbookMemoryHolders)
    .where(eq(workbookMemoryHolders.workbookId, workbookId))
    .orderBy(workbookMemoryHolders.capturedAt);
}

async function loadLineageRows(workbookId: string) {
  return db
    .select({
      lineageId: workbookGovernanceLineageEntries.lineageId,
      decisionDate: workbookGovernanceLineageEntries.decisionDate,
      summary: workbookGovernanceLineageEntries.summary,
      interpretationNotes: workbookGovernanceLineageEntries.interpretationNotes,
    })
    .from(workbookGovernanceLineageEntries)
    .where(eq(workbookGovernanceLineageEntries.workbookId, workbookId));
}

function toPrecedentInput(row: {
  lineageId: string;
  decisionDate: Date | null;
  summary: string;
  interpretationNotes: string | null;
}): PrecedentInput {
  return {
    id: row.lineageId,
    subject: row.summary,
    era: classifyEra(row.decisionDate),
    reaffirmationCount: 0,
    referencedInPractice: row.interpretationNotes !== null,
    successorBriefed: false,
  };
}

function classifyEra(decisionDate: Date | null): PrecedentEra {
  if (!decisionDate) return 'mid_term';
  const yearsAgo = (Date.now() - decisionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (yearsAgo < 3) return 'recent';
  if (yearsAgo < 10) return 'mid_term';
  if (yearsAgo < 25) return 'long_term';
  return 'founding';
}

function normalizeLandscapePosture(
  posture: ContinuityLandscapeResult['overallPosture'],
): 'distributed' | 'observed' | 'concentrated' | 'fragile' | 'critical' {
  switch (posture) {
    case 'critical':
    case 'fragile':
    case 'concentrated':
    case 'observed':
    case 'distributed':
      return posture;
    default:
      return 'observed';
  }
}
