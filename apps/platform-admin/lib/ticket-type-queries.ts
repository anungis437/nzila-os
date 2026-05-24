/**
 * Platform Admin — Ticket-type field definition queries
 *
 * Org-scoped CRUD over `itsm_ticket_field_defs`. Each row defines one
 * custom field for one ticket type. Uniqueness is enforced at the DB
 * level on (orgId, ticketType, fieldKey); we surface a stable error code
 * `FIELD_KEY_TAKEN` so the UI can show a friendly message.
 *
 * Callers MUST have already verified org membership / write authority.
 */
import { and, asc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { itsmTicketFieldDefs } from '@nzila/db/schema'
import { TICKET_TYPES, type TicketType } from '@nzila/itsm-core'
import { z } from 'zod'

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'select',
  'multiselect',
  'date',
  'boolean',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/

// ── Validation ───────────────────────────────────────────────────────────────

export const createFieldDefSchema = z.object({
  ticketType: z.enum(TICKET_TYPES),
  fieldKey: z
    .string()
    .min(1)
    .max(64)
    .regex(FIELD_KEY_RE, 'must be snake_case starting with a letter'),
  label: z.string().min(1).max(160),
  fieldType: z.enum(FIELD_TYPES),
  options: z.array(z.string().min(1).max(160)).max(50).default([]),
  required: z.boolean().default(false),
  helpText: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
})
export type CreateFieldDefInput = z.infer<typeof createFieldDefSchema>

export const updateFieldDefSchema = createFieldDefSchema
  .omit({ ticketType: true, fieldKey: true })
  .partial()
export type UpdateFieldDefInput = z.infer<typeof updateFieldDefSchema>

// ── Row shape ────────────────────────────────────────────────────────────────

export interface FieldDefRow {
  id: string
  ticketType: TicketType
  fieldKey: string
  label: string
  fieldType: FieldType
  options: string[]
  required: boolean
  helpText: string | null
  sortOrder: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

function toRow(r: typeof itsmTicketFieldDefs.$inferSelect): FieldDefRow {
  const opts = Array.isArray(r.options) ? (r.options as unknown[]) : []
  return {
    id: r.id,
    ticketType: r.ticketType as TicketType,
    fieldKey: r.fieldKey,
    label: r.label,
    fieldType: r.fieldType as FieldType,
    options: opts.filter((v): v is string => typeof v === 'string'),
    required: r.required,
    helpText: r.helpText,
    sortOrder: r.sortOrder,
    active: r.active,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listFieldDefs(orgId: string): Promise<FieldDefRow[]> {
  const rows = await platformDb
    .select()
    .from(itsmTicketFieldDefs)
    .where(eq(itsmTicketFieldDefs.orgId, orgId))
    .orderBy(asc(itsmTicketFieldDefs.ticketType), asc(itsmTicketFieldDefs.sortOrder))
  return rows.map(toRow)
}

export async function listFieldDefsForType(
  orgId: string,
  ticketType: TicketType,
): Promise<FieldDefRow[]> {
  const rows = await platformDb
    .select()
    .from(itsmTicketFieldDefs)
    .where(
      and(
        eq(itsmTicketFieldDefs.orgId, orgId),
        eq(itsmTicketFieldDefs.ticketType, ticketType),
      ),
    )
    .orderBy(asc(itsmTicketFieldDefs.sortOrder))
  return rows.map(toRow)
}

export type FieldDefMutationResult =
  | { ok: true; data: FieldDefRow }
  | { ok: false; error: 'FIELD_KEY_TAKEN' | 'NOT_FOUND' }

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const cause = (err as { cause?: { code?: string } }).cause
  if (cause?.code === '23505') return true
  const direct = (err as { code?: string }).code
  return direct === '23505'
}

export async function createFieldDef(
  orgId: string,
  input: CreateFieldDefInput,
): Promise<FieldDefMutationResult> {
  try {
    const [row] = await platformDb
      .insert(itsmTicketFieldDefs)
      .values({
        orgId,
        ticketType: input.ticketType,
        fieldKey: input.fieldKey,
        label: input.label,
        fieldType: input.fieldType,
        options: input.options,
        required: input.required,
        helpText: input.helpText,
        sortOrder: input.sortOrder,
        active: input.active,
      })
      .returning()
    return { ok: true, data: toRow(row) }
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'FIELD_KEY_TAKEN' }
    throw err
  }
}

export async function updateFieldDef(
  orgId: string,
  fieldId: string,
  input: UpdateFieldDefInput,
): Promise<FieldDefMutationResult> {
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (input.label !== undefined) patch.label = input.label
  if (input.fieldType !== undefined) patch.fieldType = input.fieldType
  if (input.options !== undefined) patch.options = input.options
  if (input.required !== undefined) patch.required = input.required
  if (input.helpText !== undefined) patch.helpText = input.helpText
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.active !== undefined) patch.active = input.active

  const [row] = await platformDb
    .update(itsmTicketFieldDefs)
    .set(patch)
    .where(
      and(
        eq(itsmTicketFieldDefs.orgId, orgId),
        eq(itsmTicketFieldDefs.id, fieldId),
      ),
    )
    .returning()
  if (!row) return { ok: false, error: 'NOT_FOUND' }
  return { ok: true, data: toRow(row) }
}

export async function deleteFieldDef(orgId: string, fieldId: string) {
  const [row] = await platformDb
    .delete(itsmTicketFieldDefs)
    .where(
      and(
        eq(itsmTicketFieldDefs.orgId, orgId),
        eq(itsmTicketFieldDefs.id, fieldId),
      ),
    )
    .returning({ id: itsmTicketFieldDefs.id })
  return row ?? null
}
