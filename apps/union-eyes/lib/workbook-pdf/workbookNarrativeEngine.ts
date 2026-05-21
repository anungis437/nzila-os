/**
 * Workbook narrative engine \u2014 deterministic prose for the PDF.
 *
 * NEVER calls an LLM. Every sentence is rule-driven from cartography
 * aggregates so the same workbook always produces the same prose.
 */

import type { CartographyResult } from '@/lib/workbook/engines/stewardshipCartography';

export interface WorkbookNarrative {
  density: string;
  posture: string;
  concentration: string;
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
  const label = BAND_LABELS[density.band] ?? density.band;

  const densitySentence =
    density.totalCarriers === 0
      ? 'No memory holders have been recorded yet. The cartography will begin when carriers are added.'
      : `Stewardship density stands at ${density.index.toFixed(2)} across ${density.totalCarriers} mapped carrier${density.totalCarriers === 1 ? '' : 's'} \u2014 ${label}.`;

  const posture = BAND_POSTURES[density.band] ?? BAND_POSTURES.balanced;

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
