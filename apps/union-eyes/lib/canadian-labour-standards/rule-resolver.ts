import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/db/db';
import { statutoryRuleVersions } from '@/db/schema';

export interface GovernedStatutoryRule {
  id: string;
  jurisdiction: string;
  category: string;
  ruleKey: string;
  version: number;
  payload: Record<string, unknown>;
  source: { uri: string; digest: string; reviewedBy: string; reviewedAt: Date };
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

/** Only independently reviewed rules effective on the event date govern. */
export async function resolveStatutoryRules(jurisdiction: string, eventDate: Date, category?: string) {
  const conditions = [
    eq(statutoryRuleVersions.jurisdiction, jurisdiction),
    eq(statutoryRuleVersions.status, 'reviewed'),
    lte(statutoryRuleVersions.effectiveFrom, eventDate),
    or(isNull(statutoryRuleVersions.effectiveUntil), gt(statutoryRuleVersions.effectiveUntil, eventDate))!,
  ];
  if (category) conditions.push(eq(statutoryRuleVersions.category, category));
  const rows = await db.select().from(statutoryRuleVersions).where(and(...conditions));
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.ruleKey)) return { status: 'unknown' as const, reason: 'overlapping_reviewed_versions', rules: [] };
    seen.add(row.ruleKey);
  }
  if (rows.length === 0) return { status: 'unknown' as const, reason: 'no_reviewed_rule_for_event_date', rules: [] };
  return {
    status: 'governed' as const,
    rules: rows.map((row): GovernedStatutoryRule => ({
      id: row.id,
      jurisdiction: row.jurisdiction,
      category: row.category,
      ruleKey: row.ruleKey,
      version: row.version,
      payload: row.payload,
      source: { uri: row.sourceUri, digest: row.sourceDigest, reviewedBy: row.reviewedBy!, reviewedAt: row.reviewedAt! },
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
    })),
  };
}
