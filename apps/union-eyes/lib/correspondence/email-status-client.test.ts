import {describe,expect,it} from 'vitest'
import {readCorrespondenceEmailStatus} from './email-status-client'
import {readMemberDirectorySetup} from '@/lib/client/member-directory-response'
import {ApiShapeError} from '@/lib/client/api-envelope'
describe('confirmed browser responses',()=>{
  it('requires the actual member contact identity and creation result rather than HTTP200 alone',()=>{
    expect(readMemberDirectorySetup({success:true,data:{memberId:'11111111-1111-4111-8111-111111111111',created:false}})).toMatchObject({created:false})
    for(const body of [{success:true},{success:true,data:{created:true}},{success:false,data:{memberId:'11111111-1111-4111-8111-111111111111',created:true}}])
      expect(()=>readMemberDirectorySetup(body)).toThrow(ApiShapeError)
  })
  it('distinguishes a partially accepted queue from confirmed acceptance for every recipient',()=>{
    expect(readCorrespondenceEmailStatus({success:true,data:{state:'queued',accepted:1,total:2}})).toEqual({state:'queued',accepted:1,total:2})
    expect(readCorrespondenceEmailStatus({success:true,data:{state:'accepted',accepted:2,total:2}})).toEqual({state:'accepted',accepted:2,total:2})
    for(const data of [{state:'accepted',accepted:0,total:0},{state:'accepted',accepted:1,total:2},{state:'queued',accepted:-1,total:2},
      {state:'not_queued',accepted:0,total:1},{state:'queued'},{state:'sent',accepted:1,total:1}])
      expect(()=>readCorrespondenceEmailStatus({success:true,data})).toThrow(ApiShapeError)
  })
})
