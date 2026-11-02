import { describe, it, expect } from 'vitest'
import { HubSpotContactSchema, HubSpotDealSchema, HubSpotEngagementNoteSchema } from './client'
describe('Zod4 HubSpot string property dictionaries',()=>{
 it('accepts arbitrary string keys',()=>{
  expect(HubSpotContactSchema.safeParse({email:'contact@example.org',properties:{region:'CA'}}).success).toBe(true)
  expect(HubSpotDealSchema.safeParse({name:'Pilot',stage:'qualified',properties:{currency:'CAD'}}).success).toBe(true)
 })
 it('rejects malformed email, property types and missing note body',()=>{
  expect(HubSpotContactSchema.safeParse({email:'invalid'}).success).toBe(false)
  expect(HubSpotContactSchema.safeParse({email:'contact@example.org',properties:{region:123}}).success).toBe(false)
  expect(HubSpotDealSchema.safeParse({name:'Pilot',stage:'qualified',properties:{currency:123}}).success).toBe(false)
  expect(HubSpotEngagementNoteSchema.safeParse({contactId:'x',body:''}).success).toBe(false)
 })
})
