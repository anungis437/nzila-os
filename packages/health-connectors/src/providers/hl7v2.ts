// SYNTHETIC DEMO DATA ONLY - no real patient records
import type {
  ConnectorProvider,
  ConnectorHealthResult,
  PatientRecord,
  EncounterRecord,
  ObservationRecord,
} from '../types.js'

export class HL7v2Provider implements ConnectorProvider {
  readonly name = 'hl7v2'

  async healthCheck(): Promise<ConnectorHealthResult> {
    return { status: 'ok', latencyMs: 15 }
  }

  async fetchPatients(orgId: string, siteId: string): Promise<PatientRecord[]> {
    return [
      {
        id: 'syn-hl7-patient-001',
        mrn: 'HL7-MRN-001',
        firstName: 'Alice',
        lastName: 'Synthetic',
        dateOfBirth: '1965-08-30',
        gender: 'female',
        sourceSystem: 'hl7v2',
        organizationId: orgId,
        siteId,
        environment: 'demo',
      },
    ]
  }

  async fetchEncounters(patientId: string, orgId: string): Promise<EncounterRecord[]> {
    return [
      {
        id: 'syn-hl7-encounter-001',
        patientId,
        type: 'inpatient',
        date: '2024-02-10',
        provider: 'Dr. HL7',
        facility: 'Demo Hospital HL7',
        summary: 'Scheduled procedure',
        sourceSystem: 'hl7v2',
        organizationId: orgId,
        siteId: 'site-001',
      },
    ]
  }

  async fetchObservations(patientId: string, orgId: string): Promise<ObservationRecord[]> {
    return [
      {
        id: 'syn-hl7-obs-001',
        patientId,
        category: 'laboratory',
        code: '718-7',
        value: '13.5',
        unit: 'g/dL',
        date: '2024-02-10',
        sourceSystem: 'hl7v2',
        organizationId: orgId,
        siteId: 'site-001',
      },
    ]
  }
}
