/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 40: the frozen SIMPLE_TENANT:org:NORMAL cohort and the
 * first minimal Integration Control Plane production surface.
 *
 * This test intentionally separates two claims:
 * 1. The round-40 cohort is a fixed 23-table list from the starting census.
 * 2. Only the integration tables reached through the new control plane are
 *    promoted to TENANT_RLS_REQUIRED; generated Django mirrors remain denied.
 *
 * STRUCTURAL CORRECTION (round 40 correction pass): the original round-40
 * authority computation used IntegrationRegistry.isAvailable() — a
 * product/catalog flag — as the control-plane security authorization
 * boundary. That conflated "shows up in the product catalog" with "approved
 * to run against tenant data", and produced two concrete errors, both fixed
 * here and in lib/integrations/provider-policy.ts (the new, explicit
 * authorization contract control-plane.ts now consults instead):
 *   1. external_document_libraries/external_document_sites were classified
 *      TENANT_RLS_REQUIRED citing "the approved SharePoint adapter", but
 *      SharePoint has zero entry in IntegrationRegistry AND zero entry in
 *      the new policy contract — IntegrationFactory being able to
 *      construct a SharePointAdapter is a factory capability, not
 *      control-plane approval. Reverted to CONTAINED_NO_AUTHORITY.
 *   2. integration_configs/integration_sync_log were granted
 *      requiredSystemPrivileges + invocationAuthority/dbExecutionPrincipal
 *      'MIXED' to justify issueBackgroundSyncBinding/
 *      executeBackgroundSyncBinding, which have ZERO production callers
 *      anywhere in app/, actions/, lib/, services/ — an anticipatory grant
 *      for dead code. Downgraded to TENANT_USER/TENANT_RUNTIME with no
 *      system privileges; reopen only if a real scheduler/cron caller is
 *      added.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { findDjangoModel, toPascalCase } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');

const ROUND40_FROZEN_COHORT = [
  'ai_insight_reports',
  'allocation_rules',
  'clause_comparisons',
  'clc_per_capita_benchmarks',
  'currency_exchange_rates',
  'data_aggregation_consent',
  'document_folders',
  'external_communication_channels',
  'external_communication_users',
  'external_document_libraries',
  'external_document_sites',
  'external_insurance_claims',
  'integration_configs',
  'legal_holds',
  'pci_dss_encryption_keys',
  'pci_dss_quarterly_scans',
  'pci_dss_requirements',
  'pci_dss_saq_assessments',
  'policy_rules',
  'recognition_programs',
  'retention_policies',
  'support_tickets',
  'webhook_events',
] as const;

const EXPECTED_AUTHORITY = {
  ai_insight_reports: ['TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  allocation_rules: ['LATENT_UNREACHABLE', [], [], 'NONE', 'NONE', 'NONE'],
  clause_comparisons: ['TENANT_RLS_REQUIRED', ['INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  clc_per_capita_benchmarks: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  currency_exchange_rates: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  data_aggregation_consent: ['TENANT_RLS_REQUIRED', ['SELECT'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  document_folders: ['TENANT_RLS_REQUIRED', ['SELECT', 'INSERT'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  external_communication_channels: ['TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  external_communication_users: ['TENANT_RLS_REQUIRED', ['INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  external_document_libraries: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  external_document_sites: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  external_insurance_claims: ['TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  integration_configs: ['TENANT_RLS_REQUIRED', ['SELECT', 'INSERT', 'UPDATE'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  legal_holds: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  pci_dss_encryption_keys: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  pci_dss_quarterly_scans: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  pci_dss_requirements: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  pci_dss_saq_assessments: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  policy_rules: ['NEEDS_REVIEW', 'TBD', 'TBD', 'TBD', 'TBD', 'HIGH'],
  recognition_programs: ['TENANT_RLS_REQUIRED', ['SELECT'], [], 'TENANT_USER', 'TENANT_RUNTIME', 'HIGH'],
  retention_policies: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  support_tickets: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
  webhook_events: ['CONTAINED_NO_AUTHORITY', [], [], 'NONE', 'NONE', 'NONE'],
} as const;

const DJANGO_DENIED_TABLES = [
  'clause_comparisons',
  'clc_per_capita_benchmarks',
  'currency_exchange_rates',
  'data_aggregation_consent',
  'document_folders',
  'external_communication_channels',
  'external_communication_users',
  'external_document_libraries',
  'external_document_sites',
  'external_insurance_claims',
  'integration_configs',
  'legal_holds',
  'pci_dss_encryption_keys',
  'pci_dss_quarterly_scans',
  'pci_dss_requirements',
  'pci_dss_saq_assessments',
  'policy_rules',
  'recognition_programs',
  'retention_policies',
  'support_tickets',
  'webhook_events',
] as const;

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

describe('round 40 frozen SIMPLE_TENANT:org:NORMAL cohort', () => {
  it('stays mechanically frozen at the 23 tables selected from the starting census', () => {
    expect(ROUND40_FROZEN_COHORT).toHaveLength(23);
    expect([...ROUND40_FROZEN_COHORT]).toEqual([...ROUND40_FROZEN_COHORT].sort());
  });

  it.each(ROUND40_FROZEN_COHORT)('%s has the expected final authority shape', (table) => {
    const entry = storageAuthorityManifest.find((candidate) => candidate.table === table);
    expect(entry, `${table}: missing manifest entry`).toBeTruthy();

    const [classification, runtime, system, invocation, principal, priority] = EXPECTED_AUTHORITY[table];
    expect(entry!.classification).toBe(classification);
    expect(entry!.requiredRuntimePrivileges).toEqual(runtime);
    expect(entry!.requiredSystemPrivileges).toEqual(system);
    expect(entry!.invocationAuthority).toBe(invocation);
    expect(entry!.dbExecutionPrincipal).toBe(principal);
    expect(entry!.reviewPriority).toBe(priority);
  });
});

describe('round 40 integration control plane authority root', () => {
  it('exposes only configure/list, activate, and bounded sync routes', () => {
    expect(existsSync(resolve(APP_ROOT, 'app/api/integrations/framework/route.ts'))).toBe(true);
    expect(existsSync(resolve(APP_ROOT, 'app/api/integrations/framework/[id]/activate/route.ts'))).toBe(true);
    expect(existsSync(resolve(APP_ROOT, 'app/api/integrations/framework/[id]/sync/route.ts'))).toBe(true);
    expect(existsSync(resolve(APP_ROOT, 'app/api/external-communication-channels/route.ts'))).toBe(false);
    expect(existsSync(resolve(APP_ROOT, 'app/api/external-document-libraries/route.ts'))).toBe(false);
    expect(existsSync(resolve(APP_ROOT, 'app/api/external-insurance-claims/route.ts'))).toBe(false);
  });

  it('derives tenant authority from withApi context, not request payload organizationId', () => {
    const route = source('app/api/integrations/framework/route.ts');
    const activate = source('app/api/integrations/framework/[id]/activate/route.ts');
    const sync = source('app/api/integrations/framework/[id]/sync/route.ts');

    expect(route.match(/auth:\s*\{\s*required:\s*true,\s*minRole:\s*'steward'\s*\}/g)).toHaveLength(2);
    expect(activate).toMatch(/minRole:\s*'steward'/);
    expect(sync).toMatch(/minRole:\s*'steward'/);

    const schemas = `${route}\n${activate}\n${sync}`.match(/const\s+\w+Schema\s*=\s*z\.object\(\{[\s\S]*?\n\}\);/g) ?? [];
    expect(schemas.join('\n')).not.toMatch(/organizationId|organization_id|orgId|org_id/);
    expect(`${route}\n${activate}\n${sync}`).toMatch(/organizationId!/);
  });

  it('loads integration identity by id plus organization and issues trusted execution contexts', () => {
    const controlPlane = source('lib/integrations/control-plane.ts');
    const syncEngine = source('lib/integrations/sync-engine.ts');

    expect(controlPlane).toMatch(/eq\(integrationConfigs\.id,\s*integrationId\)/);
    expect(controlPlane).toMatch(/eq\(integrationConfigs\.organizationId,\s*organizationId\)/);
    expect(controlPlane).toMatch(/withRLSContext\(\{\s*organizationId\s*\}/);
    expect(controlPlane).toMatch(/withSystemContext\(async\s*\(tx\)\s*=>/);
    expect(controlPlane).toMatch(/Object\.freeze\(\{\s*organizationId,/);
    expect(controlPlane).toMatch(/principal:\s*'TENANT_RUNTIME'/);
    expect(controlPlane).toMatch(/principal:\s*'SYSTEM_RUNTIME'/);
    expect(controlPlane).toMatch(/trustedContext:\s*context/);
    expect(controlPlane).toMatch(/trustedContext:\s*trustedSystemContext\(binding\)/);
    expect(controlPlane.match(/assertKnownProvider\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(controlPlane.match(/assertProviderType\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(syncEngine).toMatch(/TRUSTED_CONTEXT_MISMATCH/);
  });

  it('also promotes integration_sync_log because SyncEngine is now production-reachable through the control plane', () => {
    const entry = storageAuthorityManifest.find((candidate) => candidate.table === 'integration_sync_log');
    expect(entry, 'integration_sync_log: missing manifest entry').toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE']);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });

  it('gates provider approval through the explicit policy contract, not IntegrationRegistry.isAvailable()', () => {
    const controlPlane = source('lib/integrations/control-plane.ts');
    expect(controlPlane).toMatch(/isProviderApprovedForControlPlane\(provider\)/);
    expect(controlPlane).not.toMatch(/registry\.isAvailable\(provider\)/);
  });

  it('rejects settings keys and sync entities not approved for the provider', () => {
    const controlPlane = source('lib/integrations/control-plane.ts');
    expect(controlPlane).toMatch(/findDisallowedSettingsKeys\(/);
    expect(controlPlane).toMatch(/findUnapprovedEntities\(/);
  });

  it('SharePoint has no control-plane policy entry (unreachable, matches CONTAINED_NO_AUTHORITY tables)', () => {
    const policy = source('lib/integrations/provider-policy.ts');
    expect(policy).not.toMatch(/^\s*sharepoint:/m);
  });
});

describe.each(DJANGO_DENIED_TABLES)('round 40 generated Django containment: %s', (table) => {
  it('keeps the generated ViewSet router-registered but fail-closed', () => {
    const django = findDjangoModel(toPascalCase(table));
    expect(django, `${table}: no Django model found`).toBeTruthy();
    expect(django!.routerRegistered, `${table}: generated route should remain visible to the census`).toBe(true);
    expect(django!.usesDenyAll, `${table}: generated ViewSet must use DenyAllPermission`).toBe(true);
  });
});
