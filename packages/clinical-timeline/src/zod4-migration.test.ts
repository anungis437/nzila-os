import { describe, it, expect } from 'vitest'
import { TimelineEvent, TimelineEventCategory, TimelineEventSource, TimelineFlag } from './types'
const valid = { id:'event-1',patientId:'patient-1',organizationId:'org-1',siteId:'site-1',date:'2026-10-30',category:TimelineEventCategory.ENCOUNTER,source:TimelineEventSource.FHIR,title:'Encounter',flags:[TimelineFlag.CONSENT_RESTRICTED] }
describe('Zod4 timeline enum boundaries',()=>{
 it('accepts valid event',()=>expect(TimelineEvent.safeParse(valid).success).toBe(true))
 it('rejects invalid source, category, flag and tenant type',()=>{
  for(const change of [{source:'forged'},{category:'forged'},{flags:['forged']},{organizationId:7}])
   expect(TimelineEvent.safeParse({...valid,...change}).success).toBe(false)
 })
})
