import {ApiShapeError,envelopeData,isRecord} from './api-envelope'
export interface MemberDirectorySetup {memberId:string;created:boolean}
export function readMemberDirectorySetup(body:unknown):MemberDirectorySetup {
  const row=envelopeData(body)
  if(!isRecord(body)||body.success!==true||typeof row.memberId!=='string'
    ||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.memberId)
    ||typeof row.created!=='boolean')throw new ApiShapeError('member directory setup is unconfirmed')
  return {memberId:row.memberId,created:row.created}
}
