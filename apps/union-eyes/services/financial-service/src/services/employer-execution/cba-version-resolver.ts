import { sql } from "drizzle-orm";
import { db } from "../../db";
import type { RuleResolutionContext } from "./types";

type CbaRuleVersionRow = {
  id: string;
  ruleVersionCode: string;
  sourceHash: string;
  rulesJson: Record<string, unknown>;
};

export async function resolveActiveCbaRuleVersion(context: RuleResolutionContext) {
  const workDate = new Date(context.workDate).toISOString().slice(0, 10);

  const rows = (await db.execute(sql`
    select
      id,
      rule_version_code as "ruleVersionCode",
      source_hash as "sourceHash",
      rules_json as "rulesJson"
    from cba_rule_versions
    where organization_id = ${context.organizationId}
      and status = 'active'
      and effective_from <= ${workDate}::date
      and (effective_to is null or effective_to >= ${workDate}::date)
      and (employer_id is null or employer_id = ${context.employerId ?? null})
      and (worksite_id is null or worksite_id = ${context.worksiteId ?? null})
      and (bargaining_unit_id is null or bargaining_unit_id = ${context.bargainingUnitId ?? null})
    order by effective_from desc
    limit 1
  `)) as CbaRuleVersionRow[];

  return rows[0] ?? null;
}
