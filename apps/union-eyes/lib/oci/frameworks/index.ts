/**
 * ARTIFACT TYPE: IP / Doctrine
 * DOCTRINE_VERSION: 1.0.0
 *
 * OCI signature frameworks barrel.
 *
 * All five trademarked frameworks live in this directory. Each module is
 * pure (no side effects), deterministic, and consumed by engines, PDF
 * narrative, and CRM mappers. They are the IP that anchors the OCI
 * methodology; do not inline their logic anywhere else.
 *
 * The OCI_METHOD constant is the canonical five-phase methodology spine.
 * Any product surface, PDF export, or educational artifact that references
 * a methodology phase must consume this constant.
 */

export * as ContinuityBurdenMap from './continuity-burden-map';
export * as GovernanceEntropyScale from './governance-entropy-scale';
export * as StewardshipDensityIndex from './stewardship-density-index';
export * as ContinuitySurvivabilityMatrix from './continuity-survivability-matrix';
export * as ReconstructionBurdenIndex from './reconstruction-burden-index';

/**
 * The OCI Method™ — five-phase methodology spine.
 * See docs/oci/OCI_METHOD.md (single canonical method file).
 */
export const OCI_METHOD = {
  doctrineVersion: '1.1.0',
  phases: [
    {
      id: 'recognition',
      ordinal: 1,
      name: 'Recognition',
      productLayer: 'P1',
      productFamily: 'OCRA',
      posture:
        'Calm, awakening, non-coercive. Begin to see what your institution is carrying.',
    },
    {
      id: 'mapping',
      ordinal: 2,
      name: 'Mapping',
      productLayer: 'P2',
      productFamily: 'Governance Entropy Workbook\u2122',
      posture:
        'Fieldwork, editorial, dignified. Map the people, the lineage, and the breakpoints.',
    },
    {
      id: 'stabilization',
      ordinal: 3,
      name: 'Stabilization',
      productLayer: 'P3',
      productFamily: 'OCI Diagnostic & Stabilization',
      posture:
        'Facilitative, collegial, reductive. Reduce continuity burden where it is most fragile.',
    },
    {
      id: 'infrastructure',
      ordinal: 4,
      name: 'Infrastructure',
      productLayer: 'P4',
      productFamily: 'OCI Runtime',
      posture:
        'Embedded, structural, durable. Continuity becomes how the institution operates.',
    },
    {
      id: 'intelligence',
      ordinal: 5,
      name: 'Intelligence',
      productLayer: 'P5',
      productFamily: 'OCI Intelligence Network',
      posture:
        'Longitudinal, anonymized, sector-aware. Learn from continuity at the level of the field.',
    },
  ] as const,
} as const;

export type OciMethodPhaseId = (typeof OCI_METHOD.phases)[number]['id'];
