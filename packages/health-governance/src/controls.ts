import { ControlStatus } from './types.js'
import type { ControlRow } from './types.js'

export const VERIDIAN_CONTROL_MATRIX: ControlRow[] = [
  {
    control: 'Release governance',
    description:
      'All releases require passing CI gates and documented release notes before deployment.',
    evidenceSource: 'release notes + CI gates',
    cadence: 'per release',
    ownerRole: 'Engineering Lead',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'RBAC review',
    description:
      'Role-based access controls are reviewed quarterly to ensure principle of least privilege.',
    evidenceSource: 'audit logs',
    cadence: 'quarterly',
    ownerRole: 'Privacy Officer',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'Consent logging',
    description:
      'All access decisions are logged via the consent-engine audit events in real time.',
    evidenceSource: 'consent-engine audit events',
    cadence: 'continuous',
    ownerRole: 'Platform',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'Backup/restore validation',
    description:
      'Monthly backup restoration drills are conducted and documented per infrastructure runbook.',
    evidenceSource: 'infrastructure runbook',
    cadence: 'monthly',
    ownerRole: 'DevOps',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'Incident response',
    description:
      'All incidents are logged, triaged, and resolved per the incident response process.',
    evidenceSource: 'incident log',
    cadence: 'per incident',
    ownerRole: 'On-call Lead',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'Integration change control',
    description:
      'Changes to external connectors are tracked via connector changelogs and reviewed before deployment.',
    evidenceSource: 'connector changelogs',
    cadence: 'per change',
    ownerRole: 'Integration Lead',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'Synthetic demo controls',
    description:
      'All demo data is classified as synthetic and labelled to prevent confusion with live records.',
    evidenceSource: 'data classification labels',
    cadence: 'continuous',
    ownerRole: 'Platform',
    status: ControlStatus.IMPLEMENTED,
  },
  {
    control: 'Privacy review before live data',
    description:
      'A privacy impact assessment must be completed before any new site is onboarded with live patient data.',
    evidenceSource: 'privacy impact assessment',
    cadence: 'before each new site',
    ownerRole: 'Privacy Officer',
    status: ControlStatus.PLANNED,
  },
]
