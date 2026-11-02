import { describe, expect, it } from 'vitest'
import { createCustomerSchema, paginationSchema, quoteLineInputSchema } from './schemas/index.js'

describe('Zod 4 commerce ingress compatibility', () => {
  it('preserves customer defaults and string-key external IDs', () => {
    const parsed=createCustomerSchema.parse({name:'Client',externalIds:{erp:'A-123'}})
    expect(parsed.externalIds).toEqual({erp:'A-123'})
    expect(parsed.email).toBeNull()
    expect(parsed.phone).toBeNull()
    expect(createCustomerSchema.parse({name:'Client'}).externalIds).toEqual({})
  })
  it('rejects malformed external IDs and missing customer identity', () => {
    expect(createCustomerSchema.safeParse({name:'Client',externalIds:{erp:42}}).success).toBe(false)
    expect(createCustomerSchema.safeParse({name:'Client',externalIds:[]}).success).toBe(false)
    expect(createCustomerSchema.safeParse({name:''}).success).toBe(false)
  })
  it('retains bounded pagination and noncoercing quote quantities', () => {
    expect(paginationSchema.parse({}).pageSize).toBe(20)
    expect(paginationSchema.parse({page:'2',pageSize:'100'}).page).toBe(2)
    expect(paginationSchema.safeParse({pageSize:101}).success).toBe(false)
    expect(quoteLineInputSchema.safeParse({itemName:'Item',quantity:'2',unitCost:1}).success).toBe(false)
  })
})
