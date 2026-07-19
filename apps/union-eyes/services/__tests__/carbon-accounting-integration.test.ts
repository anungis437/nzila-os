import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  azureResources: [] as Array<{ id: string; type: string; location: string; name: string }>,
  azureThrow: false,
  recordEmissions: vi.fn(),
  generateCarbonReport: vi.fn(),
  purchaseCarbonOffsets: vi.fn(),
}));

vi.mock('../carbon-accounting-service', () => ({
  carbonAccountingService: {
    recordEmissions: h.recordEmissions,
    generateCarbonReport: h.generateCarbonReport,
    purchaseCarbonOffsets: h.purchaseCarbonOffsets,
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@azure/identity', () => ({ DefaultAzureCredential: class {} }));
vi.mock('@azure/arm-resources', () => ({
  ResourceManagementClient: class {
    resources = {
      listByResourceGroup: (_rg: string) => {
        if (h.azureThrow) throw new Error('not authenticated');
        return (async function* () {
          for (const r of h.azureResources) yield r;
        })();
      },
    };
  },
}));

import { CarbonAccountingIntegration, carbonAccountingIntegration } from '../carbon-accounting-integration';

const params = { subscriptionId: 'sub-1', resourceGroupName: 'rg-1' };

beforeEach(() => {
  h.azureThrow = false;
  h.azureResources = [
    { id: 'vm-1', type: 'Microsoft.Compute/virtualMachines', location: 'eastus', name: 'vm1' }, // non-renewable, high emission
    { id: 'st-1', type: 'Microsoft.Storage/storageAccounts', location: 'canadaeast', name: 'st1' }, // renewable, low
  ];
  h.recordEmissions.mockReset().mockResolvedValue({ id: 'report-1' });
  h.generateCarbonReport.mockReset().mockResolvedValue({
    totalOffsets: 50,
    totalEmissions: 400,
    netEmissions: -10,
    offsetBreakdown: { verified: 100 },
  });
  h.purchaseCarbonOffsets.mockReset().mockResolvedValue({ id: 'offset-1', status: 'completed' });
});

describe('carbon-accounting-integration', () => {
  const svc = () => new CarbonAccountingIntegration();

  describe('monitorAzureInfrastructure', () => {
    it('aggregates emissions and produces recommendations', async () => {
      const result = await svc().monitorAzureInfrastructure(params);
      expect(result.resources).toHaveLength(2);
      expect(result.totalEmissions).toBeGreaterThan(0);
      // one non-renewable + one high-emission (>100) resource
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(result.recommendations.join(' ')).toContain('non-renewable');
    });

    it('returns no recommendations when all renewable and low emission', async () => {
      h.azureResources = [
        { id: 'st-1', type: 'Microsoft.Storage/storageAccounts', location: 'canadaeast', name: 'st1' },
      ];
      const result = await svc().monitorAzureInfrastructure(params);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('isRenewableRegion', () => {
    it('detects renewable regions (normalized)', async () => {
      expect(await svc().isRenewableRegion('Canada East')).toBe(true);
      expect(await svc().isRenewableRegion('eastus')).toBe(false);
    });
  });

  describe('calculateResourceEmissions', () => {
    it('uses the default factor for unknown types and reduces for renewable regions', async () => {
      const nonRenewable = await svc().calculateResourceEmissions({ id: 'x', type: 'Unknown/type', location: 'eastus' });
      const renewable = await svc().calculateResourceEmissions({ id: 'x', type: 'Unknown/type', location: 'canadaeast' });
      expect(nonRenewable).toBeGreaterThan(renewable);
    });
  });

  describe('getAzureResources (via monitor)', () => {
    it('returns an empty list and no resources when the Azure SDK throws', async () => {
      h.azureThrow = true;
      const result = await svc().monitorAzureInfrastructure(params);
      expect(result.resources).toEqual([]);
      expect(result.totalEmissions).toBe(0);
    });
  });

  describe('recordInfrastructureEmissions', () => {
    it('records emissions in the carbon accounting system', async () => {
      const result = await svc().recordInfrastructureEmissions({ period: new Date('2026-01-01'), ...params });
      expect(result.reportId).toBe('report-1');
      expect(result.resources).toBe(2);
      expect(h.recordEmissions).toHaveBeenCalledOnce();
    });
  });

  describe('getCarbonDashboard', () => {
    it('summarizes current month, ytd, renewable and neutrality', async () => {
      const result = await svc().getCarbonDashboard(params);
      expect(result.renewable.percentage).toBeGreaterThanOrEqual(0);
      expect(result.ytd.net).toBe(-10);
      expect(result.carbonNeutral).toBe(true);
    });
  });

  describe('autoPurchaseCarbonOffsets', () => {
    it('purchases offsets for the period emissions', async () => {
      const result = await svc().autoPurchaseCarbonOffsets({ period: new Date('2026-01-01'), ...params });
      expect(result.offsetId).toBe('offset-1');
      expect(result.provider).toBe('Bullfrog Power');
      expect(result.cost).toBe(result.amount * 25);
    });
  });

  describe('validateCarbonNeutralClaim', () => {
    it('returns canClaim true when all requirements met', async () => {
      const result = await svc().validateCarbonNeutralClaim();
      expect(result.canClaim).toBe(true);
      expect(result.requirements).toHaveLength(4);
    });

    it('returns canClaim false when net emissions positive', async () => {
      h.generateCarbonReport.mockResolvedValue({
        totalOffsets: 0,
        totalEmissions: 400,
        netEmissions: 400,
        offsetBreakdown: { verified: 0 },
      });
      const result = await svc().validateCarbonNeutralClaim();
      expect(result.canClaim).toBe(false);
      expect(result.reason).toContain('not met');
    });
  });

  it('exposes a singleton instance', () => {
    expect(carbonAccountingIntegration).toBeInstanceOf(CarbonAccountingIntegration);
  });
});
