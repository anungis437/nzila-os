import { describe, it, expect } from 'vitest'
import { AccessDecisionInput, AuditEvent, ConsentRole, ConsentScope } from './types'
const valid = {actorId:'actor-1',role:ConsentRole.CLINICIAN,patientId:'patient-1',organizationId:'org-1',siteId:'site-1',requestedScope:ConsentScope.READ_LABS}
describe('Zod4 consent authorization boundaries',()=>{
 it('accepts known role and scope',()=>expect(AccessDecisionInput.safeParse(valid).success).toBe(true))
 it('rejects unknown roles, scopes and tenant identifiers',()=>{
  for(const change of [{role:'ROOT'},{requestedScope:'ALL'},{organizationId:42},{patientId:null}])
   expect(AccessDecisionInput.safeParse({...valid,...change}).success).toBe(false)
 })
 it('rejects unknown audit roles',()=>{
  const audit={actorId:'actor-1',role:ConsentRole.CLINICIAN,tenantId:'org-1',siteId:'site-1',patientId:'patient-1',action:'read',timestamp:'2026-10-30T12:00:00Z'}
  expect(AuditEvent.safeParse(audit).success).toBe(true)
  expect(AuditEvent.safeParse({...audit,role:'ROOT'}).success).toBe(false)
 })
})
