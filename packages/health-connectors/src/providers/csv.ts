// SYNTHETIC DEMO DATA ONLY - no real patient records
import type {
  ConnectorProvider,
  ConnectorHealthResult,
  PatientRecord,
  EncounterRecord,
  ObservationRecord,
} from '../types.js'

export class CSVProvider implements ConnectorProvider {
  readonly name = 'csv'

  async healthCheck(): Promise<ConnectorHealthResult> {
    return { status: 'ok', latencyMs: 5 }
  }

  async fetchPatients(orgId: string, siteId: string): Promise<PatientRecord[]> {
    return [
      {
        id: 'syn-csv-patient-001',
        mrn: 'CSV-MRN-001',
        firstName: 'Bob',
        lastName: 'Testdata',
        dateOfBirth: '1952-03-14',
        gender: 'male',
        sourceSystem: 'csv',
        organizationId: orgId,
        siteId,
        environment: 'demo',
      },
    ]
  }

  async fetchEncounters(patientId: string, orgId: string): Promise<EncounterRecord[]> {
    return [
      {
        id: 'syn-csv-encounter-001',
        patientId,
        type: 'outpatient',
        date: '2024-04-05',
        provider: 'Dr. CSV',
        facility: 'Demo CSV Clinic',
        summary: 'Annual wellness visit',
        sourceSystem: 'csv',
        organizationId: orgId,
        siteId: 'site-001',
      },
    ]
  }

  async fetchObservations(patientId: string, orgId: string): Promise<ObservationRecord[]> {
    return [
      {
        id: 'syn-csv-obs-001',
        patientId,
        category: 'vital-signs',
        code: '8867-4',
        value: '72',
        unit: 'bpm',
        date: '2024-04-05',
        sourceSystem: 'csv',
        organizationId: orgId,
        siteId: 'site-001',
      },
    ]
  }
}
