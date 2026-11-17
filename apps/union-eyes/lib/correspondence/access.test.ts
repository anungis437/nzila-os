import {beforeEach,describe,expect,it,vi} from 'vitest'
const h=vi.hoisted(()=>({principal:null as null|{userId:string;organizationId:string;role:string;isSystemAdmin:boolean},tx:{},decide:vi.fn()}))
vi.mock('@/lib/db/canonical-transaction-scope',()=>({canonicalTenantPrincipal:()=>h.principal}))
vi.mock('@/lib/auth/canonical-bootstrap',()=>({currentStateContextEnabled:()=>true}))
vi.mock('@/db/tenant-context-storage',()=>({getActiveTenantDb:()=>h.tx}))
vi.mock('@/lib/authority/store/route-adapter',()=>({decideCase:h.decide}))
import {mayReadCorrespondence,requireCorrespondenceWrite,requireCorrespondenceDisclosure} from './access'
const letter={organizationId:'org-a',grievanceId:'case-a'}
beforeEach(()=>{h.principal={userId:'staff-a',organizationId:'org-a',role:'steward',isSystemAdmin:false};h.decide.mockReset();h.decide.mockResolvedValue({effect:'deny'})})
describe('case-specific correspondence authority',()=>{
  it('requires the existing case kernel for internal reads and drafting actions',async()=>{
    expect(await mayReadCorrespondence(h.tx as never,letter)).toBe(false)
    expect(h.decide).toHaveBeenLastCalledWith(h.tx,{userId:'staff-a',organizationId:'org-a',caseId:'case-a',action:'case:read_internal'})
    await expect(requireCorrespondenceWrite(h.tx as never,letter,'staff-a')).rejects.toMatchObject({code:'NOT_FOUND'})
    expect(h.decide).toHaveBeenLastCalledWith(h.tx,{userId:'staff-a',organizationId:'org-a',caseId:'case-a',action:'case:draft_action'})
    h.decide.mockResolvedValue({effect:'allow'})
    expect(await mayReadCorrespondence(h.tx as never,letter)).toBe(true)
    await expect(requireCorrespondenceWrite(h.tx as never,letter,'staff-a')).resolves.toBeUndefined()
  })
  it.each(['member','system_admin','app_owner','support_agent'])('refuses %s as tenant correspondence authority',async role=>{
    h.principal!.role=role
    await expect(requireCorrespondenceWrite(h.tx as never,letter,'staff-a')).rejects.toThrow()
    expect(h.decide).not.toHaveBeenCalled()
  })
  it('refuses a foreign actor, organization or transaction before a case lookup',async()=>{
    await expect(requireCorrespondenceWrite(h.tx as never,letter,'other')).rejects.toThrow()
    await expect(requireCorrespondenceWrite(h.tx as never,{...letter,organizationId:'other'},'staff-a')).rejects.toThrow()
    await expect(requireCorrespondenceWrite({} as never,letter,'staff-a')).rejects.toThrow()
    expect(h.decide).not.toHaveBeenCalled()
  })
  it('never treats drafting permission as formal member disclosure',async()=>{
    h.decide.mockImplementation(async (_tx,request)=>({effect:request.action==='case:draft_action'?'allow':'deny'}))
    await expect(requireCorrespondenceDisclosure(h.tx as never,letter,'staff-a')).rejects.toMatchObject({code:'FORBIDDEN'})
    expect(h.decide).toHaveBeenLastCalledWith(h.tx,{userId:'staff-a',organizationId:'org-a',caseId:'case-a',action:'case:disclose_to_member'})
    h.decide.mockResolvedValue({effect:'allow'})
    await expect(requireCorrespondenceDisclosure(h.tx as never,letter,'staff-a')).resolves.toBeUndefined()
  })

})
