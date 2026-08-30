/**
 * CRUD collection route for hazardReports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { hazardReports } from '@/db/schema';

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
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `HAZ-${year}-${suffix}`;
}

export function buildHazardCreateValues(values: Record<string, unknown>): Record<string, unknown> {
  const raw = values;
  const hazardType = typeof raw.hazardType === 'string' ? raw.hazardType : undefined;
  const priority = typeof raw.priority === 'string' ? raw.priority : undefined;

  return {
    reportNumber: raw.reportNumber ?? generateReportNumber(),
    hazardCategory: raw.hazardCategory ?? (hazardType && HAZARD_TYPE_TO_CATEGORY[hazardType]) ?? 'other',
    hazardLevel: raw.hazardLevel ?? (priority && PRIORITY_TO_HAZARD_LEVEL[priority]) ?? 'moderate',
    specificLocation: raw.specificLocation ?? raw.location ?? '',
    hazardDescription: raw.hazardDescription ?? raw.description ?? '',
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
  readRole: 'member',
  writeRole: 'admin',
  beforeCreate: (values) => buildHazardCreateValues(values),
});
export { GET, POST };
