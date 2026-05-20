/**
 * Seed: CUPE Local 4373 Demo Members
 *
 * Inserts a rich, realistic roster of 32 union members for the CUPE Local 4373
 * demo environment. Idempotent via ON CONFLICT DO NOTHING on (organization_id, user_id).
 *
 * Usage:
 *   pnpm tsx scripts/seed-cupe4373-members.ts
 *
 * Target org: 11111111-1111-4111-8111-111111111111 (UE QA Primary Local)
 */

import { db } from '@/db/db'
import { sql } from 'drizzle-orm'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

function d(year: number, month: number, day: number) {
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`)
}

/** Members ordered by: executive → officers → stewards → grievance → members */
const MEMBERS: Array<{
  id: string
  userId: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  department: string
  position: string
  hireDate: Date
  seniority: number
  membershipNumber: string
  unionJoinDate: Date
  isPrimary: boolean
  location: string
  preferredContactMethod: string
}> = [
  // ── Executive ────────────────────────────────────────────────────────────────
  {
    id:                 'c4373001-0000-4000-8000-000000000001',
    userId:             'cupe4373-exec-001',
    name:               'Marie-Claude Boivin',
    email:              'mc.boivin@local4373.ca',
    phone:              '613-555-0101',
    role:               'president',
    status:             'active',
    department:         'Local Executive',
    position:           'Local President',
    hireDate:           d(2003, 9, 15),
    seniority:          22,
    membershipNumber:   'C4373-0001',
    unionJoinDate:      d(2004, 2, 1),
    isPrimary:          true,
    location:           'Main Campus',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000002',
    userId:             'cupe4373-exec-002',
    name:               'Kevin Okonkwo',
    email:              'k.okonkwo@local4373.ca',
    phone:              '613-555-0102',
    role:               'executive',
    status:             'active',
    department:         'Local Executive',
    position:           'Vice-President',
    hireDate:           d(2007, 4, 10),
    seniority:          18,
    membershipNumber:   'C4373-0002',
    unionJoinDate:      d(2007, 9, 1),
    isPrimary:          true,
    location:           'Main Campus',
    preferredContactMethod: 'email',
  },
  // ── Officers ─────────────────────────────────────────────────────────────────
  {
    id:                 'c4373001-0000-4000-8000-000000000003',
    userId:             'cupe4373-officer-001',
    name:               'Sandra Thibeault',
    email:              's.thibeault@local4373.ca',
    phone:              '613-555-0103',
    role:               'officer',
    status:             'active',
    department:         'Local Executive',
    position:           'Recording Secretary',
    hireDate:           d(2010, 6, 1),
    seniority:          15,
    membershipNumber:   'C4373-0003',
    unionJoinDate:      d(2010, 11, 1),
    isPrimary:          true,
    location:           'Main Campus',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000004',
    userId:             'cupe4373-officer-002',
    name:               'Jean-François Lemaire',
    email:              'jf.lemaire@local4373.ca',
    phone:              '613-555-0104',
    role:               'officer',
    status:             'active',
    department:         'Local Executive',
    position:           'Treasurer',
    hireDate:           d(2008, 3, 22),
    seniority:          17,
    membershipNumber:   'C4373-0004',
    unionJoinDate:      d(2008, 8, 1),
    isPrimary:          true,
    location:           'Main Campus',
    preferredContactMethod: 'email',
  },
  // ── Stewards ─────────────────────────────────────────────────────────────────
  {
    id:                 'c4373001-0000-4000-8000-000000000005',
    userId:             'cupe4373-steward-001',
    name:               'Amara Diallo',
    email:              'a.diallo@local4373.ca',
    phone:              '613-555-0105',
    role:               'steward',
    status:             'active',
    department:         'Nursing Support',
    position:           'Chief Steward — Patient Care',
    hireDate:           d(2012, 1, 14),
    seniority:          13,
    membershipNumber:   'C4373-0005',
    unionJoinDate:      d(2012, 6, 1),
    isPrimary:          true,
    location:           'East Wing',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000006',
    userId:             'cupe4373-steward-002',
    name:               'Patricia Hollingsworth',
    email:              'p.hollingsworth@local4373.ca',
    phone:              '613-555-0106',
    role:               'steward',
    status:             'active',
    department:         'Dietary Services',
    position:           'Shop Steward — Dietary',
    hireDate:           d(2015, 5, 3),
    seniority:          10,
    membershipNumber:   'C4373-0006',
    unionJoinDate:      d(2015, 10, 1),
    isPrimary:          true,
    location:           'Kitchen Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000007',
    userId:             'cupe4373-steward-003',
    name:               'Thomas Nkrumah',
    email:              't.nkrumah@local4373.ca',
    phone:              '613-555-0107',
    role:               'steward',
    status:             'active',
    department:         'Environmental Services',
    position:           'Shop Steward — Housekeeping',
    hireDate:           d(2014, 9, 8),
    seniority:          11,
    membershipNumber:   'C4373-0007',
    unionJoinDate:      d(2015, 2, 1),
    isPrimary:          true,
    location:           'West Wing',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000008',
    userId:             'cupe4373-steward-004',
    name:               'Denise Archambault',
    email:              'd.archambault@local4373.ca',
    phone:              '613-555-0108',
    role:               'steward',
    status:             'active',
    department:         'Health Records',
    position:           'Shop Steward — Administration',
    hireDate:           d(2011, 7, 19),
    seniority:          14,
    membershipNumber:   'C4373-0008',
    unionJoinDate:      d(2012, 1, 1),
    isPrimary:          true,
    location:           'Admin Block',
    preferredContactMethod: 'email',
  },
  // ── Grievance Officers ───────────────────────────────────────────────────────
  {
    id:                 'c4373001-0000-4000-8000-000000000009',
    userId:             'cupe4373-grievance-001',
    name:               'Robert Castonguay',
    email:              'r.castonguay@local4373.ca',
    phone:              '613-555-0109',
    role:               'grievance_officer',
    status:             'active',
    department:         'Local Executive',
    position:           'Grievance Officer',
    hireDate:           d(2006, 11, 27),
    seniority:          19,
    membershipNumber:   'C4373-0009',
    unionJoinDate:      d(2007, 4, 1),
    isPrimary:          true,
    location:           'Main Campus',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000010',
    userId:             'cupe4373-grievance-002',
    name:               'Michelle Tran',
    email:              'm.tran@local4373.ca',
    phone:              '613-555-0110',
    role:               'grievance_officer',
    status:             'active',
    department:         'Local Executive',
    position:           'Assistant Grievance Officer',
    hireDate:           d(2017, 2, 13),
    seniority:          8,
    membershipNumber:   'C4373-0010',
    unionJoinDate:      d(2017, 7, 1),
    isPrimary:          true,
    location:           'Main Campus',
    preferredContactMethod: 'email',
  },
  // ── General Members ──────────────────────────────────────────────────────────
  {
    id:                 'c4373001-0000-4000-8000-000000000011',
    userId:             'cupe4373-m-011',
    name:               'Linda Obafemi',
    email:              'l.obafemi@local4373.ca',
    phone:              '613-555-0111',
    role:               'member',
    status:             'active',
    department:         'Patient Care',
    position:           'Personal Support Worker',
    hireDate:           d(2018, 3, 5),
    seniority:          7,
    membershipNumber:   'C4373-0011',
    unionJoinDate:      d(2018, 8, 1),
    isPrimary:          true,
    location:           'Long-Term Care',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000012',
    userId:             'cupe4373-m-012',
    name:               'Brian Leblanc',
    email:              'b.leblanc@local4373.ca',
    phone:              '613-555-0112',
    role:               'member',
    status:             'active',
    department:         'Dietary Services',
    position:           'Dietary Aide',
    hireDate:           d(2016, 8, 22),
    seniority:          9,
    membershipNumber:   'C4373-0012',
    unionJoinDate:      d(2017, 1, 1),
    isPrimary:          true,
    location:           'Kitchen Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000013',
    userId:             'cupe4373-m-013',
    name:               'Sylvie Cloutier',
    email:              's.cloutier@local4373.ca',
    phone:              '613-555-0113',
    role:               'member',
    status:             'active',
    department:         'Environmental Services',
    position:           'Environmental Services Worker',
    hireDate:           d(2019, 5, 14),
    seniority:          6,
    membershipNumber:   'C4373-0013',
    unionJoinDate:      d(2019, 10, 1),
    isPrimary:          true,
    location:           'North Wing',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000014',
    userId:             'cupe4373-m-014',
    name:               'Joseph Mbeki',
    email:              'j.mbeki@local4373.ca',
    phone:              '613-555-0114',
    role:               'member',
    status:             'active',
    department:         'Health Records',
    position:           'Health Records Clerk',
    hireDate:           d(2020, 1, 6),
    seniority:          5,
    membershipNumber:   'C4373-0014',
    unionJoinDate:      d(2020, 6, 1),
    isPrimary:          true,
    location:           'Admin Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000015',
    userId:             'cupe4373-m-015',
    name:               'Christine Beaumont',
    email:              'c.beaumont@local4373.ca',
    phone:              '613-555-0115',
    role:               'member',
    status:             'active',
    department:         'Administrative Services',
    position:           'Administrative Assistant',
    hireDate:           d(2013, 10, 28),
    seniority:          12,
    membershipNumber:   'C4373-0015',
    unionJoinDate:      d(2014, 3, 1),
    isPrimary:          true,
    location:           'Admin Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000016',
    userId:             'cupe4373-m-016',
    name:               'Marcus Williams',
    email:              'm.williams@local4373.ca',
    phone:              '613-555-0116',
    role:               'member',
    status:             'active',
    department:         'Maintenance & Facilities',
    position:           'Maintenance Technician',
    hireDate:           d(2009, 7, 11),
    seniority:          16,
    membershipNumber:   'C4373-0016',
    unionJoinDate:      d(2009, 12, 1),
    isPrimary:          true,
    location:           'Maintenance Yard',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000017',
    userId:             'cupe4373-m-017',
    name:               'Fatima Al-Hassan',
    email:              'f.alhassan@local4373.ca',
    phone:              '613-555-0117',
    role:               'member',
    status:             'active',
    department:         'Community Health',
    position:           'Community Health Worker',
    hireDate:           d(2021, 4, 19),
    seniority:          4,
    membershipNumber:   'C4373-0017',
    unionJoinDate:      d(2021, 9, 1),
    isPrimary:          true,
    location:           'Community Outreach',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000018',
    userId:             'cupe4373-m-018',
    name:               'Paul Ouellette',
    email:              'p.ouellette@local4373.ca',
    phone:              '613-555-0118',
    role:               'member',
    status:             'active',
    department:         'Transportation',
    position:           'Transportation Coordinator',
    hireDate:           d(2016, 2, 29),
    seniority:          9,
    membershipNumber:   'C4373-0018',
    unionJoinDate:      d(2016, 7, 1),
    isPrimary:          true,
    location:           'Transport Bay',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000019',
    userId:             'cupe4373-m-019',
    name:               'Nadia Petrova',
    email:              'n.petrova@local4373.ca',
    phone:              '613-555-0119',
    role:               'member',
    status:             'active',
    department:         'Patient Care',
    position:           'Personal Support Worker',
    hireDate:           d(2022, 6, 7),
    seniority:          3,
    membershipNumber:   'C4373-0019',
    unionJoinDate:      d(2022, 11, 1),
    isPrimary:          true,
    location:           'Rehabilitation Unit',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000020',
    userId:             'cupe4373-m-020',
    name:               'Gary Desrochers',
    email:              'g.desrochers@local4373.ca',
    phone:              '613-555-0120',
    role:               'member',
    status:             'active',
    department:         'Dietary Services',
    position:           'Cook',
    hireDate:           d(2005, 11, 3),
    seniority:          20,
    membershipNumber:   'C4373-0020',
    unionJoinDate:      d(2006, 4, 1),
    isPrimary:          true,
    location:           'Kitchen Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000021',
    userId:             'cupe4373-m-021',
    name:               'Isabelle Robitaille',
    email:              'i.robitaille@local4373.ca',
    phone:              '613-555-0121',
    role:               'member',
    status:             'active',
    department:         'Environmental Services',
    position:           'Laundry Aide',
    hireDate:           d(2017, 9, 25),
    seniority:          8,
    membershipNumber:   'C4373-0021',
    unionJoinDate:      d(2018, 2, 1),
    isPrimary:          true,
    location:           'Linen Services',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000022',
    userId:             'cupe4373-m-022',
    name:               'Derek Ogilvie',
    email:              'd.ogilvie@local4373.ca',
    phone:              '613-555-0122',
    role:               'member',
    status:             'active',
    department:         'Health Records',
    position:           'Health Information Analyst',
    hireDate:           d(2015, 12, 14),
    seniority:          10,
    membershipNumber:   'C4373-0022',
    unionJoinDate:      d(2016, 5, 1),
    isPrimary:          true,
    location:           'Admin Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000023',
    userId:             'cupe4373-m-023',
    name:               'Rosa Ferreira',
    email:              'r.ferreira@local4373.ca',
    phone:              '613-555-0123',
    role:               'member',
    status:             'active',
    department:         'Administrative Services',
    position:           'Payroll Clerk',
    hireDate:           d(2011, 4, 4),
    seniority:          14,
    membershipNumber:   'C4373-0023',
    unionJoinDate:      d(2011, 9, 1),
    isPrimary:          true,
    location:           'Admin Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000024',
    userId:             'cupe4373-m-024',
    name:               'James Carpenter',
    email:              'j.carpenter@local4373.ca',
    phone:              '613-555-0124',
    role:               'member',
    status:             'active',
    department:         'Maintenance & Facilities',
    position:           'HVAC Technician',
    hireDate:           d(2018, 8, 30),
    seniority:          7,
    membershipNumber:   'C4373-0024',
    unionJoinDate:      d(2019, 1, 1),
    isPrimary:          true,
    location:           'Maintenance Yard',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000025',
    userId:             'cupe4373-m-025',
    name:               'Meera Krishnamurthy',
    email:              'm.krishnamurthy@local4373.ca',
    phone:              '613-555-0125',
    role:               'member',
    status:             'active',
    department:         'Community Health',
    position:           'Outreach Worker',
    hireDate:           d(2023, 2, 20),
    seniority:          2,
    membershipNumber:   'C4373-0025',
    unionJoinDate:      d(2023, 7, 1),
    isPrimary:          true,
    location:           'Community Outreach',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000026',
    userId:             'cupe4373-m-026',
    name:               'André Gagnon',
    email:              'a.gagnon@local4373.ca',
    phone:              '613-555-0126',
    role:               'member',
    status:             'active',
    department:         'Transportation',
    position:           'Patient Transport Driver',
    hireDate:           d(2014, 6, 16),
    seniority:          11,
    membershipNumber:   'C4373-0026',
    unionJoinDate:      d(2014, 11, 1),
    isPrimary:          true,
    location:           'Transport Bay',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000027',
    userId:             'cupe4373-m-027',
    name:               'Valerie Hutchinson',
    email:              'v.hutchinson@local4373.ca',
    phone:              '613-555-0127',
    role:               'member',
    status:             'on-leave',
    department:         'Patient Care',
    position:           'Personal Support Worker',
    hireDate:           d(2016, 11, 1),
    seniority:          9,
    membershipNumber:   'C4373-0027',
    unionJoinDate:      d(2017, 4, 1),
    isPrimary:          true,
    location:           'Long-Term Care',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000028',
    userId:             'cupe4373-m-028',
    name:               'Bernard Ntambi',
    email:              'b.ntambi@local4373.ca',
    phone:              '613-555-0128',
    role:               'member',
    status:             'active',
    department:         'Dietary Services',
    position:           'Food Services Supervisor',
    hireDate:           d(2007, 7, 30),
    seniority:          18,
    membershipNumber:   'C4373-0028',
    unionJoinDate:      d(2008, 1, 1),
    isPrimary:          true,
    location:           'Kitchen Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000029',
    userId:             'cupe4373-m-029',
    name:               'Emily Sawatsky',
    email:              'e.sawatsky@local4373.ca',
    phone:              '613-555-0129',
    role:               'member',
    status:             'active',
    department:         'Administrative Services',
    position:           'Scheduling Coordinator',
    hireDate:           d(2019, 10, 7),
    seniority:          6,
    membershipNumber:   'C4373-0029',
    unionJoinDate:      d(2020, 3, 1),
    isPrimary:          true,
    location:           'Admin Block',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000030',
    userId:             'cupe4373-m-030',
    name:               'Claude Deschênes',
    email:              'c.deschenes@local4373.ca',
    phone:              '613-555-0130',
    role:               'member',
    status:             'inactive',
    department:         'Maintenance & Facilities',
    position:           'Groundskeeper',
    hireDate:           d(2000, 4, 23),
    seniority:          25,
    membershipNumber:   'C4373-0030',
    unionJoinDate:      d(2000, 9, 1),
    isPrimary:          true,
    location:           'Maintenance Yard',
    preferredContactMethod: 'phone',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000031',
    userId:             'cupe4373-m-031',
    name:               'Winsome Brown',
    email:              'w.brown@local4373.ca',
    phone:              '613-555-0131',
    role:               'member',
    status:             'active',
    department:         'Community Health',
    position:           'Community Programs Coordinator',
    hireDate:           d(2022, 9, 12),
    seniority:          3,
    membershipNumber:   'C4373-0031',
    unionJoinDate:      d(2023, 2, 1),
    isPrimary:          true,
    location:           'Community Outreach',
    preferredContactMethod: 'email',
  },
  {
    id:                 'c4373001-0000-4000-8000-000000000032',
    userId:             'cupe4373-m-032',
    name:               'Michel Tremblay',
    email:              'm.tremblay@local4373.ca',
    phone:              '613-555-0132',
    role:               'member',
    status:             'active',
    department:         'Transportation',
    position:           'Patient Transport Aide',
    hireDate:           d(2020, 7, 20),
    seniority:          5,
    membershipNumber:   'C4373-0032',
    unionJoinDate:      d(2020, 12, 1),
    isPrimary:          true,
    location:           'Transport Bay',
    preferredContactMethod: 'phone',
  },
]

// ── Compact extended roster ────────────────────────────────────────────────────
// Format: [seq, name, emailLocal, dept, position, hireYear, hireMo, hireDay, seniority, status, role, contact, location]
type Row = [number, string, string, string, string, number, number, number, number, string, string, string, string]

const EXTENDED_ROWS: Row[] = [
  // Patient Care
  [33, 'Asha Nwosu',           'a.nwosu',           'Patient Care',             'Personal Support Worker',         2019, 3, 11,  6, 'active',   'member', 'phone',  'Long-Term Care'],
  [34, 'Geneviève Paradis',    'g.paradis',         'Patient Care',             'Personal Support Worker',         2021, 7, 22,  4, 'active',   'member', 'email',  'Long-Term Care'],
  [35, 'Omar Khalid',          'o.khalid',          'Patient Care',             'Patient Care Aide',               2018, 11, 5,  7, 'active',   'member', 'phone',  'Acute Care Unit'],
  [36, 'Tanya Osei',           't.osei',            'Patient Care',             'Personal Support Worker',         2022, 1, 19,  3, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [37, 'François Boisvert',    'f.boisvert',        'Patient Care',             'Personal Support Worker',         2020, 9, 8,   5, 'active',   'member', 'email',  'Long-Term Care'],
  [38, 'Priscilla Adeyemi',    'p.adeyemi',         'Patient Care',             'Personal Support Worker',         2017, 5, 14, 8,  'active',   'member', 'phone',  'Memory Care Unit'],
  [39, 'Luc Bergeron',         'l.bergeron',        'Patient Care',             'Patient Care Aide',               2016, 3, 29, 9,  'active',   'member', 'email',  'Acute Care Unit'],
  [40, 'Yuki Hashimoto',       'y.hashimoto',       'Patient Care',             'Personal Support Worker',         2023, 5, 2,   2, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [41, 'Brenda Okafor',        'b.okafor',          'Patient Care',             'Personal Support Worker',         2015, 8, 17, 10, 'active',   'member', 'phone',  'Memory Care Unit'],
  [42, 'Stephane Charron',     's.charron',         'Patient Care',             'Restorative Care Aide',           2018, 2, 6,   7, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [43, 'Adaeze Obi',           'a.obi',             'Patient Care',             'Personal Support Worker',         2024, 1, 15,  1, 'active',   'member', 'phone',  'Long-Term Care'],
  [44, 'Guy Fontaine',         'g.fontaine',        'Patient Care',             'Personal Support Worker',         2013, 6, 3,  12, 'active',   'member', 'email',  'Acute Care Unit'],
  [45, 'Carolyn Whitfield',    'c.whitfield',       'Patient Care',             'Personal Support Worker',         2020, 4, 28,  5, 'on-leave', 'member', 'email',  'Long-Term Care'],
  [46, 'Samuel Afolabi',       's.afolabi',         'Patient Care',             'Patient Care Aide',               2021, 9, 13,  4, 'active',   'member', 'phone',  'Acute Care Unit'],
  [47, 'Hélène Marcoux',       'h.marcoux',         'Patient Care',             'Personal Support Worker',         2011, 12, 9, 14, 'active',   'member', 'email',  'Memory Care Unit'],
  [48, 'Isaac Nkemdirim',      'i.nkemdirim',       'Patient Care',             'Personal Support Worker',         2019, 10, 21, 6, 'active',   'member', 'phone',  'Long-Term Care'],
  // Dietary Services
  [49, 'Monique Lefebvre',     'm.lefebvre',        'Dietary Services',         'Dietary Aide',                    2020, 6, 9,   5, 'active',   'member', 'email',  'Kitchen Block'],
  [50, 'Harpreet Sandhu',      'h.sandhu',          'Dietary Services',         'Cook',                            2015, 4, 14, 10, 'active',   'member', 'phone',  'Kitchen Block'],
  [51, 'Chantal Dupré',        'c.dupre',           'Dietary Services',         'Dietary Aide',                    2022, 3, 7,   3, 'active',   'member', 'email',  'Kitchen Block'],
  [52, 'Kwame Asante',         'k.asante',          'Dietary Services',         'Food Services Worker',            2018, 8, 31,  7, 'active',   'member', 'phone',  'Kitchen Block'],
  [53, 'Lucie Gauthier',       'l.gauthier',        'Dietary Services',         'Dietary Aide',                    2017, 11, 20, 8, 'active',   'member', 'email',  'Kitchen Block'],
  [54, 'Nnamdi Eze',           'n.eze',             'Dietary Services',         'Cook',                            2014, 1, 6,  12, 'active',   'member', 'email',  'Kitchen Block'],
  [55, 'Brigitte Poirier',     'b.poirier',         'Dietary Services',         'Dietary Aide',                    2023, 7, 18,  2, 'active',   'member', 'email',  'Kitchen Block'],
  [56, 'Alphonse Mbarga',      'a.mbarga',          'Dietary Services',         'Dietary Aide',                    2016, 5, 22,  9, 'active',   'member', 'phone',  'Kitchen Block'],
  [57, 'Jacqueline Renaud',    'j.renaud',          'Dietary Services',         'Tray Aide',                       2021, 2, 11,  4, 'active',   'member', 'email',  'Kitchen Block'],
  [58, 'Tobias Schultz',       't.schultz',         'Dietary Services',         'Cook',                            2010, 9, 3,  15, 'active',   'member', 'email',  'Kitchen Block'],
  // Environmental Services
  [59, 'Anika Patel',          'a.patel',           'Environmental Services',   'Environmental Services Worker',   2020, 10, 15,  5, 'active',   'member', 'email',  'South Wing'],
  [60, 'Rodrigo Espinoza',     'r.espinoza',        'Environmental Services',   'Housekeeper',                     2017, 6, 8,   8, 'active',   'member', 'phone',  'North Wing'],
  [61, 'Élise Paquette',       'e.paquette',        'Environmental Services',   'Laundry Aide',                    2019, 4, 23,  6, 'active',   'member', 'email',  'Linen Services'],
  [62, 'Blessing Ukwu',        'b.ukwu',            'Environmental Services',   'Environmental Services Worker',   2022, 8, 1,   3, 'active',   'member', 'phone',  'East Wing'],
  [63, 'Pierre-Luc Simard',    'pl.simard',         'Environmental Services',   'Housekeeper',                     2015, 12, 14, 10, 'active',  'member', 'email',  'West Wing'],
  [64, 'Amina Camara',         'a.camara',          'Environmental Services',   'Laundry Aide',                    2021, 1, 27,  4, 'active',   'member', 'email',  'Linen Services'],
  [65, 'Tommy Leboeuf',        't.leboeuf',         'Environmental Services',   'Environmental Services Worker',   2016, 7, 19,  9, 'active',   'member', 'phone',  'Main Campus'],
  [66, 'Zainab Hussain',       'z.hussain',         'Environmental Services',   'Housekeeper',                     2023, 3, 5,   2, 'active',   'member', 'email',  'South Wing'],
  [67, 'Raoul Clément',        'r.clement',         'Environmental Services',   'Laundry Aide',                    2018, 9, 12,  7, 'active',   'member', 'email',  'Linen Services'],
  [68, 'Grace Atieno',         'g.atieno',          'Environmental Services',   'Environmental Services Worker',   2014, 5, 30, 11, 'active',   'member', 'phone',  'North Wing'],
  // Health Records & Admin
  [69, 'Martine Bouchard',     'm.bouchard',        'Health Records',           'Health Records Clerk',            2019, 6, 17,  6, 'active',   'member', 'email',  'Admin Block'],
  [70, 'Yusuf Adebayo',        'y.adebayo',         'Health Records',           'Medical Transcriptionist',        2018, 3, 4,   7, 'active',   'member', 'email',  'Admin Block'],
  [71, 'Nadine Côté',          'n.cote',            'Health Records',           'Health Information Analyst',      2016, 11, 21, 9, 'active',   'member', 'email',  'Admin Block'],
  [72, 'Elvis Nzinga',         'e.nzinga',          'Health Records',           'Health Records Clerk',            2021, 8, 10,  4, 'active',   'member', 'phone',  'Admin Block'],
  [73, 'Carole Morin',         'c.morin',           'Administrative Services',  'Receptionist',                    2014, 2, 18, 12, 'active',   'member', 'email',  'Admin Block'],
  [74, 'Kofi Acheampong',      'k.acheampong',      'Administrative Services',  'Administrative Coordinator',      2020, 7, 29,  5, 'active',   'member', 'email',  'Admin Block'],
  [75, 'Véronique Dion',       'v.dion',            'Administrative Services',  'Administrative Assistant',        2017, 10, 6,  8, 'active',   'member', 'email',  'Admin Block'],
  [76, 'Peter Kaminski',       'p.kaminski',        'Administrative Services',  'Data Entry Clerk',                2022, 5, 24,  3, 'active',   'member', 'email',  'Admin Block'],
  [77, 'Diane Lessard',        'd.lessard',         'Administrative Services',  'Administrative Assistant',        2011, 8, 15, 14, 'active',   'member', 'email',  'Admin Block'],
  [78, 'Abena Gyamfi',         'a.gyamfi',          'Administrative Services',  'Payroll Assistant',               2019, 1, 9,   6, 'active',   'member', 'email',  'Admin Block'],
  [79, 'Réjean Dubé',          'r.dube',            'Administrative Services',  'Scheduling Coordinator',          2012, 4, 30, 13, 'active',   'member', 'email',  'Admin Block'],
  [80, 'Oluwaseun Adegoke',    'o.adegoke',         'Administrative Services',  'Administrative Assistant',        2023, 9, 12,  2, 'active',   'member', 'email',  'Admin Block'],
  // Maintenance & Facilities
  [81, 'Normand Bélanger',     'n.belanger',        'Maintenance & Facilities', 'Plumber',                         2007, 3, 8,  18, 'active',   'member', 'phone',  'Maintenance Yard'],
  [82, 'Fatou Diarra',         'f.diarra',          'Maintenance & Facilities', 'Electrician Helper',              2020, 6, 16,  5, 'active',   'member', 'phone',  'Maintenance Yard'],
  [83, 'Eric Vaillancourt',    'e.vaillancourt',    'Maintenance & Facilities', 'Maintenance Technician',          2014, 9, 29, 11, 'active',   'member', 'phone',  'Maintenance Yard'],
  [84, 'Joy Mensah',           'j.mensah',          'Maintenance & Facilities', 'Painter',                         2019, 2, 14,  6, 'active',   'member', 'email',  'Maintenance Yard'],
  [85, 'Sylvain Larivière',    's.lariviere',       'Maintenance & Facilities', 'HVAC Technician',                 2009, 11, 3, 16, 'active',   'member', 'phone',  'Maintenance Yard'],
  [86, 'Miriam Osei-Agyemang', 'm.oseiagyemang',   'Maintenance & Facilities', 'Grounds & Maintenance Worker',    2021, 4, 5,   4, 'active',   'member', 'phone',  'Maintenance Yard'],
  [87, 'Mario Tanguay',        'm.tanguay',         'Maintenance & Facilities', 'Boiler Operator',                 2005, 7, 22, 20, 'active',   'member', 'phone',  'Plant Room'],
  [88, 'Adwoa Mensah',         'ad.mensah',         'Maintenance & Facilities', 'Maintenance Technician',          2017, 12, 11, 8, 'active',   'member', 'phone',  'Maintenance Yard'],
  // Community Health
  [89, 'Claudette Vachon',     'c.vachon',          'Community Health',         'Community Health Educator',       2015, 5, 7,  10, 'active',   'member', 'email',  'Community Outreach'],
  [90, 'Seun Olatunji',        's.olatunji',        'Community Health',         'Community Health Worker',         2020, 8, 19,  5, 'active',   'member', 'email',  'Community Outreach'],
  [91, 'Hana Turgeon',         'h.turgeon',         'Community Health',         'Outreach Coordinator',            2018, 1, 28,  7, 'active',   'member', 'email',  'Community Outreach'],
  [92, 'Dawit Bekele',         'd.bekele',          'Community Health',         'Community Programs Worker',       2021, 11, 3,  4, 'active',   'member', 'email',  'Community Outreach'],
  [93, 'Lorraine Hébert',      'l.hebert',          'Community Health',         'Community Health Worker',         2014, 7, 14, 11, 'active',   'member', 'email',  'Community Outreach'],
  [94, 'Francis Ogbonna',      'f.ogbonna',         'Community Health',         'Peer Support Worker',             2022, 4, 6,   3, 'active',   'member', 'email',  'Community Outreach'],
  [95, 'Nadège Pierre',        'n.pierre',          'Community Health',         'Community Health Worker',         2023, 2, 21,  2, 'active',   'member', 'email',  'Community Outreach'],
  [96, 'Benoît Quintal',       'b.quintal',         'Community Health',         'Health Promotion Worker',         2016, 10, 9,  9, 'active',   'member', 'email',  'Community Outreach'],
  // Transportation
  [97, 'Olamide Fashola',      'o.fashola',         'Transportation',           'Patient Transport Driver',        2018, 6, 5,   7, 'active',   'member', 'phone',  'Transport Bay'],
  [98, 'Gilles Pelletier',     'g.pelletier',       'Transportation',           'Patient Transport Driver',        2011, 3, 27, 14, 'active',   'member', 'phone',  'Transport Bay'],
  [99, 'Vanessa Soucy',        'v.soucy',           'Transportation',           'Transportation Aide',             2020, 11, 17,  5, 'active',   'member', 'phone',  'Transport Bay'],
  [100,'Kwabena Mensah',       'kw.mensah',         'Transportation',           'Fleet Coordinator',               2016, 8, 1,   9, 'active',   'member', 'email',  'Transport Bay'],
  [101,'Johanne Audet',        'j.audet',           'Transportation',           'Patient Transport Driver',        2013, 2, 12, 13, 'active',   'member', 'phone',  'Transport Bay'],
  [102,'Solomon Ogwo',         's.ogwo',            'Transportation',           'Transportation Aide',             2022, 6, 30,  3, 'active',   'member', 'phone',  'Transport Bay'],
  // Rehabilitation Services
  [103,'Annette Ricard',       'an.ricard',         'Rehabilitation Services',  'Rehab Aide',                      2018, 7, 23,  7, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [104,'Emmanuel Asomah',      'e.asomah',          'Rehabilitation Services',  'Occupational Therapy Assistant',  2020, 5, 11,  5, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [105,'Pierrette Langlois',   'p.langlois',        'Rehabilitation Services',  'Physiotherapy Aide',              2016, 1, 4,   9, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [106,'Chukwuemeka Eze',      'ch.eze',            'Rehabilitation Services',  'Rehab Aide',                      2021, 9, 28,  4, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [107,'Monique Sabourin',     'mo.sabourin',       'Rehabilitation Services',  'Physiotherapy Aide',              2013, 10, 17, 12, 'active',  'member', 'email',  'Rehabilitation Unit'],
  [108,'Enyonam Kpodo',        'e.kpodo',           'Rehabilitation Services',  'Occupational Therapy Assistant',  2022, 3, 14,  3, 'active',   'member', 'email',  'Rehabilitation Unit'],
  // Social Services
  [109,'Suzanne Proulx',       'su.proulx',         'Social Services',          'Social Services Worker',          2010, 6, 8,  15, 'active',   'member', 'email',  'Social Work Office'],
  [110,'Ibrahim Sow',          'i.sow',             'Social Services',          'Case Coordinator',                2017, 12, 19,  8, 'active',   'member', 'email',  'Social Work Office'],
  [111,'Alexandrine Roy',      'al.roy',            'Social Services',          'Social Services Worker',          2019, 4, 2,   6, 'active',   'member', 'email',  'Social Work Office'],
  [112,'Chibuike Onyeka',      'ch.onyeka',         'Social Services',          'Case Coordinator',                2021, 7, 21,  4, 'active',   'member', 'email',  'Social Work Office'],
  [113,'Nathalie Perron',      'na.perron',         'Social Services',          'Social Services Worker',          2015, 9, 11, 10, 'active',   'member', 'email',  'Social Work Office'],
  [114,'Fatimata Diallo',      'fa.diallo',         'Social Services',          'Community Support Worker',        2023, 1, 8,   2, 'active',   'member', 'email',  'Community Outreach'],
  [115,'Rémi Boucher',         'r.boucher',         'Social Services',          'Social Services Worker',          2012, 3, 26, 13, 'active',   'member', 'email',  'Social Work Office'],
  [116,'Chinwe Obiora',        'ch.obiora',         'Social Services',          'Case Coordinator',                2020, 10, 14,  5, 'active',   'member', 'email',  'Social Work Office'],
  // Pharmacy Support
  [117,'Cécile Turmel',        'ce.turmel',         'Pharmacy Support',         'Pharmacy Assistant',              2017, 8, 7,   8, 'active',   'member', 'email',  'Pharmacy'],
  [118,'Kweku Boateng',        'kw.boateng',        'Pharmacy Support',         'Pharmacy Aide',                   2020, 2, 18,  5, 'active',   'member', 'email',  'Pharmacy'],
  [119,'Odette Lapointe',      'o.lapointe',        'Pharmacy Support',         'Pharmacy Assistant',              2014, 5, 31, 11, 'active',   'member', 'email',  'Pharmacy'],
  [120,'Silas Agba',           's.agba',            'Pharmacy Support',         'Pharmacy Aide',                   2022, 9, 9,   3, 'active',   'member', 'email',  'Pharmacy'],
  // Laboratory Support
  [121,'Pauline Bergeron',     'pau.bergeron',      'Laboratory Support',       'Lab Aide',                        2015, 11, 2, 10, 'active',   'member', 'email',  'Laboratory'],
  [122,'Ifunanya Odum',        'i.odum',            'Laboratory Support',       'Laboratory Assistant',            2019, 6, 25,  6, 'active',   'member', 'email',  'Laboratory'],
  [123,'Éric Nadeau',          'er.nadeau',         'Laboratory Support',       'Lab Aide',                        2021, 4, 13,  4, 'active',   'member', 'email',  'Laboratory'],
  // Security
  [124,'Stéphanie Fortin',     'st.fortin',         'Security',                 'Security Officer',                2016, 7, 26,  9, 'active',   'member', 'phone',  'Main Entrance'],
  [125,'Aboubacar Kouyaté',    'a.kouyate',         'Security',                 'Security Officer',                2018, 10, 15,  7, 'active',   'member', 'phone',  'Main Entrance'],
  [126,'Jean-Paul Lafleur',    'jp.lafleur',        'Security',                 'Security Officer',                2012, 1, 9,  14, 'active',   'member', 'phone',  'Main Entrance'],
  [127,'Mercy Asamoah',        'm.asamoah',         'Security',                 'Security Officer',                2021, 5, 4,   4, 'active',   'member', 'phone',  'Main Entrance'],
  // Additional stewards (representing larger membership)
  [128,'Théodore Gagné',       'th.gagne',          'Rehabilitation Services',  'Shop Steward — Rehab',            2014, 4, 17, 12, 'active',   'steward','email',  'Rehabilitation Unit'],
  [129,'Chidinma Nwoye',       'ch.nwoye',          'Social Services',          'Shop Steward — Social Svcs',      2015, 8, 6,  10, 'active',   'steward','email',  'Social Work Office'],
  [130,'Bertrand Houle',       'b.houle',           'Patient Care',             'Shop Steward — Night Shift',      2010, 2, 23, 15, 'active',   'steward','phone',  'Long-Term Care'],
  [131,'Josephine Okonkwo',    'jo.okonkwo',        'Environmental Services',   'Shop Steward — Env Svcs Night',   2013, 6, 1,  12, 'active',   'steward','email',  'West Wing'],
  [132,'Maxime Villeneuve',    'm.villeneuve',      'Maintenance & Facilities', 'Shop Steward — Facilities',       2009, 9, 14, 16, 'active',   'steward','phone',  'Maintenance Yard'],
  // Members with varying status
  [133,'Annick Lévesque',      'an.levesque',       'Patient Care',             'Personal Support Worker',         2018, 5, 8,   7, 'on-leave', 'member', 'email',  'Long-Term Care'],
  [134,'Ousmane Barry',        'ou.barry',          'Dietary Services',         'Dietary Aide',                    2019, 2, 20,  6, 'on-leave', 'member', 'phone',  'Kitchen Block'],
  [135,'Lynda Barrette',       'l.barrette',        'Administrative Services',  'Administrative Assistant',        2008, 7, 7,  17, 'inactive', 'member', 'email',  'Admin Block'],
  [136,'Théophile Ndoumbe',    'th.ndoumbe',        'Community Health',         'Community Health Worker',         2017, 3, 15,  8, 'active',   'member', 'email',  'Community Outreach'],
  [137,'Julie-Anne Rousseau',  'ja.rousseau',       'Health Records',           'Health Records Clerk',            2022, 10, 3,  3, 'active',   'member', 'email',  'Admin Block'],
  [138,'Celestine Akpan',      'ce.akpan',          'Patient Care',             'Personal Support Worker',         2020, 12, 7,  5, 'active',   'member', 'phone',  'Acute Care Unit'],
  [139,'Fernand Champagne',    'fe.champagne',      'Maintenance & Facilities', 'Electrician Helper',              2011, 5, 19, 14, 'active',   'member', 'phone',  'Maintenance Yard'],
  [140,'Aissatou Bah',         'ai.bah',            'Social Services',          'Community Support Worker',        2021, 8, 27,  4, 'active',   'member', 'email',  'Community Outreach'],
  [141,'Carl Desbiens',        'ca.desbiens',       'Transportation',           'Patient Transport Driver',        2015, 6, 10, 10, 'active',   'member', 'phone',  'Transport Bay'],
  [142,'Eloho Oghenekevwe',    'el.oghenekevwe',    'Patient Care',             'Personal Support Worker',         2023, 8, 4,   2, 'active',   'member', 'phone',  'Memory Care Unit'],
  [143,'Colette Savard',       'co.savard',         'Dietary Services',         'Cook',                            2006, 10, 22, 19, 'active',  'member', 'email',  'Kitchen Block'],
  [144,'Abubakar Kamara',      'ab.kamara',         'Environmental Services',   'Housekeeper',                     2024, 3, 18,  1, 'active',   'member', 'phone',  'South Wing'],
  [145,'Ginette Thibodeau',    'gi.thibodeau',      'Administrative Services',  'Office Coordinator',              2013, 9, 2,  12, 'active',   'member', 'email',  'Admin Block'],
  [146,'Nkechi Okonkwu',       'nk.okonkwu',        'Rehabilitation Services',  'Rehab Aide',                      2020, 7, 31,  5, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [147,'Alain Carpentier',     'al.carpentier',     'Maintenance & Facilities', 'Maintenance Technician',          2017, 4, 9,   8, 'active',   'member', 'phone',  'Maintenance Yard'],
  [148,'Rukayat Amusa',        'r.amusa',           'Community Health',         'Community Health Worker',         2022, 11, 14,  3, 'active',   'member', 'email',  'Community Outreach'],
  [149,'Patrice Lachance',     'pa.lachance',       'Patient Care',             'Personal Support Worker',         2014, 8, 26, 11, 'active',   'member', 'phone',  'Long-Term Care'],
  [150,'Adefemi Adesanya',     'ad.adesanya',       'Laboratory Support',       'Laboratory Assistant',            2018, 1, 30,  7, 'active',   'member', 'email',  'Laboratory'],
  [151,'Sophie Grenier',       'so.grenier',        'Health Records',           'Medical Transcriptionist',        2019, 5, 15,  6, 'active',   'member', 'email',  'Admin Block'],
  [152,'Mamadou Konaté',       'ma.konate',         'Social Services',          'Case Coordinator',                2016, 7, 4,   9, 'active',   'member', 'email',  'Social Work Office'],
  [153,'Rachel Arsenault',     'r.arsenault',       'Dietary Services',         'Food Services Worker',            2021, 3, 22,  4, 'active',   'member', 'email',  'Kitchen Block'],
  [154,'Chiamaka Nwosu',       'ch2.nwosu',         'Patient Care',             'Patient Care Aide',               2023, 6, 10,  2, 'active',   'member', 'phone',  'Acute Care Unit'],
  [155,'Augustin Royer',       'au.royer',          'Maintenance & Facilities', 'Grounds & Maintenance Worker',    2008, 11, 6,  17, 'active',  'member', 'phone',  'Maintenance Yard'],
  [156,'Grace Asiedu',         'gr.asiedu',         'Environmental Services',   'Environmental Services Worker',   2020, 1, 13,  5, 'active',   'member', 'email',  'East Wing'],
  [157,'Pierre Beaulieu',      'pi.beaulieu',       'Security',                 'Security Supervisor',             2004, 4, 7,  21, 'active',   'officer','phone',  'Main Entrance'],
  [158,'Tosin Okafor',         'to.okafor',         'Transportation',           'Transportation Aide',             2024, 5, 20,  1, 'active',   'member', 'phone',  'Transport Bay'],
  [159,'Léa Delorme',          'le.delorme',        'Rehabilitation Services',  'Physiotherapy Aide',              2019, 9, 9,   6, 'active',   'member', 'email',  'Rehabilitation Unit'],
  [160,'Kwame Boateng',        'kw2.boateng',       'Pharmacy Support',         'Pharmacy Assistant',              2015, 2, 28, 10, 'active',   'member', 'email',  'Pharmacy'],
  [161,'Andrée Jalbert',       'an.jalbert',        'Administrative Services',  'Administrative Assistant',        2012, 6, 19, 13, 'active',  'member', 'email',  'Admin Block'],
  [162,'Chimezie Okeke',       'ch.okeke',          'Community Health',         'Peer Support Worker',             2023, 10, 1,  1, 'active',   'member', 'email',  'Community Outreach'],
]

function buildExtended(rows: Row[]) {
  return rows.map(([seq, name, emailLocal, dept, position, hy, hm, hd, seniority, status, role, contact, location]) => {
    const n = String(seq).padStart(3, '0')
    const hire = new Date(`${hy}-${String(hm).padStart(2,'0')}-${String(hd).padStart(2,'0')}T00:00:00.000Z`)
    const joinYear = hy + (hm >= 7 ? 1 : 0)
    const join = new Date(`${joinYear}-${hm >= 7 ? String(hm - 5).padStart(2,'0') : String(hm + 6).padStart(2,'0')}-01T00:00:00.000Z`)
    return {
      id: `c4373002-0000-4000-8000-000000000${n}`,
      userId: `cupe4373-m-${n}`,
      name,
      email: `${emailLocal}@local4373.ca`,
      phone: `613-555-${String(400 + seq).padStart(4, '0')}`,
      role,
      status,
      isPrimary: true,
      department: dept,
      position,
      hireDate: hire,
      seniority,
      membershipNumber: `C4373-${n}`,
      unionJoinDate: join,
      location,
      preferredContactMethod: contact,
    }
  })
}

// ── Programmatic bulk generation (members 163–1462) ───────────────────────────
// Authentic CUPE 4373 healthcare/community-services profiles

const FIRST_NAMES = [
  // French Canadian
  'Marie','Jean','Michel','Pierre','Louise','François','Isabelle','Marc','Sophie','André',
  'Chantal','Alain','Nathalie','Patrick','Hélène','Nicolas','Mélanie','Luc','Céline','Éric',
  'Gilles','Johanne','Sylvain','Martine','Réjean','Claudette','Stéphane','Brigitte','Pascal','Lynda',
  'Diane','Guy','Carole','Bernard','Denise','Serge','Jocelyne','Gaétan','Manon','Roger',
  'Ginette','Normand','Paulette','Marcel','Suzanne','Yvon','Monique','Réal','Nicole','Fernand',
  // English Canadian
  'James','Sarah','Michael','Jennifer','David','Amanda','Robert','Melissa','William','Jessica',
  'Christopher','Ashley','Matthew','Emily','Daniel','Samantha','Andrew','Rachel','Joshua','Lauren',
  'Kevin','Stephanie','Brian','Nicole','Jason','Elizabeth','Ryan','Heather','Justin','Amber',
  'Brandon','Michelle','Tyler','Christina','Aaron','Brittany','Adam','Danielle','Nathan','Rebecca',
  // West African
  'Kofi','Adaeze','Kwame','Chidinma','Olusegun','Emeka','Blessing','Chukwudi','Ngozi','Yaw',
  'Ama','Abena','Kweku','Akosua','Efua','Kojo','Adjoa','Kwabena','Ama','Nana',
  'Yusuf','Fatima','Amara','Seun','Olamide','Tobenna','Chisom','Obiageli','Ifeoma','Chinyere',
  'Uchenna','Nkechi','Obinna','Adaobi','Ifeanyi','Chibuike','Oluwaseun','Adeyemi','Funmilayo','Taiwo',
  // South Asian
  'Priya','Harpreet','Gurpreet','Manpreet','Navdeep','Simran','Arjun','Deepa','Suresh','Kavitha',
  'Ramesh','Lakshmi','Vikram','Divya','Ravi','Meena','Arun','Pooja','Sunita','Rajesh',
  'Anita','Anika','Parminder','Jasmine','Balvinder','Gurjit','Pawandeep','Tanvir','Sukhjit','Daljit',
  // East African
  'Amina','Hassan','Fatuma','Ibrahim','Mariam','Ahmed','Zainab','Dawit','Aisha','Abebe',
  'Tigist','Mulugeta','Hana','Tesfaye','Selam','Yohannes','Meron','Solomon','Liya','Biniam',
  // Caribbean
  'Desmond','Winsome','Sasha','Kenroy','Marcia','Clive','Winston','Delroy','Hyacinth','Neville',
  // East/Southeast Asian
  'Yuki','Mei','Jing','Wei','Minh','Lan','Thanh','Hoa','Linh','Trang',
]

const LAST_NAMES = [
  // French Canadian
  'Tremblay','Gagnon','Roy','Côté','Bouchard','Gauthier','Morin','Lavoie','Fortin','Gagné',
  'Ouellet','Pelletier','Bélanger','Lévesque','Bergeron','Lemay','Couture','Beaulieu','Lacroix','Boucher',
  'Girard','Lapointe','Simard','Fontaine','Leblanc','Poirier','Archambault','Cloutier','Vaillancourt','Hébert',
  'Carpentier','Renaud','Lessard','Champagne','Thibodeau','Villeneuve','Desbiens','Tanguay','Dubé','Charron',
  // English Canadian
  'Smith','Johnson','Williams','Brown','Jones','Miller','Davis','Wilson','Taylor','Clark',
  'Hall','Young','Walker','Allen','Wright','Scott','Green','Baker','Adams','Nelson',
  'Campbell','Mitchell','Roberts','Carter','Phillips','Evans','Turner','Parker','Collins','Edwards',
  // West African
  'Mensah','Okonkwo','Diallo','Adeyemi','Asante','Owusu','Nkrumah','Asamoah','Boateng','Acheampong',
  'Osei','Eze','Nwosu','Obiora','Okeke','Adebayo','Afolabi','Akpan','Ogbonna','Kamara',
  'Conteh','Sesay','Bangura','Koroma','Jalloh','Bah','Kouyaté','Diakité','Touré','Condé',
  // South Asian
  'Patel','Singh','Sharma','Kumar','Gupta','Kaur','Bhat','Rao','Nair','Reddy',
  'Sandhu','Gill','Dhaliwal','Sidhu','Bains','Grewal','Dhillon','Randhawa','Nijjar','Atwal',
  // East African
  'Hassan','Ahmed','Ali','Omar','Hussein','Mohamed','Abdi','Warsame','Farah','Jama',
  'Bekele','Tadesse','Haile','Tesfaye','Girma','Wolde','Alemu','Negash','Mekonnen','Worku',
  // Caribbean
  'Brown','Campbell','Thompson','Henry','Morris','Richards','Clarke','Grant','Gordon','Wright',
  // East/Southeast Asian
  'Chen','Wang','Li','Zhang','Liu','Yang','Nguyen','Tran','Le','Pham',
]

const DEPT_POOL: [string, string[], string[]][] = [
  ['Patient Care',
   ['Personal Support Worker','Patient Care Aide','Restorative Care Aide','Night Shift PSW','Casual PSW'],
   ['Long-Term Care','Memory Care Unit','Acute Care Unit','Rehabilitation Unit']],
  ['Dietary Services',
   ['Dietary Aide','Cook','Food Services Worker','Tray Aide','Cafeteria Worker'],
   ['Kitchen Block']],
  ['Environmental Services',
   ['Environmental Services Worker','Housekeeper','Laundry Aide','Housekeeping Aide','Linen Worker'],
   ['South Wing','North Wing','East Wing','West Wing','Linen Services']],
  ['Health Records',
   ['Health Records Clerk','Medical Transcriptionist','Chart Technician','Records Coordinator'],
   ['Admin Block']],
  ['Administrative Services',
   ['Administrative Assistant','Receptionist','Data Entry Clerk','Office Coordinator','Scheduling Assistant'],
   ['Admin Block']],
  ['Maintenance & Facilities',
   ['Maintenance Technician','Grounds & Maintenance Worker','Painter','Electrician Helper','Boiler Operator'],
   ['Maintenance Yard','Plant Room']],
  ['Community Health',
   ['Community Health Worker','Peer Support Worker','Outreach Coordinator','Health Promotion Worker','Harm Reduction Worker'],
   ['Community Outreach']],
  ['Transportation',
   ['Patient Transport Driver','Transportation Aide','Wheelchair Transportation Worker'],
   ['Transport Bay']],
  ['Rehabilitation Services',
   ['Rehab Aide','Physiotherapy Aide','Occupational Therapy Assistant','Restorative Care Worker'],
   ['Rehabilitation Unit']],
  ['Social Services',
   ['Social Services Worker','Case Coordinator','Community Support Worker','Housing Support Worker'],
   ['Social Work Office','Community Outreach']],
  ['Pharmacy Support',
   ['Pharmacy Assistant','Pharmacy Aide','Medication Cart Aide'],
   ['Pharmacy']],
  ['Laboratory Support',
   ['Lab Aide','Laboratory Assistant','Specimen Handler'],
   ['Laboratory']],
  ['Security',
   ['Security Officer','Security Aide'],
   ['Main Entrance','Emergency Wing']],
]

const STATUS_WEIGHTS = [
  'active','active','active','active','active','active','active',  // 70 %
  'active','active','active',                                       // → 100 % active ×10
  'on-leave','on-leave',                                           // ~15 %
  'inactive',                                                       // ~5 %  (remainder = active)
]

function generateBulk(start: number, count: number) {
  const FN = FIRST_NAMES
  const LN = LAST_NAMES
  const out: Array<Record<string, unknown>> = []
  for (let i = 0; i < count; i++) {
    const seq  = start + i
    const sn   = String(seq).padStart(4, '0')
    const fn   = FN[(seq * 7)  % FN.length]
    const ln   = LN[(seq * 11) % LN.length]
    const [dept, positions, locations] = DEPT_POOL[seq % DEPT_POOL.length]
    const position = positions[(seq * 3) % positions.length]
    const location = locations[(seq * 5) % locations.length]
    const status   = STATUS_WEIGHTS[seq % STATUS_WEIGHTS.length]
    const hireYear = 2004 + (seq % 21)           // hire years 2004–2024
    const hireMo   = (seq % 12) + 1
    const hireDay  = (seq % 28) + 1
    const seniority = 2026 - hireYear
    const joinYear  = hireYear + (hireMo >= 7 ? 1 : 0)
    const joinMo    = hireMo >= 7 ? hireMo - 5 : hireMo + 6
    const hire = new Date(`${hireYear}-${String(hireMo).padStart(2,'0')}-${String(hireDay).padStart(2,'0')}T00:00:00.000Z`)
    const join = new Date(`${joinYear}-${String(joinMo).padStart(2,'0')}-01T00:00:00.000Z`)
    out.push({
      id:                    `c4373003-0000-4000-8000-${sn.padStart(12, '0')}`,
      userId:                `cupe4373-g-${sn}`,
      name:                  `${fn} ${ln}`,
      email:                 `member.${seq}@local4373.ca`,
      phone:                 `613-555-${sn}`,
      role:                  'member',
      status,
      isPrimary:             true,
      department:            dept,
      position,
      hireDate:              hire,
      seniority,
      membershipNumber:      `C4373-${sn}`,
      unionJoinDate:         join,
      location,
      preferredContactMethod: seq % 3 === 0 ? 'phone' : 'email',
    })
  }
  return out
}

const ALL_MEMBERS = [
  ...MEMBERS,
  ...buildExtended(EXTENDED_ROWS),
  ...generateBulk(163, 1300),
]

async function main() {
  console.log(`\n🏗  Seeding CUPE Local 4373 demo members (org: ${ORG_ID})\n`)

  let inserted = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const m of ALL_MEMBERS) {
    const result = await db.execute(sql`
      INSERT INTO organization_members (
        id, user_id, organization_id, name, email, phone,
        role, status, is_primary, department, location, position,
        hire_date, membership_number, seniority, union_join_date,
        preferred_contact_method, created_at, joined_at, updated_at
      ) VALUES (
        ${m.id}::uuid,
        ${m.userId},
        ${ORG_ID},
        ${m.name},
        ${m.email},
        ${m.phone},
        ${m.role},
        ${m.status},
        ${m.isPrimary},
        ${m.department},
        ${m.location},
        ${m.position},
        ${(m.hireDate as Date).toISOString()}::timestamptz,
        ${m.membershipNumber},
        ${m.seniority},
        ${(m.unionJoinDate as Date).toISOString()}::timestamptz,
        ${m.preferredContactMethod},
        ${now}::timestamptz,
        ${(m.unionJoinDate as Date).toISOString()}::timestamptz,
        ${now}::timestamptz
      )
      ON CONFLICT (organization_id, user_id) DO NOTHING
      RETURNING id
    `)

    if (result.length > 0) {
      console.log(`  ✓  ${m.membershipNumber}  ${m.name}  (${m.role})`)
      inserted++
    } else {
      console.log(`  –  ${m.membershipNumber}  ${m.name}  [already exists, skipped]`)
      skipped++
    }
  }

  console.log(`\n✅  Done — ${inserted} inserted, ${skipped} skipped\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error('❌  Seed failed:', err)
  process.exit(1)
})
