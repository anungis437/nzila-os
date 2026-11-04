import { z } from 'zod'

/**
 * What an organization's own administrator may send when updating its profile. Every field is bounded and typed: the profile is
 * stored as sent and shown to other organizations, so nothing here is free text of unbounded size or a value of the wrong kind.
 * Unknown keys are refused rather than ignored, so a caller cannot learn that a field is silently dropped.
 */
const SETTINGS_MAX_BYTES = 16 * 1024
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A real calendar date written YYYY-MM-DD: `new Date` alone normalizes impossible days (2020-02-31 becomes March), so the date is round-tripped. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const instant = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value
}

const settingsSchema = z
  .record(z.string().max(100), z.unknown())
  .refine((value) => Object.keys(value).length <= 200, 'settings has too many keys')
  .refine((value) => new TextEncoder().encode(JSON.stringify(value)).length <= SETTINGS_MAX_BYTES, 'settings is too large')

export const organizationPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    slug: z.string().trim().toLowerCase().min(2).max(100).regex(SLUG, 'slug must be lowercase letters, digits and single hyphens'),
    display_name: z.string().trim().max(255).nullable(),
    description: z.string().trim().max(2000).nullable(),
    charter_number: z.string().trim().max(100).nullable(),
    affiliation_date: z.string().trim().refine(isCalendarDate, 'affiliation_date must be a calendar date (YYYY-MM-DD)').nullable(),
    status: z.string().trim().min(1).max(50),
    email: z.string().trim().max(254).email().nullable(),
    phone: z.string().trim().max(40).nullable(),
    website: z.string().trim().max(500).url().refine((value) => /^https?:\/\//i.test(value), 'website must be an http or https address').nullable(),
    sectors: z.array(z.string().trim().min(1).max(100)).max(50),
    parent_id: z.guid().nullable(),
    settings: settingsSchema,
  })
  .partial()
  .strict()

export type OrganizationPatch = z.infer<typeof organizationPatchSchema>

/** Settings are merged key by key: a patch that names one key no longer erases the others (rate, remittance day, fiscal year). */
export function mergeSettings(current: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = current && typeof current === 'object' && !Array.isArray(current) ? (current as Record<string, unknown>) : {}
  return { ...base, ...patch }
}
