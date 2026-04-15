import { and, eq, lte, or, gte, isNull, desc } from "drizzle-orm";
import { db } from "../../db";
import { schema } from "../../db";
import type { RuleResolutionContext } from "./types";

export async function resolveActiveCbaRuleVersion(context: RuleResolutionContext) {
  const workDate = new Date(context.workDate);

  const rows = await db
    .select()
    .from(schema.cbaRuleVersions)
    .where(
      and(
        eq(schema.cbaRuleVersions.organizationId, context.organizationId),
        eq(schema.cbaRuleVersions.status, "active"),
        lte(schema.cbaRuleVersions.effectiveFrom, workDate.toISOString().slice(0, 10)),
        or(
          gte(schema.cbaRuleVersions.effectiveTo, workDate.toISOString().slice(0, 10)),
          isNull(schema.cbaRuleVersions.effectiveTo),
        ),
        or(
          eq(schema.cbaRuleVersions.employerId, context.employerId ?? null),
          isNull(schema.cbaRuleVersions.employerId),
        ),
        or(
          eq(schema.cbaRuleVersions.worksiteId, context.worksiteId ?? null),
          isNull(schema.cbaRuleVersions.worksiteId),
        ),
        or(
          eq(schema.cbaRuleVersions.bargainingUnitId, context.bargainingUnitId ?? null),
          isNull(schema.cbaRuleVersions.bargainingUnitId),
        ),
      ),
    )
    .orderBy(desc(schema.cbaRuleVersions.effectiveFrom))
    .limit(1);

  return rows[0] ?? null;
}
