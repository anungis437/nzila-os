/**
 * CRUD collection route for workplaceIncidents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { workplaceIncidents } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const INCIDENT_TYPE_MAP: Record<string, string> = {
  injury: 'injury',
  near_miss: 'near_miss',
  property_damage: 'property_damage',
  equipment_failure: 'property_damage',
  chemical_spill: 'environmental',
  fire: 'fire',
  other: 'other',
};

export const SEVERITY_MAP: Record<string, string> = {
  minor: 'minor',
  major: 'serious',
  critical: 'critical',
};

export function generateIncidentNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `INC-${year}-${suffix}`;
}

export function resolveIncidentDate(raw: Record<string, unknown>): string {
  const incidentDate = raw.incidentDate;
  const incidentTime = typeof raw.incidentTime === 'string' ? raw.incidentTime : undefined;
  if (typeof incidentDate === 'string' || incidentDate instanceof Date || typeof incidentDate === 'number') {
    const base = new Date(incidentDate);
    if (!Number.isNaN(base.getTime())) {
      if (incidentTime && /^\d{1,2}:\d{2}$/.test(incidentTime)) {
        const [hours, minutes] = incidentTime.split(':').map(Number);
        base.setHours(hours, minutes, 0, 0);
      }
      return base.toISOString();
    }
  }
  return new Date().toISOString();
}

export function buildIncidentCreateValues(values: Record<string, unknown>): Record<string, unknown> {
  const raw = values;
  const incidentType = typeof raw.incidentType === 'string' ? raw.incidentType : undefined;
  const severity = typeof raw.severity === 'string' ? raw.severity : undefined;
  const nowIso = new Date().toISOString();

  return {
    incidentNumber: raw.incidentNumber ?? generateIncidentNumber(),
    incidentType: incidentType && INCIDENT_TYPE_MAP[incidentType]
      ? INCIDENT_TYPE_MAP[incidentType]
      : 'other',
    severity: severity && SEVERITY_MAP[severity] ? SEVERITY_MAP[severity] : 'minor',
    incidentDate: resolveIncidentDate(raw),
    reportedDate: raw.reportedDate ?? nowIso,
    locationDescription: raw.locationDescription ?? raw.location ?? '',
    departmentName: raw.departmentName ?? raw.department,
    description: raw.description ?? '',
    rootCauseAnalysis: raw.rootCauseAnalysis ?? raw.rootCause,
    immediateActionsToken: raw.immediateActionsToken ?? raw.correctiveActions,
    correctiveActionsSummary: raw.correctiveActionsSummary ?? raw.correctiveActions,
    correctiveActionsRequired: Boolean(raw.correctiveActions),
    organizationId: raw.organizationId,
    createdBy: raw.createdBy,
    metadata: {
      rawIncidentType: incidentType,
      injuriesOccurred: raw.injuriesOccurred,
      injuryDetails: raw.injuryDetails,
      witnessesPresent: raw.witnessesPresent,
      witnessNames: raw.witnessNames,
      witnessContacts: raw.witnessContacts,
      preventiveMeasures: raw.preventiveMeasures,
      isAnonymous: raw.isAnonymous,
      reportedBy: raw.isAnonymous ? undefined : raw.reportedBy,
      reporterContact: raw.isAnonymous ? undefined : raw.reporterContact,
    },
  };
}

const { GET, POST } = crudRoutes({
  table: workplaceIncidents,
  tags: ["Health-safety"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
  beforeCreate: (values) => buildIncidentCreateValues(values),
});
export { GET, POST };
