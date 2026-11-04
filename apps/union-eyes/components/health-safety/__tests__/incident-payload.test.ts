import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workplaceIncidents } from '@/db/schema/domains/health-safety/health-safety-schema';
import { toIncidentRequest } from '../incident-payload';
import type { IncidentFormData } from '../IncidentReportForm';

const form = (overrides: Partial<IncidentFormData> = {}): IncidentFormData => ({
  incidentDate: new Date(2026, 2, 4),
  incidentTime: '14:30',
  location: ' Loading dock ',
  department: 'Shipping',
  incidentType: 'injury',
  severity: 'major',
  description: 'A pallet slid off the forks and struck a worker on the left leg while it was being stacked',
  immediateCause: 'The forks were not fully under the pallet',
  rootCause: 'No stacking procedure',
  injuriesOccurred: true,
  injuryDetails: 'Bruised left shin, first aid on site',
  witnessesPresent: true,
  witnessNames: 'Grace Hopper, Alan Turing\nKatherine Johnson',
  witnessContacts: 'grace@union.example; 555-0102',
  correctiveActions: 'Retrain the shift on stacking',
  preventiveMeasures: 'Paint stacking guides on the floor',
  isAnonymous: false,
  reportedBy: 'Ada Lovelace',
  reporterContact: 'ada@union.example',
  ...overrides,
});

describe('toIncidentRequest', () => {
  it('sends the route’s own fields, with the day and the time of day as one instant, and names no organization', () => {
    const request = toIncidentRequest(form());
    expect(request).toMatchObject({
      incidentType: 'injury',
      severity: 'major',
      incidentDate: new Date(2026, 2, 4, 14, 30).toISOString(),
      locationDescription: 'Loading dock',
      description: 'A pallet slid off the forks and struck a worker on the left leg while it was being stacked',
      isAnonymous: false,
      departmentName: 'Shipping',
      rootCauseAnalysis: 'No stacking procedure',
      correctiveActionsSummary: 'Retrain the shift on stacking',
      reportedByName: 'Ada Lovelace',
      witnessesPresent: true,
      witnessNames: ['Grace Hopper', 'Alan Turing', 'Katherine Johnson'],
    });
    expect(request).not.toHaveProperty('organizationId');
    expect(request).not.toHaveProperty('incidentTime');
  });

  it('keeps everything the reporter typed: what has no column of its own goes, labelled, into the narrative', () => {
    const { whatHappened } = toIncidentRequest(form());
    expect(whatHappened).toContain('Immediate cause: The forks were not fully under the pallet');
    expect(whatHappened).toContain('Injuries: Bruised left shin, first aid on site');
    expect(whatHappened).toContain('Witness contacts: grace@union.example; 555-0102');
    expect(whatHappened).toContain('Preventive measures: Paint stacking guides on the floor');
    expect(whatHappened).toContain('Reporter contact: ada@union.example');
  });

  it('sends only fields the incidents route stores: each is a column and a writable field of the route', () => {
    const route = readFileSync('app/api/health-safety/incidents/route.ts', 'utf8');
    const writable = [...(/writableFields: \[([^\]]*)\]/.exec(route)?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
    expect(writable.length).toBeGreaterThan(10);
    for (const key of Object.keys(toIncidentRequest(form()))) {
      expect(workplaceIncidents, key).toHaveProperty(key);
      expect(writable, key).toContain(key);
    }
    // The route also stores the form's fields under the aliases it accepts; none of the form's own unstorable names is sent.
    for (const key of ['immediateCause', 'injuriesOccurred', 'injuryDetails', 'witnessContacts', 'preventiveMeasures', 'reporterContact', 'attachments', 'incidentTime']) {
      expect(toIncidentRequest(form())).not.toHaveProperty(key);
    }
  });

  it('keeps an anonymous reporter anonymous: no name and no contact is sent, not even inside the narrative', () => {
    const request = toIncidentRequest(form({ isAnonymous: true }));
    expect(request.isAnonymous).toBe(true);
    expect(request).not.toHaveProperty('reportedByName');
    expect(request.whatHappened).not.toContain('Reporter contact');
    expect(request.whatHappened).not.toContain('ada@union.example');
  });

  it('leaves out the optional fields that were left blank, instead of sending empty strings', () => {
    const request = toIncidentRequest(form({
      department: '  ', rootCause: '', correctiveActions: undefined, injuriesOccurred: false, injuryDetails: '', witnessesPresent: false,
      witnessNames: '', witnessContacts: '', preventiveMeasures: '', reportedBy: '', reporterContact: '',
    }));
    for (const key of ['departmentName', 'rootCauseAnalysis', 'correctiveActionsSummary', 'reportedByName', 'witnessesPresent', 'witnessNames']) {
      expect(request, key).not.toHaveProperty(key);
    }
    expect(request.whatHappened).toBe('Immediate cause: The forks were not fully under the pallet');
  });

  it('does not send what was typed about injuries or witnesses after the box for them was unticked', () => {
    const request = toIncidentRequest(form({ injuriesOccurred: false, witnessesPresent: false }));
    expect(request.whatHappened).not.toContain('Injuries');
    expect(request.whatHappened).not.toContain('Witness contacts');
    expect(request).not.toHaveProperty('witnessNames');
  });

  it.each(['', '2:30', '24:00', '14:60', 'noon', '14:30:00'])('refuses the time %j, which is not a time of day', (time) => {
    expect(() => toIncidentRequest(form({ incidentTime: time }))).toThrow('The incident time must be a time of day');
  });

  it('accepts the first and the last minute of the day', () => {
    expect(toIncidentRequest(form({ incidentTime: '00:00' })).incidentDate).toBe(new Date(2026, 2, 4, 0, 0).toISOString());
    expect(toIncidentRequest(form({ incidentTime: '23:59' })).incidentDate).toBe(new Date(2026, 2, 4, 23, 59).toISOString());
  });
});
