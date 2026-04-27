// SYNTHETIC DEMO DATA ONLY — no real patient records. All data is fabricated for demonstration purposes.

export interface Encounter {
  date: string
  type: string
  provider: string
  facility: string
  summary: string
}

export interface LabResult {
  date: string
  code: string
  name: string
  value: string
  unit: string
  status: 'normal' | 'abnormal'
}

export interface Medication {
  name: string
  dose: string
  frequency: string
  prescribedBy: string
  startDate: string
  status: 'active' | 'discontinued'
}

export interface Referral {
  to: string
  reason: string
  date: string
  status: 'pending' | 'completed' | 'overdue'
}

export interface AccessEvent {
  actorId: string
  role: string
  action: string
  timestamp: string
  reason?: string
}

export interface SyntheticPatient {
  id: string
  mrn: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  organizationId: 'demo-org'
  siteId: 'demo-site'
  environment: 'demo'
  encounters: Encounter[]
  labs: LabResult[]
  medications: Medication[]
  referrals: Referral[]
  accessLog: AccessEvent[]
}

export const SYNTHETIC_PATIENTS: SyntheticPatient[] = [
  {
    id: 'syn-001',
    mrn: 'MRN-DEMO-1001',
    firstName: 'Alex',
    lastName: 'Chen-Demo',
    dateOfBirth: '1978-04-12',
    gender: 'Non-binary',
    organizationId: 'demo-org',
    siteId: 'demo-site',
    environment: 'demo',
    encounters: [
      {
        date: '2024-11-18',
        type: 'Outpatient visit',
        provider: 'Dr. M. Okoro (Demo)',
        facility: 'Veridian Health Centre (Demo)',
        summary: 'Follow-up for hypertension management. BP 138/88. Medication adjusted.',
      },
      {
        date: '2024-09-05',
        type: 'Emergency visit',
        provider: 'Dr. T. Svensson (Demo)',
        facility: 'Demo General Hospital',
        summary: 'Chest discomfort. ECG unremarkable. Troponin negative. Discharged with cardiology referral.',
      },
      {
        date: '2024-06-22',
        type: 'Specialist consult',
        provider: 'Dr. P. Nakamura (Demo)',
        facility: 'Veridian Cardiology Clinic (Demo)',
        summary: 'Cardiology initial consultation. Echo ordered. Stress test booked.',
      },
    ],
    labs: [
      { date: '2024-11-18', code: 'HBA1C', name: 'HbA1c', value: '6.1', unit: '%', status: 'normal' },
      { date: '2024-11-18', code: 'LDL', name: 'LDL Cholesterol', value: '3.8', unit: 'mmol/L', status: 'abnormal' },
      { date: '2024-09-05', code: 'TROP', name: 'Troponin I', value: '0.01', unit: 'ng/mL', status: 'normal' },
      { date: '2024-06-22', code: 'EGFR', name: 'eGFR', value: '72', unit: 'mL/min/1.73m²', status: 'normal' },
    ],
    medications: [
      { name: 'Ramipril 5mg', dose: '5mg', frequency: 'Once daily', prescribedBy: 'Dr. M. Okoro (Demo)', startDate: '2023-03-10', status: 'active' },
      { name: 'Atorvastatin 20mg', dose: '20mg', frequency: 'Once daily at night', prescribedBy: 'Dr. M. Okoro (Demo)', startDate: '2024-11-18', status: 'active' },
      { name: 'ASA 81mg', dose: '81mg', frequency: 'Once daily', prescribedBy: 'Dr. T. Svensson (Demo)', startDate: '2024-09-05', status: 'active' },
    ],
    referrals: [
      { to: 'Cardiology — Veridian Demo Clinic', reason: 'Chest discomfort, outpatient workup', date: '2024-09-05', status: 'completed' },
      { to: 'Stress Echo Lab — Demo Site', reason: 'Cardiology-ordered stress test', date: '2024-06-22', status: 'pending' },
    ],
    accessLog: [
      { actorId: 'clinician-demo-01', role: 'CLINICIAN', action: 'READ_TIMELINE', timestamp: '2024-11-18T09:14:00Z' },
      { actorId: 'clinician-demo-02', role: 'SPECIALIST', action: 'READ_FULL', timestamp: '2024-09-05T14:32:00Z', reason: 'Cardiology referral review' },
    ],
  },
  {
    id: 'syn-002',
    mrn: 'MRN-DEMO-1002',
    firstName: 'Jordan',
    lastName: 'Smith-Demo',
    dateOfBirth: '1991-08-30',
    gender: 'Female',
    organizationId: 'demo-org',
    siteId: 'demo-site',
    environment: 'demo',
    encounters: [
      {
        date: '2024-12-02',
        type: 'Outpatient visit',
        provider: 'Dr. A. Patel (Demo)',
        facility: 'Veridian Family Health (Demo)',
        summary: 'Annual wellness visit. BMI 24. No new concerns. Bloodwork ordered.',
      },
      {
        date: '2024-07-14',
        type: 'Urgent care',
        provider: 'Dr. L. Bergman (Demo)',
        facility: 'Demo Urgent Care Centre',
        summary: 'Acute sinusitis. Prescribed amoxicillin 500mg for 7 days.',
      },
    ],
    labs: [
      { date: '2024-12-02', code: 'TSH', name: 'TSH', value: '2.4', unit: 'mIU/L', status: 'normal' },
      { date: '2024-12-02', code: 'CBC', name: 'Hemoglobin', value: '118', unit: 'g/L', status: 'abnormal' },
      { date: '2024-12-02', code: 'FERR', name: 'Ferritin', value: '11', unit: 'µg/L', status: 'abnormal' },
    ],
    medications: [
      { name: 'Iron Supplement 325mg', dose: '325mg', frequency: 'Twice daily with food', prescribedBy: 'Dr. A. Patel (Demo)', startDate: '2024-12-02', status: 'active' },
      { name: 'Amoxicillin 500mg', dose: '500mg', frequency: 'Three times daily', prescribedBy: 'Dr. L. Bergman (Demo)', startDate: '2024-07-14', status: 'discontinued' },
    ],
    referrals: [
      { to: 'Hematology — Demo Outpatient', reason: 'Microcytic anaemia, low ferritin, further investigation', date: '2024-12-02', status: 'pending' },
    ],
    accessLog: [
      { actorId: 'clinician-demo-03', role: 'CLINICIAN', action: 'READ_LABS', timestamp: '2024-12-02T11:05:00Z' },
      { actorId: 'clinician-demo-01', role: 'CLINICIAN', action: 'READ_MEDICATIONS', timestamp: '2024-12-02T11:07:00Z' },
    ],
  },
  {
    id: 'syn-003',
    mrn: 'MRN-DEMO-1003',
    firstName: 'Sam',
    lastName: 'Rivera-Demo',
    dateOfBirth: '1955-01-19',
    gender: 'Male',
    organizationId: 'demo-org',
    siteId: 'demo-site',
    environment: 'demo',
    encounters: [
      {
        date: '2024-10-28',
        type: 'Outpatient visit',
        provider: 'Dr. M. Okoro (Demo)',
        facility: 'Veridian Health Centre (Demo)',
        summary: 'Diabetes management review. HbA1c 8.2 — above target. Insulin dose titrated.',
      },
      {
        date: '2024-08-11',
        type: 'Specialist consult',
        provider: 'Dr. C. Johansson (Demo)',
        facility: 'Demo Renal Clinic',
        summary: 'Nephrology review for diabetic nephropathy. eGFR 44 — Stage 3b CKD. Diet counselling.',
      },
      {
        date: '2024-05-03',
        type: 'Outpatient visit',
        provider: 'Dr. M. Okoro (Demo)',
        facility: 'Veridian Health Centre (Demo)',
        summary: 'Routine follow-up. BP 144/92. Furosemide dose increased.',
      },
    ],
    labs: [
      { date: '2024-10-28', code: 'HBA1C', name: 'HbA1c', value: '8.2', unit: '%', status: 'abnormal' },
      { date: '2024-10-28', code: 'EGFR', name: 'eGFR', value: '44', unit: 'mL/min/1.73m²', status: 'abnormal' },
      { date: '2024-08-11', code: 'UALBCREAT', name: 'Urine Albumin:Creatinine Ratio', value: '68', unit: 'mg/mmol', status: 'abnormal' },
      { date: '2024-05-03', code: 'K', name: 'Potassium', value: '4.1', unit: 'mmol/L', status: 'normal' },
    ],
    medications: [
      { name: 'Insulin Glargine 30 units', dose: '30 units', frequency: 'Once daily at bedtime', prescribedBy: 'Dr. M. Okoro (Demo)', startDate: '2022-06-15', status: 'active' },
      { name: 'Metformin 1000mg', dose: '1000mg', frequency: 'Twice daily with meals', prescribedBy: 'Dr. M. Okoro (Demo)', startDate: '2019-03-01', status: 'active' },
      { name: 'Furosemide 40mg', dose: '40mg', frequency: 'Once daily morning', prescribedBy: 'Dr. M. Okoro (Demo)', startDate: '2023-11-20', status: 'active' },
    ],
    referrals: [
      { to: 'Nephrology — Demo Renal Clinic', reason: 'Diabetic nephropathy, eGFR 44', date: '2024-05-03', status: 'completed' },
      { to: 'Ophthalmology — Demo Eye Clinic', reason: 'Annual diabetic retinopathy screening', date: '2024-10-28', status: 'overdue' },
    ],
    accessLog: [
      { actorId: 'clinician-demo-01', role: 'CLINICIAN', action: 'READ_TIMELINE', timestamp: '2024-10-28T10:20:00Z' },
      { actorId: 'clinician-demo-04', role: 'CLINICIAN', action: 'BREAK_GLASS', timestamp: '2024-08-11T08:55:00Z', reason: 'Emergency review — patient admitted acutely' },
    ],
  },
]
