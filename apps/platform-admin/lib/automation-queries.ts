/**
 * Platform Admin — Automation rule queries
 *
 * Org-scoped CRUD over `itsm_automation_rules`. Rule bodies (conditions,
 * actions, condition logic) are validated at the boundary using zod
 * schemas that mirror the runtime types in @nzila/itsm-core, and stored as
 * JSONB so the table does not need to migrate every time a new operator
 * or action type lands in itsm-core.
 *
 * Callers MUST have already verified org membership / write authority
 * (via `requireOrgScope` / `withOrgWrite`). These helpers do not re-check.
 */
import { and, count, desc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { itsmAutomationRules } from '@nzila/db/schema'
import { z } from 'zod'

// ── Validation ────────────────────────────────────────────────────────────────

export const automationConditionSchema = z.object({
  field: z.string().min(1).max(120),
  operator: z.enum(['eq', 'neq', 'gte', 'lte', 'in', 'older_than_minutes']),
  value: z.unknown(),
})

export const automationActionSchema = z.object({
  type: z.enum([
    'change_status',
    'change_priority',
    'assign_queue',
    'send_notification',
    'escalate',
    'create_problem',
    'create_ticket',
    'webhook',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const createAutomationRuleSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().default(true),
  conditionLogic: z.enum(['all', 'any']).default('all'),
  conditions: z.array(automationConditionSchema).min(1).max(20),
  actions: z.array(automationActionSchema).min(1).max(20),
  cooldownMinutes: z.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
})
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>

export const updateAutomationRuleSchema = createAutomationRuleSchema.partial()
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>

// ── Row shape ────────────────────────────────────────────────────────────────

export interface AutomationRuleRow {
  id: string
  name: string
  description: string | null
  enabled: boolean
  conditionLogic: 'all' | 'any'
  conditionCount: number
  actionCount: number
  triggerCount: number
  cooldownMinutes: number | null
  lastTriggeredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function toRow(r: typeof itsmAutomationRules.$inferSelect): AutomationRuleRow {
  const conds = Array.isArray(r.conditions) ? r.conditions : []
  const acts = Array.isArray(r.actions) ? r.actions : []
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    conditionLogic: (r.conditionLogic as 'all' | 'any') ?? 'all',
    conditionCount: conds.length,
    actionCount: acts.length,
    triggerCount: r.triggerCount,
    cooldownMinutes: r.cooldownMinutes,
    lastTriggeredAt: r.lastTriggeredAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listAutomationRules(
  orgId: string,
): Promise<AutomationRuleRow[]> {
  const rows = await platformDb
    .select()
    .from(itsmAutomationRules)
    .where(eq(itsmAutomationRules.orgId, orgId))
    .orderBy(desc(itsmAutomationRules.updatedAt))
  return rows.map(toRow)
}

export async function getAutomationRule(orgId: string, ruleId: string) {
  const [row] = await platformDb
    .select()
    .from(itsmAutomationRules)
    .where(
      and(
        eq(itsmAutomationRules.orgId, orgId),
        eq(itsmAutomationRules.id, ruleId),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function countAutomationRules(orgId: string): Promise<number> {
  const [row] = await platformDb
    .select({ value: count(itsmAutomationRules.id) })
    .from(itsmAutomationRules)
    .where(eq(itsmAutomationRules.orgId, orgId))
  return Number(row?.value ?? 0)
}

export async function createAutomationRule(
  orgId: string,
  input: CreateAutomationRuleInput,
) {
  const [row] = await platformDb
    .insert(itsmAutomationRules)
    .values({
      orgId,
      name: input.name,
      description: input.description,
      enabled: input.enabled,
      conditionLogic: input.conditionLogic,
      conditions: input.conditions,
      actions: input.actions,
      cooldownMinutes: input.cooldownMinutes ?? null,
    })
    .returning()
  return row
}

export async function updateAutomationRule(
  orgId: string,
  ruleId: string,
  input: UpdateAutomationRuleInput,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.enabled !== undefined) patch.enabled = input.enabled
  if (input.conditionLogic !== undefined) patch.conditionLogic = input.conditionLogic
  if (input.conditions !== undefined) patch.conditions = input.conditions
  if (input.actions !== undefined) patch.actions = input.actions
  if (input.cooldownMinutes !== undefined)
    patch.cooldownMinutes = input.cooldownMinutes ?? null

  const [row] = await platformDb
    .update(itsmAutomationRules)
    .set(patch)
    .where(
      and(
        eq(itsmAutomationRules.orgId, orgId),
        eq(itsmAutomationRules.id, ruleId),
      ),
    )
    .returning()
  return row ?? null
}

export async function deleteAutomationRule(orgId: string, ruleId: string) {
  const [row] = await platformDb
    .delete(itsmAutomationRules)
    .where(
      and(
        eq(itsmAutomationRules.orgId, orgId),
        eq(itsmAutomationRules.id, ruleId),
      ),
    )
    .returning({ id: itsmAutomationRules.id })
  return row ?? null
}
