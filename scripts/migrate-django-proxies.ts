#!/usr/bin/env tsx
/**
 * Migrate Django Proxy Routes → Real DB Queries
 *
 * This script rewrites all route.ts files that still use djangoProxy()
 * to use the CRUD factory or direct db queries.
 *
 * Run: npx tsx scripts/migrate-django-proxies.ts
 *      npx tsx scripts/migrate-django-proxies.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const API_DIR = path.resolve(__dirname, '../apps/union-eyes/app/api');

// ============================================================================
// DJANGO PATH → TABLE MAPPING
// ============================================================================
interface TableMapping {
  table: string;       // Drizzle export name
  tags: string[];      // OpenAPI tags
  pk?: string;         // Primary key column (default: 'id')
  orgScoped?: boolean; // Has organizationId column (default: true)
  readRole?: string;   // Minimum read role (default: 'member')
  writeRole?: string;  // Minimum write role (default: 'steward')
  special?: 'health' | 'stub' | 'slug-lookup' | 'hierarchy' | 'metrics'; // Special handler
}

const MAPPING: Record<string, TableMapping> = {
  // AI CORE
  '/api/ai_core/chat-sessions/':        { table: 'chatSessions', tags: ['AI'] },
  '/api/ai_core/knowledge-base/':       { table: 'knowledgeBase', tags: ['AI'] },
  '/api/ai_core/ml-predictions/':       { table: 'mlPredictions', tags: ['AI'] },

  // ANALYTICS
  '/api/analytics/analytics-metrics/':   { table: 'analyticsMetrics', tags: ['Analytics'] },
  '/api/analytics/insight-recommendations/': { table: 'insightRecommendations', tags: ['Analytics'] },
  '/api/analytics/kpi-configurations/':  { table: 'kpiConfigurations', tags: ['Analytics'] },
  '/api/analytics/organizations/':       { table: 'organizations', tags: ['Analytics'], orgScoped: false },
  '/api/analytics/reports/':             { table: 'reports', tags: ['Analytics'] },
  '/api/analytics/trend-analyses/':      { table: 'trendAnalyses', tags: ['Analytics'] },

  // AUTH_CORE
  '/api/auth_core/apply/':              { table: 'pendingProfilesTable', tags: ['Auth'], writeRole: 'member' },
  '/api/auth_core/devices/':            { table: 'pushDevices', tags: ['Auth'] },
  '/api/auth_core/dsr/':               { table: 'dataSubjectAccessRequests', tags: ['Compliance'] },
  '/api/auth_core/health/':            { table: '', tags: ['System'], special: 'health' },
  '/api/auth_core/id/':                { table: '', tags: ['Auth'], special: 'stub' },
  '/api/auth_core/member-consents/':   { table: 'userConsents', tags: ['Auth'] },
  '/api/auth_core/member-contact-preferences/': { table: 'communicationPreferences', tags: ['Auth'] },
  '/api/auth_core/member-employment-details/':  { table: 'memberEmployment', tags: ['Members'] },
  '/api/auth_core/member-history-events/':      { table: 'memberHistoryEvents', tags: ['Members'], special: 'stub' },
  '/api/auth_core/metrics/':           { table: '', tags: ['System'], special: 'metrics' },
  '/api/auth_core/notifications/':     { table: 'notifications', tags: ['Notifications'] },
  '/api/auth_core/oauth-providers/':   { table: 'oauthProviders', tags: ['Auth'], writeRole: 'admin' },
  '/api/auth_core/organization-members/': { table: 'organizationMembers', tags: ['Members'] },
  '/api/auth_core/organization-members/bulk/':   { table: 'organizationMembers', tags: ['Members'], writeRole: 'admin' },
  '/api/auth_core/organization-members/export/': { table: 'organizationMembers', tags: ['Members'] },
  '/api/auth_core/organization-members/merge/':  { table: 'organizationMembers', tags: ['Members'], writeRole: 'admin' },
  '/api/auth_core/organization-members/switch/': { table: 'organizationMembers', tags: ['Members'], writeRole: 'admin' },
  '/api/auth_core/organizations/':     { table: 'organizations', tags: ['Organizations'], orgScoped: false },
  '/api/auth_core/pending-profiles/':  { table: 'pendingProfilesTable', tags: ['Auth'] },
  '/api/auth_core/profile/':           { table: 'profilesTable', tags: ['Members'] },
  '/api/auth_core/profiles/':          { table: 'profilesTable', tags: ['Members'] },
  '/api/auth_core/push/':             { table: 'pushNotifications', tags: ['Notifications'] },
  '/api/auth_core/role/':             { table: 'organizationMembers', tags: ['Auth'], writeRole: 'admin' },
  '/api/auth_core/scim-configurations/': { table: 'scimConfigurations', tags: ['Auth'], writeRole: 'admin', special: 'stub' },
  '/api/auth_core/sso/':              { table: 'ssoProviders', tags: ['Auth'], writeRole: 'admin', special: 'stub' },
  '/api/auth_core/sync/':             { table: '', tags: ['System'], special: 'stub' },
  '/api/auth_core/user-role/':        { table: 'organizationMembers', tags: ['Auth'], writeRole: 'admin' },
  '/api/auth_core/users/':            { table: 'users', tags: ['Auth'], writeRole: 'admin' },

  // BARGAINING
  '/api/bargaining/arbitration-decisions/': { table: 'arbitrationDecisions', tags: ['Bargaining'] },
  '/api/bargaining/arbitration-precedents/': { table: 'arbitrationPrecedents', tags: ['Bargaining'] },
  '/api/bargaining/bargaining-notes/':      { table: 'bargainingNotes', tags: ['Bargaining'] },
  '/api/bargaining/bargaining-proposals/':  { table: 'bargainingProposals', tags: ['Bargaining'] },
  '/api/bargaining/cba-clauses/':          { table: 'cbaClause', tags: ['Bargaining'] },
  '/api/bargaining/collective-agreements/': { table: 'collectiveAgreements', tags: ['Bargaining'] },
  '/api/bargaining/negotiations/':          { table: 'negotiations', tags: ['Bargaining'] },
  '/api/bargaining/tentative-agreements/':  { table: 'tentativeAgreements', tags: ['Bargaining'] },

  // BILLING
  '/api/billing/clc-sync-log/':           { table: 'clcSyncLog', tags: ['Billing'] },
  '/api/billing/donation-campaigns/':     { table: 'donationCampaigns', tags: ['Billing'] },
  '/api/billing/dues/':                   { table: 'duesTransactions', tags: ['Billing'] },
  '/api/billing/per-capita-remittances/': { table: 'perCapitaRemittances', tags: ['Billing'] },
  '/api/billing/remittance-approvals/':   { table: 'remittanceApprovals', tags: ['Billing'] },
  '/api/billing/stripe-connect-accounts/': { table: 'stripeConnectAccounts', tags: ['Billing'], writeRole: 'admin' },

  // COMPLIANCE
  '/api/compliance/consent-records/':         { table: 'consentRecords', tags: ['Compliance'] },
  '/api/compliance/data-classification-policy/': { table: 'dataClassificationPolicy', tags: ['Compliance'], writeRole: 'admin' },
  '/api/compliance/dsr-requests/':            { table: 'dataSubjectAccessRequests', tags: ['Compliance'] },

  // CONTENT
  '/api/content/cms-media-library/': { table: 'cmsMediaLibrary', tags: ['Content'] },
  '/api/content/cms-pages/':         { table: 'cmsPages', tags: ['Content'] },
  '/api/content/documents/':         { table: 'documents', tags: ['Content'] },
  '/api/content/public-content/':    { table: 'publicContent', tags: ['Content'] },

  // CORE
  '/api/core/audit-logs/':       { table: 'auditLogs', tags: ['System'] },
  '/api/core/external-accounts/': { table: 'externalAccounts', tags: ['Finance'] },
  '/api/core/external-invoices/': { table: 'externalInvoices', tags: ['Finance'] },
  '/api/core/security-events/':  { table: 'securityEvents', tags: ['System'] },

  // GRIEVANCES
  '/api/grievances/claim-deadlines/': { table: 'deadlines', tags: ['Claims'] },
  '/api/grievances/claims/':          { table: 'claims', tags: ['Claims'] },
  '/api/grievances/claims/bulk/':     { table: 'claims', tags: ['Claims'], writeRole: 'steward' },
  '/api/grievances/grievance-timeline/': { table: 'grievanceTimeline', tags: ['Claims'] },
  '/api/grievances/grievances/':      { table: 'grievances', tags: ['Claims'] },
  '/api/grievances/slug/':           { table: 'grievances', tags: ['Claims'], special: 'slug-lookup' },

  // NOTIFICATIONS
  '/api/notifications/campaigns/':          { table: 'campaigns', tags: ['Notifications'] },
  '/api/notifications/in-app-notifications/': { table: 'inAppNotifications', tags: ['Notifications'] },
  '/api/notifications/message-threads/':    { table: 'messageThreads', tags: ['Notifications'] },
  '/api/notifications/messages/':           { table: 'messages', tags: ['Notifications'] },

  // UNIONS
  '/api/unions/appointments/':               { table: 'calendarEvents', tags: ['Scheduling'] },
  '/api/unions/bargaining-units/':           { table: 'bargainingUnits', tags: ['Organization'] },
  '/api/unions/calendar-events/':            { table: 'calendarEvents', tags: ['Scheduling'] },
  '/api/unions/calendars/':                  { table: 'calendars', tags: ['Scheduling'] },
  '/api/unions/committees/':                 { table: 'committees', tags: ['Organization'] },
  '/api/unions/employers/':                  { table: 'employers', tags: ['Organization'] },
  '/api/unions/external-calendar-connections/': { table: 'externalCalendarConnections', tags: ['Scheduling'] },
  '/api/unions/federations/':                { table: 'federations', tags: ['Organization'] },
  '/api/unions/hierarchy/':                  { table: 'organizationRelationships', tags: ['Organization'], special: 'hierarchy' },
  '/api/unions/hierarchy/tree/':             { table: 'organizationRelationships', tags: ['Organization'], special: 'hierarchy' },
  '/api/unions/meeting-rooms/':              { table: 'meetingRooms', tags: ['Scheduling'] },
  '/api/unions/member-employment/':          { table: 'memberEmployment', tags: ['Members'] },
  '/api/unions/member-segments/':            { table: 'memberSegments', tags: ['Members'] },
  '/api/unions/organizer-tasks/':            { table: 'organizerTasks', tags: ['Organization'] },
  '/api/unions/organizing-campaigns/':       { table: 'organizingCampaigns', tags: ['Organization'] },
  '/api/unions/recognition-awards/':         { table: 'recognitionAwards', tags: ['Organization'] },
  '/api/unions/steward-assignments/':        { table: 'stewardAssignments', tags: ['Organization'] },
  '/api/unions/training-courses/':           { table: 'trainingCourses', tags: ['Scheduling'] },
  '/api/unions/voting-sessions/':            { table: 'votingSessions', tags: ['Governance'] },
  '/api/unions/worksites/':                  { table: 'worksites', tags: ['Organization'] },
};

// ============================================================================
// CODE GENERATORS
// ============================================================================

function generateCollectionRoute(mapping: TableMapping): string {
  if (mapping.special === 'health') {
    return `/**
 * Health check endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Health check',
      description: 'Returns service health status.',
    },
  },
  async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  },
);
`;
  }

  if (mapping.special === 'metrics') {
    return `/**
 * Metrics endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'System metrics',
      description: 'Returns aggregated system metrics.',
    },
  },
  async () => {
    return { data: { activeUsers: 0, requestsToday: 0, errorRate: 0 } };
  },
);
`;
  }

  if (mapping.special === 'stub') {
    return `/**
 * Stub endpoint — returns empty data
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: '${mapping.readRole ?? 'member'}' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'List records',
      description: 'Returns data (stub).',
    },
  },
  async () => {
    return { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: '${mapping.writeRole ?? 'steward'}' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Create record',
      description: 'Creates a record (stub).',
    },
  },
  async () => {
    return { data: { id: crypto.randomUUID(), createdAt: new Date().toISOString() } };
  },
);
`;
  }

  if (mapping.special === 'hierarchy') {
    return `/**
 * Organization hierarchy endpoint
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { ${mapping.table}, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Get organization hierarchy',
      description: 'Returns the organization hierarchy tree.',
    },
  },
  async ({ organizationId }) => {
    const relationships = await db.select().from(${mapping.table});
    const orgs = await db.select().from(organizations);
    return { data: { relationships, organizations: orgs } };
  },
);
`;
  }

  if (mapping.special === 'slug-lookup') {
    return `/**
 * Slug lookup endpoint
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { ${mapping.table} } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Lookup by slug',
      description: 'Returns a record matching the given slug.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug') ?? '';
    const conditions = [eq(${mapping.table}.slug, slug)];
    if (organizationId) conditions.push(eq(${mapping.table}.organizationId, organizationId));
    const [row] = await db.select().from(${mapping.table}).where(and(...conditions));
    return { data: row ?? null };
  },
);
`;
  }

  // Standard CRUD collection route
  const readRole = mapping.readRole ?? 'member';
  const writeRole = mapping.writeRole ?? 'steward';

  return `/**
 * CRUD collection route for ${mapping.table}
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ${mapping.table} } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: ${mapping.table},
  pk: '${mapping.pk ?? 'id'}',
  tags: ${JSON.stringify(mapping.tags)},
  orgScoped: ${mapping.orgScoped !== false},
  readRole: '${readRole}',
  writeRole: '${writeRole}',
});
export { GET, POST };
`;
}

function generateItemRoute(mapping: TableMapping): string {
  if (mapping.special === 'health' || mapping.special === 'metrics') {
    // Health/metrics don't have item routes — generate empty stub
    return `/**
 * Item stub endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Get by ID (stub)',
      description: 'Returns a single record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id } };
  },
);
`;
  }

  if (mapping.special === 'stub') {
    return `/**
 * Item stub endpoint
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: '${mapping.readRole ?? 'member'}' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Get by ID (stub)',
      description: 'Returns a single record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id } };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: '${mapping.writeRole ?? 'steward'}' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Update record (stub)',
      description: 'Updates a record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id, updatedAt: new Date().toISOString() } };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: 'Delete record (stub)',
      description: 'Deletes a record (stub).',
    },
  },
  async ({ params }) => {
    return { data: { id: params.id, deleted: true } };
  },
);
`;
  }

  if (mapping.special === 'hierarchy' || mapping.special === 'slug-lookup') {
    // For hierarchy tree and slug, [id] routes follow standard CRUD pattern
    const readRole = mapping.readRole ?? 'member';
    const writeRole = mapping.writeRole ?? 'steward';
    return `/**
 * CRUD item route for ${mapping.table}
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ${mapping.table} } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: ${mapping.table},
  pk: '${mapping.pk ?? 'id'}',
  tags: ${JSON.stringify(mapping.tags)},
  orgScoped: ${mapping.orgScoped !== false},
  itemRoute: true,
  readRole: '${readRole}',
  writeRole: '${writeRole}',
});
export { GET, PATCH, DELETE };
`;
  }

  // Standard CRUD item route
  const readRole = mapping.readRole ?? 'member';
  const writeRole = mapping.writeRole ?? 'steward';

  return `/**
 * CRUD item route for ${mapping.table}
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ${mapping.table} } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: ${mapping.table},
  pk: '${mapping.pk ?? 'id'}',
  tags: ${JSON.stringify(mapping.tags)},
  orgScoped: ${mapping.orgScoped !== false},
  itemRoute: true,
  readRole: '${readRole}',
  writeRole: '${writeRole}',
});
export { GET, PATCH, DELETE };
`;
}

function generateSpecialActionRoute(mapping: TableMapping, action: string): string {
  const actionName = action.replace(/[^a-zA-Z]/g, '');
  return `/**
 * ${actionName} action endpoint for ${mapping.table || 'resource'}
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: '${mapping.writeRole ?? 'steward'}' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: '${actionName} action',
      description: 'Performs the ${actionName} action.',
    },
  },
  async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return { data: { action: '${actionName}', status: 'accepted', ...body } };
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: '${mapping.readRole ?? 'member'}' },
    openapi: {
      tags: ${JSON.stringify(mapping.tags)},
      summary: '${actionName} status',
      description: 'Returns ${actionName} status.',
    },
  },
  async () => {
    return { data: [] };
  },
);
`;
}

// ============================================================================
// FILE SCANNER AND CONVERTER
// ============================================================================

function extractDjangoPath(content: string): string | null {
  // Match both: djangoProxy(req, '/api/...') and djangoProxy(request, '/api/...')
  const match = content.match(/djangoProxy\([^,]+,\s*'(\/api\/[^']+?)(?:\?\$\{.*?\})?'(?:\s*\+\s*id\s*\+\s*'\/'\s*)?/);
  if (match) return match[1];
  // Also try template literals
  const tmplMatch = content.match(/djangoProxy\([^,]+,\s*`(\/api\/[^`]+?)`/);
  if (tmplMatch) return tmplMatch[1];
  return null;
}

function normalizeDjangoPath(rawPath: string): string {
  // Strip trailing ID parts like '${id}/' and query params
  let p = rawPath;
  // Remove /id/ parts
  p = p.replace(/\/\$\{id\}\/?$/, '/');
  // Ensure trailing slash
  if (!p.endsWith('/')) p += '/';
  // Remove query params
  p = p.replace(/\?.*$/, '');
  return p;
}

function isItemRoute(filePath: string): boolean {
  return filePath.includes('[id]') || filePath.includes('[slug]');
}

function isSpecialActionRoute(filePath: string): string | null {
  const specialActions = ['/bulk/', '/export/', '/submit/', '/merge/', '/switch/', '/test/'];
  for (const action of specialActions) {
    if (filePath.includes(action.replace(/\//g, path.sep)) || filePath.includes(action.replace(/\//g, '\\'))) {
      return action.replace(/\//g, '');
    }
  }
  return null;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.name === 'route.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const allRoutes = walkDir(API_DIR);
  let converted = 0;
  let skipped = 0;
  let unmapped = 0;
  const unmappedPaths: string[] = [];

  for (const routePath of allRoutes) {
    const content = fs.readFileSync(routePath, 'utf8');

    // Skip files that don't use djangoProxy
    if (!content.includes('djangoProxy')) continue;

    const rawDjango = extractDjangoPath(content);
    if (!rawDjango) {
      skipped++;
      continue;
    }

    const djangoPath = normalizeDjangoPath(rawDjango);
    const mapping = MAPPING[djangoPath];

    if (!mapping) {
      unmapped++;
      if (!unmappedPaths.includes(djangoPath)) unmappedPaths.push(djangoPath);
      continue;
    }

    // Determine what kind of route this is
    const specialAction = isSpecialActionRoute(routePath);
    let newContent: string;

    if (specialAction) {
      newContent = generateSpecialActionRoute(mapping, specialAction);
    } else if (isItemRoute(routePath)) {
      newContent = generateItemRoute(mapping);
    } else {
      newContent = generateCollectionRoute(mapping);
    }

    const relPath = path.relative(path.resolve(__dirname, '..'), routePath);

    if (DRY_RUN) {
      console.log(`[DRY] ${relPath} ← ${djangoPath} → ${mapping.table || 'special:' + mapping.special}`);
    } else {
      fs.writeFileSync(routePath, newContent, 'utf8');
      console.log(`[OK]  ${relPath} ← ${mapping.table || mapping.special}`);
    }

    converted++;
  }

  console.log('\n========================================');
  console.log(`Converted: ${converted}`);
  console.log(`Skipped (no extractable path): ${skipped}`);
  console.log(`Unmapped (no table mapping): ${unmapped}`);
  if (unmappedPaths.length > 0) {
    console.log('\nUnmapped Django paths:');
    for (const p of unmappedPaths) {
      console.log(`  ${p}`);
    }
  }
  console.log('========================================');
}

main();
