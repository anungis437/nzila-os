import { describe, it, expect } from 'vitest';
import { filterMembers, buildMembersExportCsv } from '../members-console';

const MEMBERS = [
  { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'Alice Smith', email: 'alice@example.com', phone: null, department: 'Assembly', membership_number: 'M-001', created_at: null },
  { id: '2', user_id: 'u2', organization_id: 'org1', role: 'steward', status: 'active', name: 'Bob Jones', email: 'bob@example.com', phone: null, department: 'Warehouse', membership_number: 'M-002', created_at: null },
  { id: '3', user_id: 'u3', organization_id: 'org1', role: 'officer', status: 'inactive', name: 'Carol Lee', email: 'carol@example.com', phone: null, department: 'Assembly', membership_number: 'M-003', created_at: null },
];

describe('members-console filterMembers', () => {
  it('returns all members when roleFilter is "all" and no search query', () => {
    const result = filterMembers(MEMBERS, { searchQuery: '', roleFilter: 'all' });
    expect(result).toHaveLength(3);
  });

  it('filters by exact role match — this is the previously-dead role filter control', () => {
    const result = filterMembers(MEMBERS, { searchQuery: '', roleFilter: 'steward' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob Jones');
  });

  it('returns an empty array when no member matches the role filter', () => {
    const result = filterMembers(MEMBERS, { searchQuery: '', roleFilter: 'admin' });
    expect(result).toHaveLength(0);
  });

  it('combines role filter and search query (AND semantics)', () => {
    const result = filterMembers(MEMBERS, { searchQuery: 'carol', roleFilter: 'officer' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('a role match with a non-matching search query returns nothing', () => {
    const result = filterMembers(MEMBERS, { searchQuery: 'nonexistent', roleFilter: 'steward' });
    expect(result).toHaveLength(0);
  });

  it('search query alone (role "all") matches name, email, role, or membership number', () => {
    expect(filterMembers(MEMBERS, { searchQuery: 'M-002', roleFilter: 'all' })).toHaveLength(1);
    expect(filterMembers(MEMBERS, { searchQuery: 'bob@example.com', roleFilter: 'all' })).toHaveLength(1);
  });
});

describe('members-console buildMembersExportCsv', () => {
  it('produces a header row plus one row per member', () => {
    const csv = buildMembersExportCsv(MEMBERS);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4); // header + 3 members
    expect(lines[0]).toBe('Name,Email,Role,Status,Department,Membership Number');
  });

  it('renders null fields as empty strings rather than the literal string "null"', () => {
    const csv = buildMembersExportCsv([
      { id: '9', user_id: 'u9', organization_id: 'org1', role: 'member', status: 'active', name: null, email: null, phone: null, department: null, membership_number: null, created_at: null },
    ]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).not.toContain('null');
  });

  it('produces just the header row for an empty member list', () => {
    const csv = buildMembersExportCsv([]);
    expect(csv).toBe('Name,Email,Role,Status,Department,Membership Number');
  });

  // Uses the repo's canonical escaper (lib/csv-export.ts) rather than a
  // hand-rolled row.join(",") — these prove the export is safe for
  // real member-controlled data (names/departments containing commas,
  // quotes, newlines) and neutralised against spreadsheet formula injection.
  it('quotes a name containing a comma', () => {
    const csv = buildMembersExportCsv([
      { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'Smith, Jane', email: 'j@example.com', phone: null, department: null, membership_number: null, created_at: null },
    ]);
    expect(csv.split('\n')[1]).toBe('"Smith, Jane",j@example.com,member,active,,');
  });

  it('doubles an embedded quote and wraps the field', () => {
    const csv = buildMembersExportCsv([
      { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'Jane "JJ" Smith', email: null, phone: null, department: null, membership_number: null, created_at: null },
    ]);
    expect(csv.split('\n')[1]).toContain('"Jane ""JJ"" Smith"');
  });

  it('wraps a department containing a newline in quotes', () => {
    const csv = buildMembersExportCsv([
      { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'Alice', email: null, phone: null, department: 'Line1\nLine2', membership_number: null, created_at: null },
    ]);
    const csvRow = csv.split('\n').slice(1).join('\n');
    expect(csvRow).toContain('"Line1\nLine2"');
  });

  it('preserves Unicode values unchanged', () => {
    const csv = buildMembersExportCsv([
      { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'José Núñez 李明', email: null, phone: null, department: null, membership_number: null, created_at: null },
    ]);
    expect(csv.split('\n')[1]).toContain('José Núñez 李明');
  });

  it('neutralises a spreadsheet-formula-leading department with a leading apostrophe', () => {
    const csv = buildMembersExportCsv([
      { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'Alice', email: null, phone: null, department: '=SUM(A1:A9)', membership_number: null, created_at: null },
    ]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain("'=SUM(A1:A9)");
  });

  it('leaves normal values semantically unchanged', () => {
    const csv = buildMembersExportCsv([
      { id: '1', user_id: 'u1', organization_id: 'org1', role: 'member', status: 'active', name: 'Alice Smith', email: 'alice@example.com', phone: null, department: 'Assembly', membership_number: 'M-001', created_at: null },
    ]);
    expect(csv.split('\n')[1]).toBe('Alice Smith,alice@example.com,member,active,Assembly,M-001');
  });
});
