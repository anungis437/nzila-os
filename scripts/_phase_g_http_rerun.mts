import { mintAcceptanceAuthToken } from '../packages/platform-auth/src/acceptance-auth.ts';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.PHASE_G_BASE_URL || 'https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io';
const SECRET = process.env.UNION_EYES_ACCEPTANCE_AUTH_SECRET;
if (!SECRET) throw new Error('UNION_EYES_ACCEPTANCE_AUTH_SECRET required');

const IDS = JSON.parse(readFileSync('reports/union-eyes/runtime-schema-lineage/PHASE_G_FIXTURE_IDS.json','utf8')).IDS;

const cases = [
  { name: 'ADMIN_A_health', path: '/api/health', userId: IDS.ADMIN_A },
  { name: 'ADMIN_A_org_current', path: '/api/organizations/current', userId: IDS.ADMIN_A },
  { name: 'MEMBER_A_org_current', path: '/api/organizations/current', userId: IDS.MEMBER_A },
  { name: 'STEWARD_A_org_current', path: '/api/organizations/current', userId: IDS.STEWARD_A },
  { name: 'EXTERNAL_SPECIALIST_A_org_current', path: '/api/organizations/current', userId: IDS.EXTERNAL_SPECIALIST_A },
  { name: 'ADMIN_A_grievances_list', path: '/api/grievances', userId: IDS.ADMIN_A },
  { name: 'ADMIN_A_grievance_A', path: `/api/grievances/${IDS.MATTER_A}`, userId: IDS.ADMIN_A },
  { name: 'ADMIN_A_document_A', path: `/api/documents/repository/${IDS.DOCUMENT_A}`, userId: IDS.ADMIN_A },
  { name: 'BILLING_CYCLE', path: '/api/dues/billing-cycle', userId: IDS.ADMIN_A },
  { name: 'UNAUTHENTICATED', path: '/api/organizations/current', userId: null },
  { name: 'CROSS_ORG_A_reads_B_matter', path: `/api/grievances/${IDS.MATTER_B}`, userId: IDS.ADMIN_A },
  { name: 'CROSS_ORG_B_reads_A_matter', path: `/api/grievances/${IDS.MATTER_A}`, userId: IDS.ADMIN_B },
  { name: 'UNGRANTED_MEMBER_A_doc_B', path: `/api/documents/repository/${IDS.DOCUMENT_B}`, userId: IDS.MEMBER_A },
  { name: 'SAME_ROLE_UNAUTHORIZED_admin_route', path: '/api/admin/organizations', userId: IDS.MEMBER_A },
  { name: 'ADMIN_B_org_current', path: '/api/organizations/current', userId: IDS.ADMIN_B },
];

const http = [];
for (const c of cases) {
  const headers = { Accept: 'application/json' };
  if (c.userId) {
    headers['x-unioneyes-acceptance-auth'] = await mintAcceptanceAuthToken({ userId: c.userId, secret: SECRET });
  }
  let status = 0;
  let bodySnippet = '';
  try {
    const res = await fetch(`${BASE}${c.path}`, { headers });
    status = res.status;
    const text = await res.text();
    bodySnippet = text.slice(0, 240);
  } catch (e) {
    bodySnippet = String(e);
  }
  http.push({ name: c.name, path: c.path, status, userId: c.userId, bodySnippet });
  console.log(c.name, status, bodySnippet.slice(0,120).replace(/\n/g,' '));
}

writeFileSync('reports/union-eyes/runtime-schema-lineage/PHASE_G_HTTP_RERUN.json', JSON.stringify({ generatedAt: new Date().toISOString(), BASE, http }, null, 2));
console.log('wrote PHASE_G_HTTP_RERUN.json');
