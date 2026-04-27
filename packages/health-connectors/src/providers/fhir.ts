// SYNTHETIC DEMO DATA ONLY - no real patient records
import type {
  ConnectorProvider,
  ConnectorHealthResult,
  PatientRecord,
  EncounterRecord,
  ObservationRecord,
} from '../types.js'

export class FHIRProvider implements ConnectorProvider {
  readonly name = 'fhir'

  async healthCheck(): Promise<ConnectorHealthResult> {
    return { status: 'ok', latencyMs: 42 }
  }

  async fetchPatients(orgId: string, siteId: string): Promise<PatientRecord[]> {
    return [
      {
        id: 'syn-patient-001',
        mrn: 'MRN-001',
        firstName: 'Jane',
        lastName: 'Demo',
        dateOfBirth: '1980-05-15',
        gender: 'female',
        sourceSystem: 'fhir',
        organizationId: orgId,
        siteId,
        environment: 'demo',
      },
      {
        id: 'syn-patient-002',
        mrn: 'MRN-002',
        firstName: 'John',
        lastName: 'Sample',
        dateOfBirth: '1975-11-22',
        gender: 'male',
        sourceSystem: 'fhir',
        organizationId: orgId,
        siteId,
        environment: 'demo',
      },
    ]
  }

  async fetchEncounters(patientId: string, orgId: string): Promise<EncounterRecord[]> {
    return [
      {
        id: 'syn-encounter-001',
        patientId,
        type: 'outpatient',
        date: '2024-01-15',
        provider: 'Dr. Demo',
        facility: 'Demo Clinic',
        summary: 'Routine checkup',
        sourceSystem: 'fhir',
        organizationId: orgId,
        siteId: 'site-001',
      },
      {
        id: 'syn-encounter-002',
        patientId,
        type: 'emergency',
        date: '2024-03-20',
        provider: 'Dr. Sample',
        facility: 'Demo Hospital',
        summary: 'Acute care visit',
        sourceSystem: 'fhir',
        organizationId: orgId,
        siteId: 'site-001',
      },
    ]
  }

  async fetchObservations(patientId: string, orgId: string): Promise<ObservationRecord[]> {
    return [
      {
        id: 'syn-obs-001',
        patientId,
        category: 'vital-signs',
        code: '55284-4',
        value: '120/80',
        unit: 'mmHg',
        date: '2024-01-15',
        sourceSystem: 'fhir',
        organizationId: orgId,
        siteId: 'site-001',
      },
      {
        id: 'syn-obs-002',
        patientId,
        category: 'laboratory',
        code: '2339-0',
        value: '5.4',
        unit: 'mmol/L',
        date: '2024-01-15',
        sourceSystem: 'fhir',
        organizationId: orgId,
        siteId: 'site-001',
      },
    ]
  }
}
