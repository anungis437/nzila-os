import { z } from 'zod'
import { isCalendarDay } from '@/lib/deadline-engine/deadline-day'

/** Only records created with an explicit member-disclosure decision use this server-owned classification. */
export const MEMBER_VISIBLE_DEADLINE_TYPE = 'ue_case_member_deadline_v1'

const day = z.string().refine(isCalendarDay, 'Invalid calendar day')
export const CreateCaseDeadline = z.object({ id: z.guid(), title: z.string().trim().min(1).max(200), dueDay: day }).strict()
const change = { id: z.guid(), version: z.string().min(1).max(80) }
export const ChangeCaseDeadline = z.discriminatedUnion('action', [
  z.object({ ...change, action: z.literal('reschedule'), dueDay: day }).strict(),
  z.object({ ...change, action: z.literal('complete') }).strict(),
  z.object({ ...change, action: z.literal('cancel') }).strict(),
])


export type CreateCaseDeadlineInput = z.infer<typeof CreateCaseDeadline>
export type ChangeCaseDeadlineInput = z.infer<typeof ChangeCaseDeadline>

export interface CaseDeadlineWire {
  id: string; title: string; dueAt: string; dueDay: string; status: 'pending' | 'completed' | 'cancelled'; version: string
}
