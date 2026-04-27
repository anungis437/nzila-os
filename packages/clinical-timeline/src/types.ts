import { z } from 'zod'

export enum TimelineEventSource {
  FHIR = 'FHIR',
  HL7V2 = 'HL7V2',
  CSV = 'CSV',
  MANUAL = 'MANUAL',
}

export enum TimelineEventCategory {
  ENCOUNTER = 'ENCOUNTER',
  LAB = 'LAB',
  MEDICATION = 'MEDICATION',
  REFERRAL = 'REFERRAL',
  NOTE = 'NOTE',
  IMAGING = 'IMAGING',
  PROCEDURE = 'PROCEDURE',
}

export enum TimelineFlag {
  DUPLICATE_SUSPECTED = 'DUPLICATE_SUSPECTED',
  INCOMPLETE_RECORD = 'INCOMPLETE_RECORD',
  CONSENT_RESTRICTED = 'CONSENT_RESTRICTED',
  BREAK_GLASS_ACCESS = 'BREAK_GLASS_ACCESS',
}

export const TimelineEventSourceSchema = z.nativeEnum(TimelineEventSource)
export const TimelineEventCategorySchema = z.nativeEnum(TimelineEventCategory)
export const TimelineFlagSchema = z.nativeEnum(TimelineFlag)

export const TimelineEvent = z.object({
  id: z.string(),
  patientId: z.string(),
  organizationId: z.string(),
  siteId: z.string(),
  date: z.string(),
  category: TimelineEventCategorySchema,
  source: TimelineEventSourceSchema,
  title: z.string(),
  summary: z.string().optional(),
  provider: z.string().optional(),
  facility: z.string().optional(),
  flags: z.array(TimelineFlagSchema),
  rawSourceId: z.string().optional(),
  mergedFrom: z.array(z.string()).optional(),
})

export type TimelineEvent = z.infer<typeof TimelineEvent>
