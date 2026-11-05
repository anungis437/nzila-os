const fs = require('fs')
function edit(p, pairs, { optional = false } = {}) {
  if (!fs.existsSync(p)) { if (optional) return; throw new Error('no file ' + p) }
  let s = fs.readFileSync(p, 'utf8')
  const crlf = s.includes('\r\n')
  const fix = (t) => (crlf ? t.replace(/\r?\n/g, '\r\n') : t)
  for (const [a0, b0, first] of pairs) {
    const a = fix(a0), b = fix(b0)
    if (s.includes(b) && !s.includes(a)) continue // already applied
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = first ? s.replace(a, () => b) : s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}

// ---------------------------------------------------------------- Drizzle schema (declared shape of migration 0038)
for (const p of ['db/schema/analytics.ts', 'db/schema/domains/analytics/analytics.ts']) {
  edit(p, [["  alertEnabled: boolean('alert_enabled').default(false),\n", "  alertEnabled: boolean('alert_enabled').default(false),\n  direction: text('direction'), // 'higher_is_better' | 'lower_is_better'; null means the direction is read from the thresholds\n", true]])
}
edit('db/schema/domains/communications/employer-communications.ts', [
  ["  index,\n} from \"drizzle-orm/pg-core\";\n", "  index,\n  uniqueIndex,\n} from \"drizzle-orm/pg-core\";\nimport { sql } from \"drizzle-orm\";\n", true],
  ["    index(\"idx_employer_contacts_role\").on(table.role),\n", "    index(\"idx_employer_contacts_role\").on(table.role),\n    uniqueIndex(\"employer_contacts_one_primary_per_employer_idx\")\n      .on(table.organizationId, table.employerId)\n      .where(sql`${table.isPrimary} IS TRUE AND ${table.isActive} IS NOT FALSE`),\n", true],
])
edit('db/schema/committee-workspace-schema.ts', [
  ["  minutesApprovedAt: timestamp('minutes_approved_at', { withTimezone: true }),\n", "  minutesApprovedAt: timestamp('minutes_approved_at', { withTimezone: true }),\n  minutesRecordedBy: text('minutes_recorded_by'),\n", true],
])
edit('db/schema/domains/infrastructure/exit-interviews.ts', [
  ["    submittedAt: timestamp('submitted_at', { withTimezone: true }),\n", "    submittedAt: timestamp('submitted_at', { withTimezone: true }),\n    submittedBy: text('submitted_by'),\n", true],
])
for (const p of ['db/schema/cms-website-schema.ts', 'db/schema/domains/infrastructure/cms.ts']) {
  edit(p, [["  updatedBy: text('updated_by').references(() => profiles.userId),\n", "  updatedBy: text('updated_by').references(() => profiles.userId),\n  submittedBy: text('submitted_by'),\n", true]])
}
edit('db/schema/sso-scim-schema.ts', [
  ["import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer } from \"drizzle-orm/pg-core\";", "import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer, uniqueIndex } from \"drizzle-orm/pg-core\";", true],
  ["  updatedBy: varchar(\"updated_by\", { length: 255 }),\n});\n\n/**\n * SCIM Configuration Table", "  updatedBy: varchar(\"updated_by\", { length: 255 }),\n}, (table) => [\n  uniqueIndex(\"sso_providers_org_saml_entity_idx\").on(table.organizationId, table.samlEntityId).where(sql`${table.samlEntityId} IS NOT NULL`),\n  uniqueIndex(\"sso_providers_org_oidc_issuer_client_idx\").on(table.organizationId, table.oidcIssuer, table.oidcClientId).where(sql`${table.oidcIssuer} IS NOT NULL`),\n]);\n\n/**\n * SCIM Configuration Table", true],
])

// ---------------------------------------------------------------- KPI direction
edit('lib/kpi/health.ts', [
  ["export function kpiLowerIsBetter(target: number | null, warning: number | null, critical: number | null): boolean {\n", "export function kpiLowerIsBetter(target: number | null, warning: number | null, critical: number | null, direction?: string | null): boolean {\n  // A stored direction decides; only a target that has none is read from its thresholds.\n  if (direction === 'lower_is_better') return true\n  if (direction === 'higher_is_better') return false\n"],
  ["  critical: number | null,\n): KpiHealth {", "  critical: number | null,\n  direction?: string | null,\n): KpiHealth {"],
  ["  if (kpiLowerIsBetter(target, warning, critical)) {", "  if (kpiLowerIsBetter(target, warning, critical, direction)) {"],
])
edit('app/api/targets/summary/route.ts', [["computeKpiHealth(currentValue, targetNum, warningNum, criticalNum);", "computeKpiHealth(currentValue, targetNum, warningNum, criticalNum, cfg.direction);"]])
edit('app/api/targets/route.ts', [
  ["      alertEnabled: z.boolean().default(false),\n", "      alertEnabled: z.boolean().default(false),\n      direction: z.enum(['higher_is_better', 'lower_is_better']).optional(),\n"],
  ["          alertEnabled: body.alertEnabled,\n", "          alertEnabled: body.alertEnabled,\n          direction: body.direction ?? null,\n"],
])

// ---------------------------------------------------------------- primary contact race
edit('app/api/employers/communications/contacts/route.ts', [
  ["import { eq, desc, and } from 'drizzle-orm'\n", "import { eq, desc, and } from 'drizzle-orm'\nimport { isUniqueViolation } from '@/lib/db/unique-violation'\n"],
  ["  } catch (_error) {\n    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to add employer contact')", "  } catch (error) {\n    // The unique index admits one active primary contact per employer; a concurrent create that lost the race is a conflict.\n    if (isUniqueViolation(error)) return standardErrorResponse(ErrorCode.CONFLICT, 'This employer already has a primary contact')\n    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to add employer contact')"],
])

// ---------------------------------------------------------------- who recorded the minutes
edit('lib/services/committee-workspace-service.ts', [
  [".set({ minutes, status: 'completed', updatedBy, updatedAt: sql`now()` })", ".set({ minutes, status: 'completed', minutesRecordedBy: updatedBy, updatedBy, updatedAt: sql`now()` })"],
])
edit('app/api/committees/[id]/meetings/[meetingId]/minutes/route.ts', [
  [
    "    if (meeting.updatedBy && meeting.updatedBy === userId) {\n      throw ApiError.forbidden(\"Minutes cannot be approved by the person who last edited the meeting record\");\n    }",
    "    // The recorder is the person who recorded the minutes; a meeting whose minutes were recorded before that was kept falls back to its last editor.\n    const recorder = meeting.minutesRecordedBy ?? meeting.updatedBy;\n    if (recorder && recorder === userId) {\n      throw ApiError.forbidden(\"Minutes cannot be approved by the person who recorded them\");\n    }",
  ],
])

// ---------------------------------------------------------------- who submitted the interview
edit('app/api/exit-interviews/[id]/submit/route.ts', [["        .set({ status: 'submitted', submittedAt: now, updatedAt: now, updatedBy: userId! })", "        .set({ status: 'submitted', submittedAt: now, submittedBy: userId!, updatedAt: now, updatedBy: userId! })"]])
edit('app/api/exit-interviews/[id]/review/route.ts', [
  [
    "    if (existing.updatedBy && existing.updatedBy === userId) {\n      throw ApiError.forbidden('The person who last edited or submitted an exit interview cannot review it');\n    }",
    "    // The submitter is recorded; an interview submitted before that was kept falls back to its last editor.\n    const submitter = existing.submittedBy ?? existing.updatedBy;\n    if (submitter && submitter === userId) {\n      throw ApiError.forbidden('The person who submitted an exit interview cannot review it');\n    }",
  ],
])

// ---------------------------------------------------------------- who moved the content item to review
edit('app/api/content/templates/[id]/status/route.ts', [
  ["        SELECT id, status, title, updated_by FROM cms_pages", "        SELECT id, status, title, updated_by, submitted_by FROM cms_pages"],
  [
    "      if (currentStatus === 'review' && newStatus === 'published' && current.updated_by === userId) {",
    "      const submitter = (current.submitted_by ?? current.updated_by) as string | null;\n      if (currentStatus === 'review' && newStatus === 'published' && submitter === userId) {",
  ],
  [
    "      const publishedClause = newStatus === 'published'",
    "      const submittedClause = newStatus === 'review' ? sql`, submitted_by = ${userId}` : sql``;\n      const publishedClause = newStatus === 'published'",
  ],
  ["            updated_at = now()\n            ${publishedClause}", "            updated_at = now()\n            ${submittedClause}\n            ${publishedClause}"],
])

// ---------------------------------------------------------------- SSO required groups and duplicates
edit('app/api/enterprise/sso/providers/route.ts', [
  ["import { validateSsoProviderInput } from '@/lib/sso/provider-input';\n", "import { validateSsoProviderInput } from '@/lib/sso/provider-input';\nimport { isUniqueViolation } from '@/lib/db/unique-violation';\n"],
  ["      autoProvision,\n      enabled,\n    } = body as {", "      autoProvision,\n      enabled,\n      requireGroups,\n    } = body as {"],
  ["      autoProvision?: boolean;\n      enabled?: boolean;\n    };", "      autoProvision?: boolean;\n      enabled?: boolean;\n      requireGroups?: string[];\n    };"],
  ["    const created = await withRLSContext(async (tx) => {", "    // Groups the identity provider must assert before anyone signs in through it: a bounded list of short names.\n    if (requireGroups !== undefined && (!Array.isArray(requireGroups) || requireGroups.length > 50 || !requireGroups.every((group) => typeof group === 'string' && group.trim().length > 0 && group.length <= 255))) {\n      throw ApiError.badRequest('requireGroups must be a list of at most 50 group names');\n    }\n\n    const created = await withRLSContext(async (tx) => {"],
  ["        autoProvision: autoProvision ?? false,\n        enabled: enabled ?? false,", "        autoProvision: autoProvision ?? false,\n        requireGroups: requireGroups ? requireGroups.map((group) => group.trim()) : undefined,\n        enabled: enabled ?? false,"],
])
