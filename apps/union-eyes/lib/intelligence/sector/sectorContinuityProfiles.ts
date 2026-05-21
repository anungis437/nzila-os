/**
 * ARTIFACT TYPE: Sector Continuity Profiles
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Sector continuity profiles.
 *
 * Reviewer-curated, doctrinally-shaped profiles describing the institutional
 * continuity character of each recognised sector. These profiles are NOT
 * benchmarks. They are written to help a reviewer interpret a sector baseline
 * envelope inside the appropriate institutional context.
 *
 * Profiles never carry numeric performance targets, ranking thresholds, or
 * peer-relative positions. They are descriptive, not prescriptive.
 */

import type { IntelligenceSector } from '../contracts/intelligenceContracts';

export const SECTOR_CONTINUITY_PROFILES_VERSION = '1.0.0' as const;

export interface SectorContinuityProfile {
  readonly sector: IntelligenceSector;
  readonly continuityCharacter: string;
  readonly continuityFragilityNote: string;
  readonly stewardshipPattern: string;
  readonly onboardingFragility: string;
  readonly modernizationPosture: string;
}

const PROFILES: Readonly<Record<IntelligenceSector, SectorContinuityProfile>> = Object.freeze({
  labour_union: {
    sector: 'labour_union',
    continuityCharacter:
      'Mandate-driven, member-ratified, with continuity carried through elected stewards and bargaining cycles.',
    continuityFragilityNote:
      'Continuity often concentrates in long-tenured stewards; redistribution requires institutional memory transfer, not headcount transfer.',
    stewardshipPattern:
      'Federated stewardship with strong local autonomy; redistribution is usually deliberate and ratified.',
    onboardingFragility:
      'Onboarding survivability depends on member-led inductions; modernization can erode it if procedural memory is not carried.',
    modernizationPosture:
      'Modernization is governance-sensitive; reviewer-led pacing protects continuity better than rapid replacement.',
  },
  federated_organization: {
    sector: 'federated_organization',
    continuityCharacter:
      'Layered governance with chapter-level autonomy; continuity reads must account for both federation and chapter posture.',
    continuityFragilityNote:
      'Federation-level continuity can appear stable while chapter-level continuity erodes silently.',
    stewardshipPattern:
      'Stewardship redistribution is uneven across chapters; readings should be composed per layer.',
    onboardingFragility:
      'New chapters often inherit onboarding fragility from federation templates that were never reviewer-validated.',
    modernizationPosture:
      'Modernization that bypasses chapter ratification typically introduces continuity debt that surfaces years later.',
  },
  healthcare: {
    sector: 'healthcare',
    continuityCharacter:
      'High continuity-criticality; clinical, regulatory, and operational continuity must coexist.',
    continuityFragilityNote:
      'Continuity loss in clinical or regulatory domains carries direct human-safety consequences and warrants conservative interpretation.',
    stewardshipPattern:
      'Stewardship is heavily distributed across credentialed roles; concentration drift is consequential.',
    onboardingFragility:
      'Onboarding survivability is doctrine-bound and procedure-bound; modernization must preserve procedural memory explicitly.',
    modernizationPosture:
      'Modernization must remain reviewer-led with explicit clinical-continuity preservation; refusal is appropriate when unclear.',
  },
  nonprofit_advocacy: {
    sector: 'nonprofit_advocacy',
    continuityCharacter:
      'Mission-led continuity with high reliance on individual stewardship and program memory.',
    continuityFragilityNote:
      'Continuity often lives in a few longtime stewards; departures can introduce significant continuity debt.',
    stewardshipPattern:
      'Stewardship redistribution is frequently incomplete; reviewers should look for hidden dependencies.',
    onboardingFragility:
      'Onboarding survivability tends to be informal; modernization can either reinforce or erode it depending on facilitation.',
    modernizationPosture:
      'Modernization is healthiest when it codifies what stewards already carry, not when it replaces them.',
  },
  regulatory_governance: {
    sector: 'regulatory_governance',
    continuityCharacter:
      'Statute-bound continuity with formal interpretation lineage; governance memory is foundational.',
    continuityFragilityNote:
      'Continuity erosion shows up as interpretation volatility before it shows up as outcomes.',
    stewardshipPattern:
      'Stewardship is heavily formalised; redistribution usually requires ratification.',
    onboardingFragility:
      'Onboarding survivability depends on institutional memory of interpretation lineage, not just procedure.',
    modernizationPosture:
      'Modernization without governance memory preservation introduces interpretation drift; reviewer pacing is essential.',
  },
  membership_organization: {
    sector: 'membership_organization',
    continuityCharacter:
      'Member-ratified continuity with volunteer-led stewardship cycles.',
    continuityFragilityNote:
      'Continuity often depends on annual cycles; modernization that breaks the cycle erodes continuity quietly.',
    stewardshipPattern:
      'Stewardship redistribution is cyclical; reviewers should observe several cycles before reading durability.',
    onboardingFragility:
      'Onboarding survivability depends on cycle-aware induction; modernization must preserve the cycle, not flatten it.',
    modernizationPosture:
      'Modernization that respects member cycles reinforces continuity; modernization that bypasses them does not.',
  },
});

export function getSectorContinuityProfile(
  sector: IntelligenceSector,
): SectorContinuityProfile {
  return PROFILES[sector];
}

export function listSectorContinuityProfiles(): ReadonlyArray<SectorContinuityProfile> {
  return Object.values(PROFILES).sort((a, b) => a.sector.localeCompare(b.sector));
}
