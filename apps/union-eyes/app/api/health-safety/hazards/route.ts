/**
 * CRUD collection route for hazardReports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { hazardReports } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const HAZARD_TYPE_TO_CATEGORY: Record<string, string> = {
  slip_trip_fall: 'safety',
  electrical: 'electrical',
  chemical: 'chemical',
  fire: 'fire',
  equipment: 'machinery',
  ergonomic: 'ergonomic',
  environmental: 'environmental',
  security: 'psychosocial',
  other: 'other',
};

export const PRIORITY_TO_HAZARD_LEVEL: Record<string, string> = {
  low: 'low',
  medium: 'moderate',
  high: 'high',
  critical: 'critical',
};

export function generateReportNumber(): string {
  const year = new Date().getFullYear();
  return `HAZ-${year}-${crypto.randomUUID()}`;
}

export function buildHazardCreateValues(values: Record<string, unknown>): Record<string, unknown> {
  const raw = values;
  const hazardType = typeof raw.hazardType === 'string' ? raw.hazardType : undefined;
  const priority = typeof raw.priority === 'string' ? raw.priority : undefined;

  const specificLocation = String(raw.specificLocation ?? raw.location ?? '').trim();
  const hazardDescription = String(raw.hazardDescription ?? raw.description ?? '').trim();

  // Required, safety-relevant narrative fields must not be silently
  // normalized into a blank-but-"valid" record — reject instead.
  if (!specificLocation || !hazardDescription) {
    throw ApiError.badRequest(
      'specificLocation (location) and hazardDescription (description) are required to submit a hazard report',
    );
  }

  return {
    reportNumber: raw.reportNumber ?? generateReportNumber(),
    hazardCategory: raw.hazardCategory ?? (hazardType && HAZARD_TYPE_TO_CATEGORY[hazardType]) ?? 'other',
    hazardLevel: raw.hazardLevel ?? (priority && PRIORITY_TO_HAZARD_LEVEL[priority]) ?? 'moderate',
    specificLocation,
    hazardDescription,
    potentialConsequences: raw.potentialConsequences,
    suggestedCorrections: raw.suggestedCorrections ?? raw.recommendedAction,
    isAnonymous: raw.isAnonymous ?? false,
    reportedByName: raw.isAnonymous ? undefined : (raw.reportedByName ?? raw.reporterName),
    reporterContactInfo: raw.isAnonymous ? undefined : (raw.reporterContactInfo ?? raw.reporterContact),
    organizationId: raw.organizationId,
    createdBy: raw.createdBy,
    metadata: { rawHazardType: hazardType },
  };
}

const { GET, POST } = crudRoutes({
  table: hazardReports,
  tags: ["Health-safety"],
  orgScoped: true,
  // Matches the documented H&S API contract (README.md): hazard list/create
  // require at minimum the health_safety_rep role (level 30), not the
  // broader 'member' (20) or the stricter 'admin' (140).
  readRole: 'health_safety_rep',
  writeRole: 'health_safety_rep',
  beforeCreate: (values) => buildHazardCreateValues(values),
});
export { GET, POST };
