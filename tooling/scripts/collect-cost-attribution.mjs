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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const REGISTRY = resolve(ROOT, 'platform/registry/apps.json');
const OUTPUT = resolve(
  ROOT,
  process.env.COST_OUTPUT_PATH ?? 'ops/outputs/cost-allocation.json',
);

const FORCE_ENABLE_AZURE_API = process.argv.includes('--enable-azure-api');
const FORCE_ENFORCE_REAL_DATA = process.argv.includes('--enforce-real-data');

const ENABLE_AZURE_API =
  FORCE_ENABLE_AZURE_API ||
  String(process.env.COST_ENABLE_AZURE_API ?? '0').toLowerCase() === '1' ||
  String(process.env.COST_ENABLE_AZURE_API ?? '0').toLowerCase() === 'true';
const ENFORCE_REAL_DATA =
  FORCE_ENFORCE_REAL_DATA ||
  String(process.env.COST_ENFORCE_REAL_DATA ?? '0').toLowerCase() === '1' ||
  String(process.env.COST_ENFORCE_REAL_DATA ?? '0').toLowerCase() === 'true';
const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID ?? '';

function isWithinRoot(path) {
  const normalizedRoot = ROOT.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedPath = path.replace(/\\/g, '/');
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function parseJsonFile() {
  if (!isWithinRoot(REGISTRY)) {
    throw new Error(`Refusing to read untrusted path outside repository root: ${REGISTRY}`);
  }
  if (!existsSync(REGISTRY)) {
    throw new Error(`Required file missing: ${REGISTRY}`);
  }
  try {
    return JSON.parse(readFileSync(REGISTRY, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON file ${REGISTRY}: ${message}`);
  }
}

function ensureOutputDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function queryAzureCostByResourceGroup(subscriptionId) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const body = {
    type: 'ActualCost',
    timeframe: 'Custom',
    timePeriod: {
      from: monthStart.toISOString().split('T')[0],
      to: monthEnd.toISOString().split('T')[0],
    },
    dataset: {
      granularity: 'None',
      aggregation: {
        totalCost: {
          name: 'PreTaxCost',
          function: 'Sum',
        },
      },
      grouping: [
        {
          type: 'Dimension',
          name: 'ResourceGroupName',
        },
      ],
    },
  };

  const uri =
    `https://management.azure.com/subscriptions/${subscriptionId}` +
    `/providers/Microsoft.CostManagement/query?api-version=2023-03-01`;

  const result = spawnSync(
    'az',
    ['rest', '--method', 'post', '--uri', uri, '--body', JSON.stringify(body)],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'unknown az error';
    throw new Error(`Azure Cost Management API query failed: ${stderr}`);
  }

  const payload = JSON.parse(result.stdout || '{}');
  const rows = payload?.properties?.rows;
  if (!Array.isArray(rows)) {
    throw new Error('Azure Cost Management API response missing properties.rows');
  }

  const map = new Map();
  let total = 0;
  for (const row of rows) {
    const cost = Number(row?.[0] ?? 0);
    const resourceGroup = String(row?.[1] ?? '').trim();
    if (!resourceGroup) continue;
    const current = map.get(resourceGroup) ?? 0;
    map.set(resourceGroup, Number((current + cost).toFixed(2)));
    total += cost;
  }

  return {
    byResourceGroup: map,
    totalMonthlyCostUsd: Number(total.toFixed(2)),
    periodStart: monthStart.toISOString().split('T')[0],
    periodEnd: monthEnd.toISOString().split('T')[0],
  };
}

const registry = parseJsonFile();
const apps = Array.isArray(registry) ? registry : registry.apps ?? [];

let apiCostData = null;
let dataSource = 'template';
let apiError = null;
if (ENABLE_AZURE_API) {
  if (!SUBSCRIPTION_ID) {
    apiError = 'COST_ENABLE_AZURE_API is set but AZURE_SUBSCRIPTION_ID is missing';
  } else {
    try {
      apiCostData = queryAzureCostByResourceGroup(SUBSCRIPTION_ID);
      dataSource = 'azure-cost-management-api';
    } catch (error) {
      apiError = error instanceof Error ? error.message : String(error);
      dataSource = 'template_fallback';
    }
  }
}

const costEntries = apps.map((app) => ({
  app_id: app.id ?? app.name,
  tier: app.tier ?? 'STANDARD',
  domain: app.domain ?? null,
  owner: app.owner ?? null,
  monthly_cost_usd:
    apiCostData && app.azure_resource_group
      ? (apiCostData.byResourceGroup.get(app.azure_resource_group) ?? null)
      : null,
  breakdown: {
    compute_usd: null,
    database_usd: null,
    storage_usd: null,
    networking_usd: null,
    ai_inference_usd: null,
    other_usd: null,
  },
  sustainability: {
    estimated_energy_kwh: null,
    estimated_carbon_kg_co2e: null,
  },
  azure_resource_group: app.azure_resource_group ?? null,
  azure_container_app_name: null,
  note:
    dataSource === 'azure-cost-management-api'
      ? 'Populated from Azure Cost Management API where app.azure_resource_group is defined'
      : 'Stub — set COST_ENABLE_AZURE_API=1 and AZURE_SUBSCRIPTION_ID to populate',
}));

const unresolvedAppCount = costEntries.filter((entry) => entry.monthly_cost_usd === null).length;

const output = {
  _schema: '1.0',
  collected_at: new Date().toISOString(),
  currency: 'USD',
  period: apiCostData
    ? `${apiCostData.periodStart}..${apiCostData.periodEnd}`
    : 'monthly',
  total_monthly_cost_usd: apiCostData?.totalMonthlyCostUsd ?? null,
  data_source: dataSource,
  unresolved_app_count: unresolvedAppCount,
  errors: apiError ? [apiError] : [],
  apps: costEntries,
  _instructions: [
    'Set COST_ENABLE_AZURE_API=1 and AZURE_SUBSCRIPTION_ID, then run az login for real billing data',
    'Populate platform/registry/apps.json with azure_resource_group for each app to map API cost rows',
    'Set COST_ENFORCE_REAL_DATA=1 in CI to fail when unresolved_app_count > 0',
  ],
};

if (ENFORCE_REAL_DATA && unresolvedAppCount > 0) {
  output.errors.push(
    `Real data enforcement failed: ${unresolvedAppCount} apps still unresolved in cost allocation`,
  );
}

ensureOutputDir(OUTPUT);
writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(`✓ Cost attribution template written to ${OUTPUT}`);
console.log(`  ${costEntries.length} apps processed`);
console.log(`  Data source           : ${dataSource}`);
console.log(`  Unresolved app costs  : ${unresolvedAppCount}`);

if (apiError) {
  console.warn(`WARN: ${apiError}`);
}

if (ENFORCE_REAL_DATA && unresolvedAppCount > 0) {
  console.error('✗ Cost attribution enforcement failed');
  process.exit(1);
}
