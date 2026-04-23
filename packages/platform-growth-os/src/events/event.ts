/**
 * @nzila/platform-growth-os — Conference/Event pipeline CRUD
 */
import { z } from 'zod'
import { listRecords, readRecord, writeRecord } from '../store'
import { makeId, nowISO } from '../utils'
import type {
  ConferenceEvent,
  ConferencePlaybookState,
  EventLead,
  EventLeadStatus,
  PlaybookPhase,
} from './types'

// ── Schemas ─────────────────────────────────────────────────────────────────

const eventSchema = z.object({
  id: z.string().min(1),
  scope: z.object({ tenantId: z.string(), orgId: z.string(), product: z.string().optional() }),
  name: z.string().min(1),
  eventType: z.string(),
  location: z.string().nullable(),
  province: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  attendanceCount: z.number().int().nonnegative().nullable(),
  leadsCaptered: z.number().int().nonnegative(),
  demosBooked: z.number().int().nonnegative(),
  debrief: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const leadSchema = z.object({
  id: z.string().min(1),
  scope: z.object({ tenantId: z.string(), orgId: z.string(), product: z.string().optional() }),
  eventId: z.string(),
  contactName: z.string().min(1),
  contactEmail: z.string().email().nullable(),
  contactTitle: z.string().nullable(),
  rawOrgName: z.string(),
  resolvedTargetOrgId: z.string().nullable(),
  localNumber: z.string().nullable(),
  memberCountEstimate: z.number().int().nonnegative().nullable(),
  captureMethod: z.string(),
  status: z.enum([
    'captured', 'qualified', 'enrolled_sequence', 'demo_booked',
    'demo_completed', 'converted', 'disqualified',
  ]),
  conversationNotes: z.string(),
  painPointsDiscussed: z.array(z.string()),
  sequenceInstanceId: z.string().nullable(),
  dealEngineId: z.string().nullable(),
  capturedAt: z.string(),
  updatedAt: z.string(),
})

const EVENT_ENTITY = 'conf-event'
const LEAD_ENTITY  = 'event-lead'

// ── ConferenceEvent ───────────────────────────────────────────────────────────

export type CreateEventInput = Omit<ConferenceEvent, 'id' | 'leadsCaptered' | 'demosBooked' | 'debrief' | 'createdAt' | 'updatedAt'>

export function createConferenceEvent(input: CreateEventInput): ConferenceEvent {
  const now = nowISO()
  const record: ConferenceEvent = {
    id: makeId('evt'),
    ...input,
    leadsCaptered: 0,
    demosBooked: 0,
    debrief: '',
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord(EVENT_ENTITY, record.id, record, eventSchema) as ConferenceEvent
}

export function getConferenceEvent(id: string): ConferenceEvent | null {
  return readRecord(EVENT_ENTITY, id, eventSchema) as ConferenceEvent | null
}

export function listConferenceEvents(): ConferenceEvent[] {
  return listRecords(EVENT_ENTITY, eventSchema) as ConferenceEvent[]
}

// ── EventLead ─────────────────────────────────────────────────────────────────

export interface CaptureLeadInput {
  scope: EventLead['scope']
  eventId: string
  contactName: string
  contactEmail?: string | null
  contactTitle?: string | null
  rawOrgName: string
  localNumber?: string | null
  memberCountEstimate?: number | null
  captureMethod: EventLead['captureMethod']
  conversationNotes?: string
  painPointsDiscussed?: string[]
}

export function captureEventLead(input: CaptureLeadInput): EventLead {
  const now = nowISO()
  const record: EventLead = {
    id: makeId('el'),
    scope: input.scope,
    eventId: input.eventId,
    contactName: input.contactName,
    contactEmail: input.contactEmail ?? null,
    contactTitle: input.contactTitle ?? null,
    rawOrgName: input.rawOrgName,
    resolvedTargetOrgId: null,
    localNumber: input.localNumber ?? null,
    memberCountEstimate: input.memberCountEstimate ?? null,
    captureMethod: input.captureMethod,
    status: 'captured',
    conversationNotes: input.conversationNotes ?? '',
    painPointsDiscussed: input.painPointsDiscussed ?? [],
    sequenceInstanceId: null,
    dealEngineId: null,
    capturedAt: now,
    updatedAt: now,
  }
  return writeRecord(LEAD_ENTITY, record.id, record, leadSchema) as EventLead
}

export function getEventLead(id: string): EventLead | null {
  return readRecord(LEAD_ENTITY, id, leadSchema) as EventLead | null
}

export function listEventLeads(eventId?: string): EventLead[] {
  const all = listRecords(LEAD_ENTITY, leadSchema) as EventLead[]
  if (!eventId) return all
  return all.filter((l) => l.eventId === eventId)
}

export function updateLeadStatus(
  id: string,
  status: EventLeadStatus,
  patch?: Partial<Pick<EventLead, 'sequenceInstanceId' | 'dealEngineId' | 'resolvedTargetOrgId'>>,
): EventLead | null {
  const existing = getEventLead(id)
  if (!existing) return null
  const updated: EventLead = { ...existing, ...patch, status, updatedAt: nowISO() }
  return writeRecord(LEAD_ENTITY, id, updated, leadSchema) as EventLead
}

// ── Playbook state helper ─────────────────────────────────────────────────────

export function computePlaybookState(eventId: string): ConferencePlaybookState | null {
  const event = getConferenceEvent(eventId)
  if (!event) return null

  const leads = listEventLeads(eventId)
  const now = Date.now()
  const startMs = Date.parse(event.startDate)
  const daysSinceStart = (now - startMs) / 86400000

  let phase: PlaybookPhase
  if (daysSinceStart < 0) phase = 'pre_event'
  else if (daysSinceStart < 1) phase = 'at_event'
  else if (daysSinceStart < 1.5) phase = 'day0'
  else if (daysSinceStart < 3) phase = 'day2'
  else if (daysSinceStart < 7) phase = 'day5'
  else if (daysSinceStart < 11) phase = 'day10'
  else phase = 'post_event'

  return {
    eventId,
    currentPhase: phase,
    totalLeads: leads.length,
    enrolled: leads.filter((l) => l.sequenceInstanceId != null).length,
    demosBooked: leads.filter((l) => l.status === 'demo_booked' || l.status === 'demo_completed').length,
    pilotsProposed: leads.filter((l) => l.dealEngineId != null).length,
    pilotsSigned: leads.filter((l) => l.status === 'converted').length,
    lastUpdatedAt: nowISO(),
  }
}
