/**
 * GET /api/carbon/infrastructure
 * Migrated to withApi() framework
 */
import type { AzureInfrastructureMonitoring } from '@/lib/types/compliance-api-types';
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Carbon'],
      summary: 'GET infrastructure',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const searchParams = request.nextUrl.searchParams;
        const region = searchParams.get('region') || 'all';
        const resourceType = searchParams.get('resourceType');
        const monitoring: AzureInfrastructureMonitoring[] = [
          {
            region: 'eastus',
            resourceType: 'compute',
            estimatedEmissions: 567.89,
            optimizationOpportunities: [
              'Right-size VM instances',
              'Use Azure Spot VMs for non-critical workloads',
              'Increase consolidation ratio',
              'Migrate to ARM-based processors',
            ],
            renewableEnergyPercentage: 78,
          },
          {
            region: 'eastus',
            resourceType: 'database',
            estimatedEmissions: 234.56,
            optimizationOpportunities: [
              'Consolidate small databases',
              'Archive cold data',
              'Use serverless options',
              'Optimize index usage',
            ],
            renewableEnergyPercentage: 78,
          },
          {
            region: 'canadacentral',
            resourceType: 'storage',
            estimatedEmissions: 123.45,
            optimizationOpportunities: [
              'Enable storage tiering',
              'Delete unused backups',
              'Compress data',
              'Use blob access tiers',
            ],
            renewableEnergyPercentage: 95,
          },
          {
            region: 'westeurope',
            resourceType: 'network',
            estimatedEmissions: 87.65,
            optimizationOpportunities: [
              'Consolidate gateways',
              'Use CDN for content delivery',
              'Optimize data transfer paths',
              'Remove unused peering connections',
            ],
            renewableEnergyPercentage: 85,
          },
        ];
        // Filter results
        let results = monitoring;
        if (region !== 'all') {
          results = results.filter(m => m.region === region);
        }
        if (resourceType) {
          results = results.filter(m => m.resourceType === resourceType);
        }
        return { region,
          resourceType: resourceType || 'all',
          infrastructure: results,
          totalEmissions: results.reduce((sum, m) => sum + m.estimatedEmissions, 0),
          averageRenewablePercentage: Math.round(
            results.reduce((sum, m) => sum + m.renewableEnergyPercentage, 0) / results.length
          ),
          summary: {
            monitoredRegions: [...new Set(results.map(m => m.region))],
            resourceTypes: [...new Set(results.map(m => m.resourceType))],
            lastUpdated: new Date().toISOString(),
          },
          message: `Infrastructure monitoring for ${region === 'all' ? 'all regions' : region}: ${results.length} resource types monitored`, };
  },
);
