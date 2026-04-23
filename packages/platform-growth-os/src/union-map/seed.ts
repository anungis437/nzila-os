/**
 * Canadian union landscape seed data.
 *
 * Sources: CLC directory, CUPE.ca, public union websites.
 * Member counts are public estimates (annual reports / websites).
 * Contact fields are null until researched — no fabricated emails.
 */
import { createUnionNode, createExpansion, listUnionNodes } from './map'
import type { UnionNode } from './types'

const PLATFORM_SCOPE: UnionNode['scope'] = {
  tenantId: 'nzila-os',
  orgId: 'platform',
  product: 'union-eyes',
}

const BASE_NODE = {
  scope: PLATFORM_SCOPE,
  primaryContactName: null,
  primaryContactTitle: null,
  primaryContactEmail: null,
  inPipeline: false,
  dealEngineId: null,
  notes: '',
}

/**
 * Canonical seed IDs — stable references for expansion relationships.
 * Prefixed with 'seed-' so they do not collide with makeId() outputs.
 */
const IDS = {
  CUPE_NATIONAL:    'seed-cupe-national',
  CUPE_LOCAL_416:   'seed-cupe-local-416',
  CUPE_LOCAL_79:    'seed-cupe-local-79',
  CUPE_LOCAL_4400:  'seed-cupe-local-4400',
  CUPE_LOCAL_3902:  'seed-cupe-local-3902',
  CAPE_ACEP:        'seed-cape-acep',
  PSAC_NATIONAL:    'seed-psac-national',
  ONA:              'seed-ona',
  OPSEU:            'seed-opseu',
  TEAMSTERS_938:    'seed-teamsters-938',
  ATU_113:          'seed-atu-113',
  UNIFOR_NATIONAL:  'seed-unifor-national',
  UFCW_CANADA:      'seed-ufcw-canada',
  CLC:              'seed-clc',
}

const SEED_NODES: (Omit<UnionNode, 'createdAt' | 'updatedAt'> & { id: string })[] = [
  {
    ...BASE_NODE, id: IDS.CLC,
    name: 'CLC', fullName: 'Canadian Labour Congress',
    unionScope: 'national', parentId: null, sector: 'federal',
    province: null, memberCount: 3000000,
    websiteUrl: 'https://canadianlabour.ca',
    notes: 'National federation; not a direct target but warm paths through affiliates.',
  },
  {
    ...BASE_NODE, id: IDS.CUPE_NATIONAL,
    name: 'CUPE', fullName: 'Canadian Union of Public Employees',
    unionScope: 'national', parentId: IDS.CLC, sector: 'municipal',
    province: null, memberCount: 715000,
    websiteUrl: 'https://cupe.ca',
    notes: "Canada's largest union. Primary target via locals.",
  },
  {
    ...BASE_NODE, id: IDS.CUPE_LOCAL_416,
    name: 'CUPE Local 416', fullName: 'CUPE Local 416 — City of Toronto Outside Workers',
    unionScope: 'local', parentId: IDS.CUPE_NATIONAL, sector: 'municipal',
    province: 'CA-ON', memberCount: 6000,
    websiteUrl: 'https://cupe416.ca',
    notes: 'Tier A. Municipal sector. High grievance volume. Ideal pilot target.',
  },
  {
    ...BASE_NODE, id: IDS.CUPE_LOCAL_79,
    name: 'CUPE Local 79', fullName: 'CUPE Local 79 — City of Toronto Inside Workers',
    unionScope: 'local', parentId: IDS.CUPE_NATIONAL, sector: 'municipal',
    province: 'CA-ON', memberCount: 20000,
    websiteUrl: 'https://cupe79.ca',
    notes: 'Tier A. Largest CUPE local in Ontario. Major expansion target if 416 converts.',
  },
  {
    ...BASE_NODE, id: IDS.CUPE_LOCAL_4400,
    name: 'CUPE Local 4400', fullName: 'CUPE Local 4400 — Toronto District School Board',
    unionScope: 'local', parentId: IDS.CUPE_NATIONAL, sector: 'education',
    province: 'CA-ON', memberCount: 12000,
    websiteUrl: 'https://cupelocal4400.ca',
    notes: 'Tier B. Education sector. Large member base. Budget cycles are school-year aligned.',
  },
  {
    ...BASE_NODE, id: IDS.CUPE_LOCAL_3902,
    name: 'CUPE Local 3902', fullName: 'CUPE Local 3902 — University of Toronto Contract Academic Staff',
    unionScope: 'local', parentId: IDS.CUPE_NATIONAL, sector: 'education',
    province: 'CA-ON', memberCount: 8000,
    websiteUrl: 'https://www.cupe3902.org',
    notes: 'Tier B. Post-secondary education. High grievance rate during contract disputes.',
  },
  {
    ...BASE_NODE, id: IDS.CAPE_ACEP,
    name: 'CAPE-ACEP', fullName: 'Canadian Association of Professional Employees',
    unionScope: 'national', parentId: null, sector: 'federal',
    province: 'CA-ON', memberCount: 22000,
    websiteUrl: 'https://acep-cape.ca',
    notes: 'Tier A. Federal public service. Complex grievance adjudication. Strong procurement path.',
    inPipeline: true,
    dealEngineId: 'deal-002',
  },
  {
    ...BASE_NODE, id: IDS.PSAC_NATIONAL,
    name: 'PSAC', fullName: 'Public Service Alliance of Canada',
    unionScope: 'national', parentId: IDS.CLC, sector: 'federal',
    province: null, memberCount: 230000,
    websiteUrl: 'https://psacunion.ca',
    notes: 'Tier A. Largest federal union. Procurement complexity is high; approach via CAPE-ACEP warm path.',
  },
  {
    ...BASE_NODE, id: IDS.ONA,
    name: 'ONA', fullName: 'Ontario Nurses Association',
    unionScope: 'provincial', parentId: null, sector: 'healthcare',
    province: 'CA-ON', memberCount: 68000,
    websiteUrl: 'https://ona.org',
    notes: 'Tier A. Healthcare sector. Patient care + labour rights complexity ideal for UE.',
  },
  {
    ...BASE_NODE, id: IDS.OPSEU,
    name: 'OPSEU', fullName: 'Ontario Public Service Employees Union',
    unionScope: 'provincial', parentId: IDS.CLC, sector: 'provincial',
    province: 'CA-ON', memberCount: 180000,
    websiteUrl: 'https://opseu.org',
    notes: 'Tier A. Large provincial public service union. Multiple bargaining units with differing needs.',
  },
  {
    ...BASE_NODE, id: IDS.TEAMSTERS_938,
    name: 'Teamsters Local 938', fullName: 'Teamsters Canada Local 938',
    unionScope: 'local', parentId: null, sector: 'trades',
    province: 'CA-ON', memberCount: 3500,
    websiteUrl: null,
    notes: 'In pipeline. Tier B prospect. Transport/trades sector.',
    inPipeline: true,
    dealEngineId: 'deal-003',
  },
  {
    ...BASE_NODE, id: IDS.ATU_113,
    name: 'ATU Local 113', fullName: 'Amalgamated Transit Union Local 113 — TTC Workers',
    unionScope: 'local', parentId: null, sector: 'transit',
    province: 'CA-ON', memberCount: 12000,
    websiteUrl: 'https://atu113.ca',
    notes: 'Tier B. Transit sector. Safety grievances + scheduling disputes. Strong warm path via city union connections.',
  },
  {
    ...BASE_NODE, id: IDS.UNIFOR_NATIONAL,
    name: 'Unifor', fullName: 'Unifor — Canada\'s largest private sector union',
    unionScope: 'national', parentId: IDS.CLC, sector: 'trades',
    province: null, memberCount: 315000,
    websiteUrl: 'https://www.unifor.org',
    notes: 'Tier B at national level; individual locals could be Tier A. Approach via local referral.',
  },
  {
    ...BASE_NODE, id: IDS.UFCW_CANADA,
    name: 'UFCW Canada', fullName: 'United Food and Commercial Workers Canada',
    unionScope: 'national', parentId: IDS.CLC, sector: 'hospitality',
    province: null, memberCount: 250000,
    websiteUrl: 'https://www.ufcw.ca',
    notes: 'Tier C at national level. Hospitality/food sector has lower UE fit. Include if warm path available.',
  },
]

export function bootstrapUnionMap(): void {
  const existing = listUnionNodes()
  if (existing.length > 0) return

  for (const node of SEED_NODES) {
    createUnionNode(node)
  }

  // Expansion relationships
  createExpansion({
    sourceId: IDS.CUPE_LOCAL_416,
    targetId: IDS.CUPE_LOCAL_79,
    relationType: 'same_parent',
    adjacencyScore: 0.9,
    notes: 'Both are major CUPE Toronto municipal locals. Converting 416 creates direct warm path to 79.',
  })
  createExpansion({
    sourceId: IDS.CUPE_LOCAL_416,
    targetId: IDS.CUPE_LOCAL_4400,
    relationType: 'same_parent',
    adjacencyScore: 0.7,
    notes: 'TDSB local in same CUPE Ontario council network.',
  })
  createExpansion({
    sourceId: IDS.CAPE_ACEP,
    targetId: IDS.PSAC_NATIONAL,
    relationType: 'clc_affiliate',
    adjacencyScore: 0.65,
    notes: 'CAPE-ACEP conversion creates warm introduction into PSAC procurement process.',
  })
  createExpansion({
    sourceId: IDS.CUPE_LOCAL_416,
    targetId: IDS.ATU_113,
    relationType: 'same_sector',
    adjacencyScore: 0.6,
    notes: 'Both Toronto public sector unions. City labour council connections.',
  })
  createExpansion({
    sourceId: IDS.ONA,
    targetId: IDS.OPSEU,
    relationType: 'clc_affiliate',
    adjacencyScore: 0.55,
    notes: 'ONA and OPSEU jointly represent healthcare workers in Ontario — shared conference presence.',
  })
}
