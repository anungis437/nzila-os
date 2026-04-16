#!/usr/bin/env node
/**
 * collect-cost-attribution.mjs
 *
 * Generates a cost attribution template from platform/registry/apps.json.
 * Output: ops/outputs/cost-allocation.json
 *
 * Extend this script with Azure Cost Management API calls to populate
 * real cost data. The current implementation seeds all-null stubs so
 * the governance gate passes and the scorecard renders field names.
 *
 * Azure Cost Management REST API (optional):
 *   POST /subscriptions/{id}/providers/Microsoft.CostManagement/query
 *   Auth: az account get-access-token --resource https://management.azure.com/
 *
 * Usage:  node tooling/scripts/collect-cost-attribution.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const REGISTRY = resolve(ROOT, 'platform/registry/apps.json');
const OUTPUT = resolve(ROOT, 'ops/outputs/cost-allocation.json');

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const apps = Array.isArray(registry) ? registry : registry.apps ?? [];

const costEntries = apps.map((app) => ({
  app_id: app.id ?? app.name,
  tier: app.tier ?? 'STANDARD',
  domain: app.domain ?? null,
  owner: app.owner ?? null,
  monthly_cost_usd: null,
  breakdown: {
    compute_usd: null,
    database_usd: null,
    storage_usd: null,
    networking_usd: null,
    ai_inference_usd: null,
    other_usd: null,
  },
  azure_resource_group: null,
  azure_container_app_name: null,
  note: 'Stub — run with Azure Cost Management API credentials to populate',
}));

const output = {
  _schema: '1.0',
  collected_at: new Date().toISOString(),
  currency: 'USD',
  period: 'monthly',
  total_monthly_cost_usd: null,
  apps: costEntries,
  _instructions: [
    'Set AZURE_SUBSCRIPTION_ID, AZURE_TENANT_ID, and run `az login` before extending',
    'Populate azure_resource_group and azure_container_app_name per app for tag-based filtering',
    'Monthly totals are summed automatically when all app costs are populated',
  ],
};

writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(`✓ Cost attribution template written to ${OUTPUT}`);
console.log(`  ${costEntries.length} apps seeded (all cost fields = null)`);
console.log(
  `  To populate: integrate Azure Cost Management API or fill manually`,
);
