import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { partialWithoutDefaults } from '../partial-without-defaults'
import { updateMemberEmploymentSchema } from '../member-employment-schemas'
import { updateProgramSchema } from '../rewards-schemas'

describe('zod 4 migration semantics', () => {
  const create = z.object({ name: z.string().min(1), currency: z.string().length(3).default('CAD'), active: z.boolean().default(true).optional() }).strict()

  it('shows the hazard: zod 4 .partial() re-applies creation defaults, so a PATCH would reset omitted fields', () => {
    expect(create.partial().parse({})).toMatchObject({ currency: 'CAD' })
  })

  it('partialWithoutDefaults leaves omitted fields omitted, applies given ones and stays strict', () => {
    const update = partialWithoutDefaults(create)
    expect(update.parse({})).toEqual({})
    expect(update.parse({ currency: 'USD' })).toMatchObject({ currency: 'USD' })
    expect(update.safeParse({ unknown: 1 }).success).toBe(false)
    expect(update.safeParse({ currency: 'US' }).success).toBe(false)
  })

  it('the real update schemas no longer reset omitted fields', () => {
    expect(updateProgramSchema.parse({})).toEqual({})
    const parsed = updateMemberEmploymentSchema.parse({ id: '11111111-1111-1111-1111-111111111111' })
    expect(Object.keys(parsed)).toEqual(['id'])
  })

  it('ZodError exposes issues (not errors) with a joinable path', () => {
    const error = z.object({ a: z.object({ b: z.guid() }) }).safeParse({ a: { b: 'x' } }).error!
    expect((error as unknown as { errors?: unknown }).errors).toBeUndefined()
    expect(error.issues[0].path.map(String).join('.')).toBe('a.b')
  })

  it('identifiers keep the zod 3 shape check, so non-RFC fixture and fixed identifiers still validate', () => {
    expect(z.guid().safeParse('11111111-1111-1111-1111-111111111111').success).toBe(true)
    expect(z.guid().safeParse('not-a-uuid').success).toBe(false)
  })
})
