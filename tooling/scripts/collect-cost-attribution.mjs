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
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crossSpawn from 'cross-spawn';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const REGISTRY = resolve(ROOT, 'platform/registry/apps.json');
const DEPLOYMENT_INVENTORY = resolve(ROOT, 'governance/release/deployment-inventory.json');
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

function parseJsonFileOptional(path) {
  if (!isWithinRoot(path)) {
    throw new Error(`Refusing to read untrusted path outside repository root: ${path}`);
  }
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON file ${path}: ${message}`);
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

  const result = crossSpawn.sync(
    'az',
    ['rest', '--method', 'post', '--uri', uri, '--body', JSON.stringify(body)],
    { encoding: 'utf8' },
  );

  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : '';
    throw new Error(`Azure CLI process launch failed${code}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || result.stdout?.trim() || `exit code ${result.status}`;
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
const deploymentInventory = parseJsonFileOptional(DEPLOYMENT_INVENTORY);

const deploymentApps = deploymentInventory?.apps ?? {};
const sharedResourceGroup =
  deploymentInventory?.topology?.staging?.resourceGroup ??
  deploymentInventory?.topology?.production?.resourceGroup ??
  null;

const OUT_OF_SCOPE_RELEASE_STATUSES = new Set(['not-deployed', 'deprecated', 'frozen']);

function resolveDeploymentMetadata(appName) {
  const meta = deploymentApps?.[appName] ?? null;
  if (!meta) {
    return {
      inScopeForLiveCost: true,
      scopeReason: 'registry-only',
      inferredResourceGroup: null,
      inferredContainerAppName: null,
    };
  }

  const releaseStatus = String(meta.releaseStatus ?? '').toLowerCase();
  const outOfScope =
    meta.outOfScopeForRuntimeChecks === true || OUT_OF_SCOPE_RELEASE_STATUSES.has(releaseStatus);
  if (outOfScope) {
    return {
      inScopeForLiveCost: false,
      scopeReason: `excluded:${releaseStatus || 'out-of-scope'}`,
      inferredResourceGroup: null,
      inferredContainerAppName: meta.containerAppName ?? null,
    };
  }

  const hasRuntimeSignal =
    meta.stagingDeployed === true ||
    typeof meta.containerAppName === 'string' ||
    typeof meta.routing?.stagingFallback === 'string';

  const inferredResourceGroup = hasRuntimeSignal ? sharedResourceGroup : null;
  const scopeReason = hasRuntimeSignal ? 'deployment-inventory' : 'runtime-unverified';

  return {
    inScopeForLiveCost: hasRuntimeSignal,
    scopeReason,
    inferredResourceGroup,
    inferredContainerAppName: meta.containerAppName ?? null,
  };
}

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

const mappedApps = apps.map((app) => {
  const appName = app.id ?? app.name;
  const deploymentMeta = resolveDeploymentMetadata(appName);
  const azureResourceGroup = app.azure_resource_group ?? deploymentMeta.inferredResourceGroup;
  const azureContainerAppName = app.azure_container_app_name ?? deploymentMeta.inferredContainerAppName;

  return {
    app,
    appName,
    inScopeForLiveCost: deploymentMeta.inScopeForLiveCost,
    scopeReason: deploymentMeta.scopeReason,
    azureResourceGroup,
    azureContainerAppName,
  };
});

const resourceGroupAppCounts = new Map();
for (const mapped of mappedApps) {
  if (!mapped.inScopeForLiveCost || !mapped.azureResourceGroup) continue;
  const current = resourceGroupAppCounts.get(mapped.azureResourceGroup) ?? 0;
  resourceGroupAppCounts.set(mapped.azureResourceGroup, current + 1);
}

const costEntries = mappedApps.map((mapped) => {
  const groupCost =
    apiCostData && mapped.azureResourceGroup
      ? (apiCostData.byResourceGroup.get(mapped.azureResourceGroup) ?? null)
      : null;
  const appCountForGroup = mapped.azureResourceGroup
    ? (resourceGroupAppCounts.get(mapped.azureResourceGroup) ?? 1)
    : 1;
  const monthlyCostUsd =
    groupCost === null || !mapped.inScopeForLiveCost
      ? null
      : Number((groupCost / Math.max(1, appCountForGroup)).toFixed(2));

  return {
    app_id: mapped.appName,
    tier: mapped.app.tier ?? 'STANDARD',
    domain: mapped.app.domain ?? null,
    owner: mapped.app.owner ?? null,
    monthly_cost_usd: monthlyCostUsd,
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
    azure_resource_group: mapped.azureResourceGroup ?? null,
    azure_container_app_name: mapped.azureContainerAppName ?? null,
    in_scope_for_live_cost: mapped.inScopeForLiveCost,
    scope_reason: mapped.scopeReason,
    note:
      dataSource === 'azure-cost-management-api'
        ? 'Populated from Azure Cost Management API; shared RG cost is apportioned across mapped in-scope apps'
        : 'Stub — set COST_ENABLE_AZURE_API=1 and AZURE_SUBSCRIPTION_ID to populate',
  };
});

const unresolvedAppCount = costEntries.filter(
  (entry) => entry.in_scope_for_live_cost && entry.monthly_cost_usd === null,
).length;

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
