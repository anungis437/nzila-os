import { describe, expect, it } from 'vitest'
import { AccessRequestSchema, PolicySetSchema } from './schemas.js'

describe('Zod 4 governance schema compatibility', () => {
  const request={actor:{id:'u',orgId:'org-a',roles:['member'],attributes:{score:1}},
    resource:{type:'claim',orgId:'org-b',attributes:{restricted:true}},
    action:'read',context:{nested:{source:'api'}}}
  it('preserves actor and resource identity and dictionary values', () => {
    const parsed=AccessRequestSchema.parse(request)
    expect(parsed.actor.orgId).toBe('org-a')
    expect(parsed.resource.orgId).toBe('org-b')
    expect(parsed.context).toEqual({nested:{source:'api'}})
  })
  it('rejects malformed roles and records', () => {
    expect(AccessRequestSchema.safeParse({...request,actor:{...request.actor,roles:'member'}}).success).toBe(false)
    expect(AccessRequestSchema.safeParse({...request,context:[]}).success).toBe(false)
    expect(AccessRequestSchema.safeParse({...request,actor:{...request.actor,attributes:[]}}).success).toBe(false)
  })
  it('retains deny-by-default and priority defaults', () => {
    const policy={id:'p',name:'Policy',rules:[{id:'r',resource:'claim',actions:['read'],effect:'allow'}]}
    const parsed=PolicySetSchema.parse(policy)
    expect(parsed.defaultEffect).toBe('deny')
    expect(parsed.rules[0]?.priority).toBe(0)
    expect(PolicySetSchema.safeParse({...policy,rules:[{...policy.rules[0],effect:'permit'}]}).success).toBe(false)
  })
})
