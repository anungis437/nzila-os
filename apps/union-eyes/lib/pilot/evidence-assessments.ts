import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { pilotEvidenceAssessments } from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';

export type PilotEvidenceDimension = typeof pilotEvidenceAssessments.$inferInsert.dimension;

export async function loadCurrentPilotEvidence(tx: RLSTx, applicationId: string, at = new Date()) {
  const rows = await tx
    .select()
    .from(pilotEvidenceAssessments)
    .where(and(
      eq(pilotEvidenceAssessments.applicationId, applicationId),
      isNull(pilotEvidenceAssessments.supersededAt),
      or(isNull(pilotEvidenceAssessments.expiresAt), gt(pilotEvidenceAssessments.expiresAt, at)),
    ))
    .orderBy(desc(pilotEvidenceAssessments.reviewedAt));
  return new Map(rows.map((row) => [row.dimension, row] as const));
}

export function proposalEvidenceFrom(rows: Awaited<ReturnType<typeof loadCurrentPilotEvidence>>) {
  const score = (dimension: PilotEvidenceDimension) => rows.get(dimension)?.score;
  const qualification = ['fit', 'risk', 'revenue', 'readiness', 'strategic_value'].every((dimension) => score(dimension as PilotEvidenceDimension) !== undefined)
    ? {
        fit: score('fit') as number,
        risk: score('risk') as number,
        revenue: score('revenue') as number,
        readiness: score('readiness') as number,
        strategicValue: score('strategic_value') as number,
      }
    : undefined;
  const signals = ['adoption', 'activity', 'champion', 'risk'].every((dimension) => score(dimension as PilotEvidenceDimension) !== undefined)
    ? {
        adoptionScore: score('adoption') as number,
        activityScore: score('activity') as number,
        championScore: score('champion') as number,
        riskScore: score('risk') as number,
      }
    : {};
  return { qualification, signals };
}
