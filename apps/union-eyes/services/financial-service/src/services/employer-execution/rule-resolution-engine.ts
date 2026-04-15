import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { resolveActiveCbaRuleVersion } from "./cba-version-resolver";
import type { RuleResolutionContext, RuleResolutionResult } from "./types";

export async function resolveRuleSet(context: RuleResolutionContext): Promise<RuleResolutionResult> {
  const trace: RuleResolutionResult["trace"] = [];

  const activeVersion = await resolveActiveCbaRuleVersion(context);
  if (!activeVersion) {
    trace.push({
      step: "version_lookup",
      outcome: "not_found",
      details: { context },
    });
    throw new Error("No active CBA rule version found for employer execution context");
  }

  trace.push({
    step: "version_lookup",
    outcome: "resolved",
    details: {
      ruleVersionId: activeVersion.id,
      ruleVersionCode: activeVersion.ruleVersionCode,
      sourceHash: activeVersion.sourceHash,
    },
  });

  const setItems = await db
    .select()
    .from(schema.cbaRuleSetItems)
    .where(
      and(
        eq(schema.cbaRuleSetItems.organizationId, context.organizationId),
        eq(schema.cbaRuleSetItems.cbaRuleVersionId, activeVersion.id),
      ),
    )
    .orderBy(asc(schema.cbaRuleSetItems.precedence));

  trace.push({
    step: "rule_items_lookup",
    outcome: "resolved",
    details: { count: setItems.length },
  });

  return {
    ruleVersionId: activeVersion.id,
    ruleVersionCode: activeVersion.ruleVersionCode,
    sourceHash: activeVersion.sourceHash,
    rules: {
      version: activeVersion.rulesJson,
      items: setItems.map((item) => ({
        ruleCode: item.ruleCode,
        itemType: item.itemType,
        precedence: item.precedence,
        condition: item.conditionJson,
        action: item.actionJson,
        ruleHash: item.ruleHash,
      })),
    },
    trace,
  };
}
