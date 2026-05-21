/**
 * Workbook narrative engine — deterministic prose for the PDF.
 *
 * NEVER calls an LLM. Every sentence is rule-driven from engine
 * aggregates so the same workbook always produces the same prose.
 */

import type { CartographyResult } from '@/lib/workbook/engines/stewardshipCartography';
import type { ContinuityLandscapeResult } from '@/lib/workbook/engines/continuityMappingEngine';
import type { ContinuityLineageResult } from '@/lib/workbook/engines/continuityLineageEngine';
import type { ContinuityBreakpointResult } from '@/lib/workbook/engines/continuityBreakpointEngine';
import type { ModernizationAlignmentResult } from '@/lib/workbook/engines/modernizationAlignmentEngine';
import type { TransformationRoadmapResult } from '@/lib/workbook/engines/transformationRoadmapEngine';
import type { WorkbookSynthesisResult } from '@/lib/workbook/engines/workbookSynthesisEngine';

export interface WorkbookNarrative {
  density: string;
  posture: string;
  concentration: string;
}

export interface ModuleNarrative {
  opening: string;
  body: string;
  signalsHeading: string;
}

const BAND_LABELS: Record<string, string> = {
  distributed: 'distributed',
  balanced: 'balanced',
  concentrated: 'concentrated',
  fragile: 'fragile',
  critical: 'critical',
};

const BAND_POSTURES: Record<string, string> = {
  distributed:
    'Continuity is broadly distributed. Loss of any single carrier would not interrupt institutional memory.',
  balanced:
    'Continuity is reasonably balanced, with manageable concentration risk in a few load-bearing roles.',
  concentrated:
    'Continuity is concentrated in a small number of carriers. Departure of any one would expose the institution.',
  fragile:
    'Continuity is fragile. Several institution-critical responsibilities are carried by individuals without identified successors.',
  critical:
    'Continuity is in a critical state. The institution would not absorb the loss of one or more current carriers without rupture.',
};

export function buildWorkbookNarrative(cartography: CartographyResult): WorkbookNarrative {
  const { density } = cartography;
  const bandId = density.band.id;
  const label = BAND_LABELS[bandId] ?? bandId;

  const densitySentence =
    density.totalCarriers === 0
      ? 'No memory holders have been recorded yet. The cartography will begin when carriers are added.'
      : `Stewardship density stands at ${density.index.toFixed(2)} across ${density.totalCarriers} mapped carrier${density.totalCarriers === 1 ? '' : 's'} — ${label}.`;

  const posture = BAND_POSTURES[bandId] ?? BAND_POSTURES.balanced;

  let concentration = '';
  if (density.institutionCriticalCount > 0) {
    concentration += `${density.institutionCriticalCount} institution-critical responsibility${density.institutionCriticalCount === 1 ? ' is' : 'ies are'} currently mapped. `;
  }
  if (density.unsuccessedInstitutionCriticalCount > 0) {
    concentration += `${density.unsuccessedInstitutionCriticalCount} of these carry no identified successor. `;
  }
  if (density.loadBearingCount > 0) {
    concentration += `${density.loadBearingCount} load-bearing role${density.loadBearingCount === 1 ? '' : 's'} ${density.loadBearingCount === 1 ? 'is' : 'are'} also mapped`;
    if (density.unsuccessedLoadBearingCount > 0) {
      concentration += `; ${density.unsuccessedLoadBearingCount} without successor.`;
    } else {
      concentration += '.';
    }
  }
  if (concentration.length === 0) {
    concentration = 'No load-bearing or institution-critical concentrations have been recorded.';
  }

  return { density: densitySentence, posture, concentration: concentration.trim() };
}

export function buildLandscapeNarrative(result: ContinuityLandscapeResult): ModuleNarrative {
  return {
    opening: result.preview,
    body: `The continuity landscape is read across five axes — stewardship density, successor readiness, governance coherence, operational surface, and dependency concentration. Overall posture is ${humanize(result.overallPosture)}.`,
    signalsHeading: 'Landscape signals',
  };
}

export function buildLineageNarrative(result: ContinuityLineageResult): ModuleNarrative {
  const s = result.survivability;
  return {
    opening: result.preview,
    body: `Of ${s.total} mapped precedent${s.total === 1 ? '' : 's'}, ${s.living} remain living in current practice, ${s.observed} are observed, ${s.fading} are fading, and ${s.lapsed} are lapsed. Aggregate interpretation drift across governance domains is ${result.aggregateInterpretationDrift.toFixed(2)}.`,
    signalsHeading: 'Lineage signals',
  };
}

export function buildBreakpointNarrative(result: ContinuityBreakpointResult): ModuleNarrative {
  return {
    opening: result.preview,
    body: `Onboarding fragility and reconstruction burden read together: ${result.onboarding.criticalCount} role${result.onboarding.criticalCount === 1 ? ' has' : 's have'} critical onboarding fragility, and aggregate reconstruction burden across breakpoints stands at ${result.reconstructionAggregate.meanScore.toFixed(2)}.`,
    signalsHeading: 'Breakpoint signals',
  };
}

export function buildModernizationNarrative(result: ModernizationAlignmentResult): ModuleNarrative {
  const erodingCount = result.modernizationMatrix.filter((c) => c.posture === 'continuity_eroding').length;
  const safeCount = result.modernizationMatrix.filter((c) => c.posture === 'continuity_safe').length;
  return {
    opening: result.preview,
    body: `Across ${result.modernizationMatrix.length} modernization initiative${result.modernizationMatrix.length === 1 ? '' : 's'}, ${safeCount} are continuity-safe and ${erodingCount} are continuity-eroding. ${result.continuityGaps.length} compound modernization–governance gap${result.continuityGaps.length === 1 ? '' : 's'} ${result.continuityGaps.length === 1 ? 'is' : 'are'} recorded.`,
    signalsHeading: 'Modernization signals',
  };
}

export function buildRoadmapNarrative(result: TransformationRoadmapResult): ModuleNarrative {
  const top = result.stabilization.find((m) => m.priority === 1);
  return {
    opening: result.preview,
    body: `${result.stabilization.length} stabilization move${result.stabilization.length === 1 ? '' : 's'} ${result.stabilization.length === 1 ? 'is' : 'are'} sequenced; ${result.redistribution.targets.length} redistribution target${result.redistribution.targets.length === 1 ? '' : 's'} cross carriers, processes, and lineage. ${top ? `First move: ${top.summary}` : 'No stabilization moves required at this time.'}`,
    signalsHeading: 'Roadmap signals',
  };
}

export function buildSynthesisNarrative(result: WorkbookSynthesisResult): ModuleNarrative {
  return {
    opening: result.profile.reading,
    body: `Composite continuity posture is ${humanize(result.profile.posture)} (index ${result.profile.compositeIndex.toFixed(2)}). Stewardship facet ${result.profile.facets.stewardship.toFixed(2)}, governance ${result.profile.facets.governance.toFixed(2)}, breakpoint ${result.profile.facets.breakpoint.toFixed(2)}, modernization ${result.profile.facets.modernization.toFixed(2)}, lineage ${result.profile.facets.lineage.toFixed(2)}.`,
    signalsHeading: 'Cross-module signals',
  };
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ');
}
