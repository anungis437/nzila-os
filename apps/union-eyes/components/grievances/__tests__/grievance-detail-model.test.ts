import { describe, expect, it } from 'vitest';
import { grievanceStatusEnum } from '@/db/schema/domains/claims/grievances';
import {
  GRIEVANCE_STATUSES,
  isKnownStatus,
  maySetStatus,
  mimeTypeOf,
  nextStatuses,
  readGrievanceDetail,
  webUrl,
} from '../grievance-detail-model';

describe('the statuses the screen knows', () => {
  it('are the database’s own grievance_status members, so every status the screen sends is one the route accepts', () => {
    expect([...GRIEVANCE_STATUSES].sort()).toEqual([...grievanceStatusEnum.enumValues].sort());
  });

  it('do not take a property of every object for a status', () => {
    for (const inherited of ['constructor', 'toString', '__proto__']) expect(isKnownStatus(inherited)).toBe(false);
    expect(isKnownStatus('filed')).toBe(true);
  });
});

describe('nextStatuses: what the server’s lifecycle rules allow', () => {
  it('moves a draft on to a submitted state, and a filed grievance on to acknowledged', () => {
    expect(nextStatuses('draft', null)).toEqual(['new', 'filed', 'converted']);
    expect(nextStatuses('filed', null)).toEqual(['acknowledged']);
  });

  it('needs a steward assigned before an acknowledged grievance goes to investigation', () => {
    expect(nextStatuses('acknowledged', null)).toEqual([]);
    expect(nextStatuses('acknowledged', 'rep-1')).toEqual(['investigating']);
  });

  it('offers nothing a steward may not do, and nothing the route cannot accept: no documentation is sent with a status change', () => {
    // From investigation the lifecycle also allows mediation and arbitration (officers), resolution and closure (documentation, admin).
    expect(nextStatuses('investigating', 'rep-1')).toEqual(['response_due']);
    expect(nextStatuses('settled', 'rep-1')).toEqual([]);
    expect(nextStatuses('closed', 'rep-1')).toEqual([]);
  });

  it('offers only statuses of the database, never the lifecycle’s own names for them', () => {
    for (const status of GRIEVANCE_STATUSES) {
      for (const next of nextStatuses(status, 'rep-1')) {
        expect(GRIEVANCE_STATUSES).toContain(next);
        expect(['triage', 'investigation', 'negotiation', 'resolved']).not.toContain(next);
        expect(next).not.toBe(status);
      }
    }
  });

  it('offers nothing from a status the lifecycle does not know', () => {
    expect(nextStatuses('something_new', 'rep-1')).toEqual([]);
    expect(nextStatuses('', null)).toEqual([]);
  });
});

describe('maySetStatus: the authority the status route requires', () => {
  const access = (overrides: Record<string, unknown> = {}) => ({
    isPrimaryOwner: false,
    isSecondaryCollaborator: false,
    accessRole: null,
    canManageAssignments: false,
    canUploadDocuments: false,
    ...overrides,
  });
  const grievance = (status: string, primaryLroId: string | null, effectiveAccess: ReturnType<typeof access>) => ({ status, primaryLroId, effectiveAccess });

  it('is held by the primary owner and by an active secondary LRO', () => {
    expect(maySetStatus(grievance('filed', 'rep-1', access({ isPrimaryOwner: true, accessRole: 'primary_owner' })))).toBe(true);
    expect(maySetStatus(grievance('filed', 'rep-1', access({ isSecondaryCollaborator: true, accessRole: 'secondary_lro' })))).toBe(true);
  });

  it('is not held by a reviewer, a read-only collaborator or a representative with no relationship to the matter', () => {
    expect(maySetStatus(grievance('filed', 'rep-1', access({ isSecondaryCollaborator: true, accessRole: 'reviewer' })))).toBe(false);
    expect(maySetStatus(grievance('filed', 'rep-1', access({ isSecondaryCollaborator: true, accessRole: 'read_only' })))).toBe(false);
    expect(maySetStatus(grievance('filed', 'rep-1', access()))).toBe(false);
  });

  it('is held by any representative for an intake nobody is assigned to, and not once one is', () => {
    expect(maySetStatus(grievance('draft', null, access()))).toBe(true);
    expect(maySetStatus(grievance('draft', 'rep-1', access()))).toBe(false);
  });
});

describe('mimeTypeOf', () => {
  it('reads the type from the extension of the file name', () => {
    expect(mimeTypeOf('letter.pdf')).toBe('application/pdf');
    expect(mimeTypeOf('Letter.PDF')).toBe('application/pdf');
    expect(mimeTypeOf('photo.JPG')).toBe('image/jpeg');
    expect(mimeTypeOf('minutes.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(mimeTypeOf(' scan.png ')).toBe('image/png');
  });

  it('says only that the type is not known when the name gives none', () => {
    expect(mimeTypeOf('notes')).toBe('application/octet-stream');
    expect(mimeTypeOf('archive.tar.gz')).toBe('application/octet-stream');
    expect(mimeTypeOf('')).toBe('application/octet-stream');
    expect(mimeTypeOf('constructor')).toBe('application/octet-stream');
    expect(mimeTypeOf('file.constructor')).toBe('application/octet-stream');
  });
});

describe('webUrl', () => {
  it('accepts a web address and nothing that would run in the page that follows it', () => {
    expect(webUrl('https://storage.example.com/a/b.pdf')).toBe('https://storage.example.com/a/b.pdf');
    expect(webUrl('  http://example.com/x  ')).toBe('http://example.com/x');
    for (const unsafe of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://example.com/a', 'blob:https://example.com/id', '//example.com/a', 'not a url', '']) {
      expect(webUrl(unsafe), unsafe).toBeNull();
    }
  });
});

describe('readGrievanceDetail', () => {
  const body = (overrides: Record<string, unknown> = {}) => ({
    success: true,
    data: {
      id: 'g-1',
      grievanceNumber: 'GR-1',
      type: 'policy',
      status: 'filed',
      priority: 'low',
      title: 'A title',
      description: null,
      filedDate: null,
      unionRepId: null,
      employerName: null,
      cbaArticle: null,
      events: [],
      governedDocuments: [],
      collaborators: [],
      effectiveAccess: { isPrimaryOwner: true, isSecondaryCollaborator: false, accessRole: 'primary_owner', canManageAssignments: true, canUploadDocuments: true },
      ...overrides,
    },
  });

  it('reads the grievance with its parts, and leaves what it does not carry empty', () => {
    const detail = readGrievanceDetail(body());

    expect(detail).toMatchObject({ id: 'g-1', grievanceNumber: 'GR-1', status: 'filed', description: null, primaryLroId: null, events: [], governedDocuments: [], collaborators: [] });
    expect(detail.effectiveAccess.isPrimaryOwner).toBe(true);
    // The mutable representative column of the row is not carried to the screen.
    expect(Object.keys(detail).join(' ')).not.toMatch(/union/i);
  });

  it('refuses a body that lacks a part the screen reads, instead of showing an empty list in its place', () => {
    for (const missing of ['events', 'governedDocuments', 'collaborators', 'effectiveAccess', 'id', 'grievanceNumber', 'status']) {
      expect(() => readGrievanceDetail(body({ [missing]: undefined })), missing).toThrow(/Unexpected API response/);
    }
    expect(() => readGrievanceDetail(body({ events: [{ eventType: 'x' }] }))).toThrow('an event id');
    expect(() => readGrievanceDetail(body({ governedDocuments: ['nope'] }))).toThrow('not a record');
    expect(() => readGrievanceDetail({ id: 'g-1' })).toThrow('no data');
    expect(() => readGrievanceDetail(body({ effectiveAccess: { isPrimaryOwner: 'yes' } }))).toThrow('the caller’s access');
  });
});
