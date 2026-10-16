/**
 * Planning record only. Not a fleet registry and not a permission grant.
 * SCOUT, VERIFIER, REDTEAM, BUILDER, FORGE, and COUNSEL are not registered
 * code agents on this branch. A fleet-wide registry is a separate fix.
 * CIVITAS does not create that registry.
 */
export const FLEET_ARCHITECTURE_DEBT = {
  id: 'FLEET_ARCHITECTURE_DEBT',
  scope: 'fleet-wide',
  civitasCreatesAgentRegistry: false,
  missingCanonicalMachineReadableRegistry: [
    'SCOUT',
    'VERIFIER',
    'REDTEAM',
    'BUILDER',
    'FORGE',
    'COUNSEL',
  ],
  note: 'These names are self-obligations in the CIVITAS interaction record. They are not registered agents. The missing canonical registry is fleet-wide debt.',
} as const
