import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'

/** Parse only the tag fields owned by the route, respecting varchar(100). */
const name = z.string().trim().min(1).max(100)
const base = { tagName: name.optional(), tag: name.optional() }
const addSchema = z.strictObject(base).superRefine((value, ctx) => {
  if (!value.tagName && !value.tag) {
    ctx.addIssue({ code: 'custom', message: 'tagName is required' })
  }
  if (value.tagName && value.tag && value.tagName !== value.tag) {
    ctx.addIssue({ code: 'custom', message: 'Conflicting tag names' })
  }
})
const removeSchema = z.strictObject({ ...base, tagId: z.guid().optional() }).superRefine((value, ctx) => {
  const hasName = Boolean(value.tagName || value.tag)
  if (value.tagName && value.tag && value.tagName !== value.tag) {
    ctx.addIssue({ code: 'custom', message: 'Conflicting tag names' })
  }
  if (Number(hasName) + Number(Boolean(value.tagId)) !== 1) {
    ctx.addIssue({ code: 'custom', message: 'Specify exactly one of tagId or tagName' })
  }
})

export function parseClauseTagBody(raw: unknown, operation: 'add' | 'remove'): {
  tagName?: string
  tagId?: string
} {
  const result = (operation === 'add' ? addSchema : removeSchema).safeParse(raw)
  if (!result.success) {
    throw ApiError.badRequest(`Invalid clause tag: ${result.error.issues[0]?.message ?? 'malformed body'}`)
  }
  return {
    ...(result.data.tagName || result.data.tag ? { tagName: result.data.tagName ?? result.data.tag } : {}),
    ...((result.data as { tagId?: string }).tagId ? { tagId: (result.data as { tagId?: string }).tagId } : {}),
  }
}
