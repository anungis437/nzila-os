import { z } from 'zod'

export const ConnectorAuthConfig = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
})

export const PatientRecord = z.object({
  id: z.string(),
  mrn: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: z.string().optional(),
  sourceSystem: z.string(),
  organizationId: z.string(),
  siteId: z.string(),
  environment: z.string(),
})

export const EncounterRecord = z.object({
  id: z.string(),
  patientId: z.string(),
  type: z.string(),
  date: z.string(),
  provider: z.string().optional(),
  facility: z.string().optional(),
  summary: z.string().optional(),
  sourceSystem: z.string(),
  organizationId: z.string(),
  siteId: z.string(),
})

export const ObservationRecord = z.object({
  id: z.string(),
  patientId: z.string(),
  category: z.string(),
  code: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  date: z.string(),
  sourceSystem: z.string(),
  organizationId: z.string(),
  siteId: z.string(),
})

export const ConnectorHealthResult = z.object({
  status: z.enum(['ok', 'degraded', 'fail']),
  latencyMs: z.number().optional(),
  message: z.string().optional(),
})

export type ConnectorAuthConfig = z.infer<typeof ConnectorAuthConfig>
export type PatientRecord = z.infer<typeof PatientRecord>
export type EncounterRecord = z.infer<typeof EncounterRecord>
export type ObservationRecord = z.infer<typeof ObservationRecord>
export type ConnectorHealthResult = z.infer<typeof ConnectorHealthResult>

export interface ConnectorProvider {
  name: string
  healthCheck(): Promise<ConnectorHealthResult>
  fetchPatients(orgId: string, siteId: string): Promise<PatientRecord[]>
  fetchEncounters(patientId: string, orgId: string): Promise<EncounterRecord[]>
  fetchObservations(patientId: string, orgId: string): Promise<ObservationRecord[]>
}
