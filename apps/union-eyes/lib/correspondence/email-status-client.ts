import {ApiShapeError,envelopeData,isRecord} from '@/lib/client/api-envelope'
const STATES=['not_queued','queued','review_required','accepted','cancelled'] as const
export type CorrespondenceEmailState=typeof STATES[number]
export interface CorrespondenceEmailStatus {state:CorrespondenceEmailState;accepted:number;total:number}
export function readCorrespondenceEmailStatus(body:unknown):CorrespondenceEmailStatus {
  const row=envelopeData(body)
  if(!isRecord(body)||body.success!==true||typeof row.state!=='string'||!(STATES as readonly string[]).includes(row.state)
    ||typeof row.accepted!=='number'||typeof row.total!=='number'||!Number.isSafeInteger(row.accepted)||!Number.isSafeInteger(row.total)
    ||row.accepted<0||row.total<0||row.total>20||row.accepted>row.total
    ||row.state==='accepted'&&(row.total===0||row.accepted!==row.total)
    ||['not_queued','cancelled'].includes(row.state)&&(row.total!==0||row.accepted!==0))throw new ApiShapeError('correspondence email status is unconfirmed')
  return {state:row.state as CorrespondenceEmailState,accepted:row.accepted,total:row.total}
}
