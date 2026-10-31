/**
 * CRUD collection route for hazardReports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ne } from 'drizzle-orm';
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

const VALID_HAZARD_CATEGORIES = new Set([
  'biological', 'chemical', 'ergonomic', 'physical', 'psychosocial',
  'safety', 'environmental', 'electrical', 'fire', 'confined_space',
  'working_at_heights', 'machinery', 'other',
]);
const VALID_HAZARD_LEVELS = new Set(['low', 'moderate', 'high', 'critical', 'extreme']);

export function generateReportNumber(): string {
  const year = new Date().getFullYear();
  return `HAZ-${year}-${crypto.randomUUID()}`;
}

/**
 * Normalize the documented mobile/legacy hazard form aliases before the
 * generic factory validates schema columns. Unknown and privileged fields
 * are deliberately left intact so the factory rejects them (400).
 */
export function preprocessHazardCreateBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const raw = { ...(body as Record<string, unknown>) };
  const aliases: Record<string, string> = {
    location: 'specificLocation',
    description: 'hazardDescription',
    recommendedAction: 'suggestedCorrections',
    reporterName: 'reportedByName',
    reporterContact: 'reporterContactInfo',
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!(alias in raw)) continue;
    if (canonical in raw) throw ApiError.badRequest(`Conflicting fields: ${alias} and ${canonical}`);
    raw[canonical] = raw[alias];
    delete raw[alias];
  }
  if ('hazardType' in raw) {
    if ('hazardCategory' in raw) throw ApiError.badRequest('Conflicting hazard category fields');
    const category = HAZARD_TYPE_TO_CATEGORY[String(raw.hazardType)];
    if (!category) throw ApiError.badRequest('Unsupported hazard type');
    raw.hazardCategory = category;
    delete raw.hazardType;
  }
  if ('priority' in raw) {
    if ('hazardLevel' in raw) throw ApiError.badRequest('Conflicting hazard level fields');
    const level = PRIORITY_TO_HAZARD_LEVEL[String(raw.priority)];
    if (!level) throw ApiError.badRequest('Unsupported hazard priority');
    raw.hazardLevel = level;
    delete raw.priority;
  }
  return raw;
}

export function buildHazardCreateValues(values: Record<string, unknown>): Record<string, unknown> {
  const raw = values;
  const hazardType = typeof raw.hazardType === 'string' ? raw.hazardType : undefined;
  const priority = typeof raw.priority === 'string' ? raw.priority : undefined;

  const category = raw.hazardCategory ?? (hazardType && HAZARD_TYPE_TO_CATEGORY[hazardType]);
  const level = raw.hazardLevel ?? (priority && PRIORITY_TO_HAZARD_LEVEL[priority]);
  if (typeof category !== 'string' || !VALID_HAZARD_CATEGORIES.has(category)) {
    throw ApiError.badRequest('A valid hazard category or hazardType is required');
  }
  if (typeof level !== 'string' || !VALID_HAZARD_LEVELS.has(level)) {
    throw ApiError.badRequest('A valid hazard level or priority is required');
  }

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
    reportNumber: generateReportNumber(),
    hazardCategory: category,
    hazardLevel: level,
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
  // A record an administrator removed is archived, and an archived record is neither listed nor returned by id.
  readCondition: ne(hazardReports.status, 'archived'),
  writeRole: 'health_safety_rep',
  preprocessCreateBody: preprocessHazardCreateBody,
  writableFields: [
    'hazardCategory', 'hazardLevel', 'specificLocation', 'hazardDescription',
    'potentialConsequences', 'suggestedCorrections', 'isAnonymous',
    'reportedByName', 'reporterContactInfo', 'workplaceName',
    'department', 'whoIsAtRisk', 'existingControls', 'photoUrls',
  ],
  beforeCreate: (values) => buildHazardCreateValues(values),
  // Preserve reporter anonymity in both the row and its mandatory audit entry.
  anonymousCreate: (values) => values.isAnonymous === true,
});
export { GET, POST };
