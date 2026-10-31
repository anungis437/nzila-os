/**
 * CRUD collection route for workplaceIncidents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ne } from 'drizzle-orm';
import { workplaceIncidents } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const INCIDENT_TYPE_MAP: Record<string, string> = {
  injury: 'injury',
  near_miss: 'near_miss',
  property_damage: 'property_damage',
  equipment_failure: 'property_damage',
  chemical_spill: 'environmental',
  fire: 'fire',
  vehicle: 'vehicle',
  ergonomic: 'ergonomic',
  exposure: 'exposure',
  occupational_illness: 'occupational_illness',
  electrical: 'electrical',
  fall: 'fall',
  environmental: 'environmental',
  other: 'other',
};

export const SEVERITY_MAP: Record<string, string> = {
  near_miss: 'near_miss',
  minor: 'minor',
  moderate: 'moderate',
  major: 'serious',
  serious: 'serious',
  critical: 'critical',
  fatal: 'fatal',
};

export function generateIncidentNumber(): string {
  const year = new Date().getFullYear();
  return `INC-${year}-${crypto.randomUUID()}`;
}

export function resolveIncidentDate(raw: Record<string, unknown>): string {
  const incidentDate = raw.incidentDate;
  if (!(typeof incidentDate === 'string' || incidentDate instanceof Date || typeof incidentDate === 'number')) {
    throw ApiError.badRequest('A valid incidentDate is required; reporting time is not the incident time');
  }
  const base = new Date(incidentDate);
  if (Number.isNaN(base.getTime())) throw ApiError.badRequest('Invalid incidentDate');
  const incidentTime = raw.incidentTime;
  if (incidentTime !== undefined) {
    if (typeof incidentTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(incidentTime)) {
      throw ApiError.badRequest('Invalid incidentTime');
    }
    const [hours, minutes] = incidentTime.split(':').map(Number);
    base.setHours(hours, minutes, 0, 0);
  }
  return base.toISOString();
}

/**
 * Convert the documented incident form aliases before strict CRUD validation.
 * Unknown/privileged fields remain in the payload and are refused by the
 * generic factory instead of silently disappearing or being mass-assigned.
 */
export function preprocessIncidentCreateBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const raw = { ...(body as Record<string, unknown>) };
  const aliases: Record<string, string> = {
    location: 'locationDescription',
    department: 'departmentName',
    rootCause: 'rootCauseAnalysis',
    correctiveActions: 'correctiveActionsSummary',
    reportedBy: 'reportedByName',
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!(alias in raw)) continue;
    if (canonical in raw) throw ApiError.badRequest(`Conflicting fields: ${alias} and ${canonical}`);
    raw[canonical] = raw[alias];
    delete raw[alias];
  }
  if ('incidentTime' in raw) {
    if (!('incidentDate' in raw)) throw ApiError.badRequest('incidentTime requires incidentDate');
    raw.incidentDate = resolveIncidentDate(raw);
    delete raw.incidentTime;
  }
  return raw;
}

export function buildIncidentCreateValues(values: Record<string, unknown>): Record<string, unknown> {
  const raw = values;
  const incidentType = typeof raw.incidentType === 'string' ? raw.incidentType : undefined;
  const severity = typeof raw.severity === 'string' ? raw.severity : undefined;
  const nowIso = new Date().toISOString();
  const resolvedType = incidentType && INCIDENT_TYPE_MAP[incidentType];
  const resolvedSeverity = severity && SEVERITY_MAP[severity];
  if (!resolvedType) throw ApiError.badRequest('A valid incidentType is required');
  if (!resolvedSeverity) throw ApiError.badRequest('A valid incident severity is required');
  const incidentDate = new Date(resolveIncidentDate(raw));


  const locationDescription = String(raw.locationDescription ?? raw.location ?? '').trim();
  const description = String(raw.description ?? '').trim();

  // Required, safety-relevant narrative fields must not be silently
  // normalized into a blank-but-"valid" record — reject instead.
  if (!locationDescription || !description) {
    throw ApiError.badRequest(
      'locationDescription (location) and description are required to submit an incident report',
    );
  }

  return {
    incidentNumber: generateIncidentNumber(),
    incidentType: resolvedType,
    severity: resolvedSeverity,
    incidentDate,
    reportedDate: new Date(nowIso),
    locationDescription,
    isAnonymous: raw.isAnonymous === true,
    reportedByName: raw.isAnonymous === true ? undefined : raw.reportedByName,
    departmentName: raw.departmentName ?? raw.department,
    description,
    rootCauseAnalysis: raw.rootCauseAnalysis ?? raw.rootCause,
    immediateActionsToken: raw.immediateActionsToken ?? raw.correctiveActions,
    correctiveActionsSummary: raw.correctiveActionsSummary ?? raw.correctiveActions,
    correctiveActionsRequired: Boolean(raw.correctiveActions),
    organizationId: raw.organizationId,
    createdBy: raw.createdBy,
    injuredPersonName: raw.injuredPersonName,
    bodyPartAffected: raw.bodyPartAffected,
    injuryNature: raw.injuryNature,
    treatmentProvided: raw.treatmentProvided,
    witnessesPresent: raw.witnessesPresent,
    witnessNames: raw.witnessNames,
    witnessStatements: raw.witnessStatements,
  };
}

const { GET, POST } = crudRoutes({
  table: workplaceIncidents,
  tags: ["Health-safety"],
  orgScoped: true,
  // Matches the documented H&S API contract (README.md): incident list/create
  // require at minimum the health_safety_rep role (level 30), not the
  // broader 'member' (20) or the stricter 'admin' (140).
  readRole: 'health_safety_rep',
  // A record an administrator removed is archived, and an archived record is neither listed nor returned by id.
  readCondition: ne(workplaceIncidents.status, 'archived'),
  // The incident list screen sends status, severity and search.
  listFilters: {
    equals: { status: 'status', severity: 'severity', incidentType: 'incidentType' },
    search: ['incidentNumber', 'description', 'locationDescription', 'departmentName'],
  },
  writeRole: 'health_safety_rep',
  preprocessCreateBody: preprocessIncidentCreateBody,
  writableFields: [
    'incidentType', 'severity', 'locationDescription', 'description',
    'departmentName', 'rootCauseAnalysis', 'correctiveActionsSummary',
    'isAnonymous', 'reportedByName', 'workplaceName', 'whatHappened',
    'witnessesPresent', 'witnessNames', 'witnessStatements',
    'injuredPersonName', 'bodyPartAffected', 'injuryNature', 'treatmentProvided',
    'immediateActionsToken', 'incidentDate',
  ],
  beforeCreate: (values) => buildIncidentCreateValues(values),
  // A report filed as anonymous is not attributed to the session user in the row or the audit entry.
  anonymousCreate: (values) => values.isAnonymous === true,
});
export { GET, POST };
