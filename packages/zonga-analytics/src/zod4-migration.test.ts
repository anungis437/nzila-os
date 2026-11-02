import { describe, it, expect } from 'vitest'
import { playEventSchema, skipEventSchema } from './events'
const valid={assetId:'550e8400-e29b-41d4-a716-446655440000',creatorId:'550e8400-e29b-41d4-a716-446655440001',durationMs:3000,positionMs:1000,completionPercent:33,quality:'high',isComplete:false,source:'playlist'}
describe('Zod4 analytics event validation',()=>{
 it('accepts valid events',()=>{
  expect(playEventSchema.safeParse(valid).success).toBe(true)
  expect(skipEventSchema.safeParse({assetId:valid.assetId,creatorId:valid.creatorId,positionMs:100,durationMs:3000,reason:'manual'}).success).toBe(true)
 })
 it('rejects malformed UUID, durations and enums',()=>{
  for(const change of [{assetId:'invalid'},{durationMs:-1},{completionPercent:101},{source:'forged'}])
   expect(playEventSchema.safeParse({...valid,...change}).success).toBe(false)
  expect(skipEventSchema.safeParse({assetId:valid.assetId,creatorId:valid.creatorId,positionMs:100,durationMs:0,reason:'forged'}).success).toBe(false)
 })
})
