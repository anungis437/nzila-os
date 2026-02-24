/**
 * GraphQL Resolvers
 * 
 * Resolver functions for GraphQL queries, mutations, and subscriptions
 */

import { db } from '@/db';
import { claims, profiles } from '@/db/schema';
import { 
  externalInsuranceClaims, 
  externalInsurancePolicies 
} from '@/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { getSystemStatus } from '@/lib/monitoring/status-page';
import type { YogaInitialContext } from 'graphql-yoga';
import { PensionProcessorFactory } from '@/lib/pension-processor';
import {
  PensionPlanType,
  ContributionPeriod,
  PensionMember,
  EmploymentStatus,
} from '@/lib/pension-processor/types';
import { IntegrationFactory } from '@/lib/integrations/factory';
import { IntegrationProvider, SyncType } from '@/lib/integrations/types';
 
 
import type { SQL } from 'drizzle-orm';

export const resolvers = {
  Query: {
    // Claims
    claim: async (_parent: unknown, { id }: { id: string }, _context: YogaInitialContext) => {
      const result = await db.select().from(claims).where(eq(claims.claimId, id)).limit(1);
      return result[0] || null;
    },

    claims: async (
      _parent: unknown,
      { filters, pagination }: { filters?: { status?: string }; pagination?: { first?: number } },
      _context: YogaInitialContext
    ) => {
      const limit = pagination?.first || 20;
      const offset = 0; // Calculate from cursor in production
      
      let query = db.select().from(claims);

      if (filters?.status) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.where(eq(claims.status, filters.status as any)) as typeof query;
      }

      const results = await query.limit(limit).offset(offset).orderBy(desc(claims.createdAt));
      
      return {
        edges: results.map((claim, index) => ({
          node: claim,
          cursor: Buffer.from(`${index}`).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: results.length === limit,
          hasPreviousPage: offset > 0,
          startCursor: results.length > 0 ? Buffer.from('0').toString('base64') : null,
          endCursor: results.length > 0 ? Buffer.from(`${results.length - 1}`).toString('base64') : null,
        },
        totalCount: results.length,
      };
    },

    // Members
    member: async (_parent: unknown, { id }: { id: string }, _context: YogaInitialContext) => {
      const result = await db.select().from(profiles).where(eq(profiles.userId, id)).limit(1);
      return result[0] || null;
    },

    members: async (
      _parent: unknown,
      { status, pagination }: { status?: string; pagination?: { first?: number } },
      _context: YogaInitialContext
    ) => {
      const limit = pagination?.first || 20;
      const offset = 0;

      let query = db.select().from(profiles);

      if (status) {
        query = query.where(eq(profiles.status, status)) as typeof query;
      }

      const results = await query.limit(limit).offset(offset);

      return {
        edges: results.map((member, index) => ({
          node: member,
          cursor: Buffer.from(`${index}`).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: results.length === limit,
          hasPreviousPage: offset > 0,
          startCursor: results.length > 0 ? Buffer.from('0').toString('base64') : null,
          endCursor: results.length > 0 ? Buffer.from(`${results.length - 1}`).toString('base64') : null,
        },
        totalCount: results.length,
      };
    },

    // Pension Processors
    pensionProcessors: async () => {
      const factory = PensionProcessorFactory.getInstance();
      const processors = factory.getAvailableProcessors();
      
      return processors.map(type => {
        const processor = factory.getProcessor(type);
        const capabilities = processor.getCapabilities();
        return {
          type,
          name: type,
          description: `${type.toUpperCase()} Pension Processor`,
          minAge: capabilities.minimumAge,
          maxAge: capabilities.maximumAge,
          supportsBuyBack: capabilities.supportsBuyBack || false,
          supportsEarlyRetirement: capabilities.supportsEarlyRetirement || false,
          supportedProvinces: [],
        };
      });
    },

    pensionProcessor: async (_parent: unknown, { planType }: { planType: string }) => {
      const factory = PensionProcessorFactory.getInstance();
      const processor = factory.getProcessor(planType as PensionPlanType);
      const capabilities = processor.getCapabilities();
      
      return {
        type: processor.type,
        name: planType,
        description: `${planType.toUpperCase()} Pension Processor`,
        minAge: capabilities.minimumAge,
        maxAge: capabilities.maximumAge,
        supportsBuyBack: capabilities.supportsBuyBack || false,
        supportsEarlyRetirement: capabilities.supportsEarlyRetirement || false,
        supportedProvinces: [],
      };
    },

    contributionRates: async (
      _parent: unknown, 
      { planType, year }: { planType: string; year: number }
    ) => {
      const factory = PensionProcessorFactory.getInstance();
      const processor = factory.getProcessor(planType as PensionPlanType);
      const rates = await processor.getContributionRates(year);
      
      return {
        planType: planType,
        year: rates.taxYear,
        employeeRate: rates.employeeRate.toNumber(),
        employerRate: rates.employerRate.toNumber(),
        maximumPensionableEarnings: rates.yearlyMaximumPensionableEarnings.toNumber(),
        basicExemption: rates.basicExemptAmount?.toNumber(),
        maximumContribution: rates.yearlyMaximumContribution.toNumber(),
      };
    },

    remittance: async (_parent: unknown, { id }: { id: string }) => {
      // Mock implementation - would fetch from database in production
      return {
        id,
        planType: 'CPP',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        totalEmployeeContributions: 50000,
        totalEmployerContributions: 50000,
        totalContributions: 100000,
        employeeCount: 250,
        status: 'SUBMITTED',
        confirmationNumber: 'CPP-2026-001',
        submittedAt: new Date('2026-02-01'),
        createdAt: new Date('2026-02-01'),
      };
    },

    remittances: async (
      _parent: unknown, 
      { planType, status }: { planType?: string; status?: string }
    ) => {
      // Mock implementation - would fetch from database in production
      return [
        {
          id: '1',
          planType: planType || 'CPP',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          totalEmployeeContributions: 50000,
          totalEmployerContributions: 50000,
          totalContributions: 100000,
          employeeCount: 250,
          status: status || 'SUBMITTED',
          confirmationNumber: 'CPP-2026-001',
          submittedAt: new Date('2026-02-01'),
          createdAt: new Date('2026-02-01'),
        },
      ];
    },

    // Insurance
    insuranceClaims: async (
      _parent: unknown,
      { provider, status, startDate, endDate, pagination }: { provider?: string; status?: string; startDate?: string; endDate?: string; pagination?: { first?: number } }
    ) => {
      const limit = pagination?.first || 50;
      
      let query = db.select().from(externalInsuranceClaims);

      const conditions: SQL<unknown>[] = [];
      if (provider) {
        conditions.push(eq(externalInsuranceClaims.externalProvider, provider.toLowerCase()));
      }
      if (status) {
        conditions.push(eq(externalInsuranceClaims.status, status));
      }
      if (startDate) {
        conditions.push(gte(externalInsuranceClaims.submissionDate, new Date(startDate).toISOString()));
      }
      if (endDate) {
        conditions.push(lte(externalInsuranceClaims.submissionDate, new Date(endDate).toISOString()));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query
        .limit(limit)
        .orderBy(desc(externalInsuranceClaims.submissionDate));

      return results.map(claim => ({
        id: claim.id,
        claimNumber: claim.claimNumber,
        provider: claim.externalProvider.toUpperCase().replace(/_/g, '_'),
        memberName: claim.employeeName || 'Unknown',
        claimDate: claim.submissionDate,
        claimType: claim.claimType || 'general',
        claimAmount: claim.claimAmount ? parseFloat(claim.claimAmount) : 0,
        approvedAmount: claim.approvedAmount ? parseFloat(claim.approvedAmount) : null,
        paidAmount: claim.paidAmount ? parseFloat(claim.paidAmount) : null,
        status: claim.status,
        providerName: claim.providerName,
        serviceDate: claim.serviceDate,
      }));
    },

    insurancePolicies: async (
      _parent: unknown,
      { provider, status }: { provider?: string; status?: string }
    ) => {
      let query = db.select().from(externalInsurancePolicies);

      const conditions: SQL<unknown>[] = [];
      if (provider) {
        conditions.push(eq(externalInsurancePolicies.externalProvider, provider.toLowerCase()));
      }
      if (status) {
        conditions.push(eq(externalInsurancePolicies.status, status));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const results = await query.orderBy(desc(externalInsurancePolicies.effectiveDate));

      return results.map(policy => ({
        id: policy.id,
        provider: policy.externalProvider.toUpperCase().replace(/_/g, '_'),
        policyNumber: policy.policyNumber,
        policyType: policy.policyType || 'general',
        policyHolder: policy.employeeId || 'Unknown',
        coverageAmount: policy.coverageAmount ? parseFloat(policy.coverageAmount) : 0,
        premium: policy.premium ? parseFloat(policy.premium) : 0,
        effectiveDate: policy.effectiveDate,
        expiryDate: policy.terminationDate,
        status: policy.status,
      }));
    },

    insuranceConnections: async () => {
      // Mock implementation - would fetch actual connection status in production
      const providers = ['SUN_LIFE', 'MANULIFE', 'GREEN_SHIELD_CANADA', 'CANADA_LIFE', 'INDUSTRIAL_ALLIANCE'];
      
      return providers.map(provider => ({
        provider,
        connected: ['SUN_LIFE', 'MANULIFE'].includes(provider),
        lastSyncAt: ['SUN_LIFE', 'MANULIFE'].includes(provider) ? new Date() : null,
        claimsCount: ['SUN_LIFE', 'MANULIFE'].includes(provider) ? 150 : 0,
        policiesCount: ['SUN_LIFE', 'MANULIFE'].includes(provider) ? 45 : 0,
      }));
    },

    // System Status
    systemStatus: async () => {
      return await getSystemStatus();
    },
  },

  Mutation: {
    // Claims
    createClaim: async (
      _parent: unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { input }: { input: Record<string, any> },
      _context: YogaInitialContext
    ) => {
      const result = await db.insert(claims).values({
        claimNumber: `CLM-${Date.now()}`,
        organizationId: input.organizationId,
        memberId: input.memberId,
        claimType: input.claimType || 'other',
        status: 'submitted',
        priority: input.priority || 'medium',
        incidentDate: input.incidentDate || new Date(),
        location: input.location || 'Not specified',
        description: input.description,
        desiredOutcome: input.desiredOutcome || 'Not specified',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return result[0];
    },

    updateClaim: async (
      _parent: unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id, input }: { id: string; input: Record<string, any> },
      _context: YogaInitialContext
    ) => {
      const result = await db
        .update(claims)
        .set({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(input as Record<string, any>),
          updatedAt: new Date(),
        })
        .where(eq(claims.claimId, id))
        .returning();

      return result[0];
    },

    deleteClaim: async (
      _parent: unknown,
      { id }: { id: string },
      _context: YogaInitialContext
    ) => {
      await db.delete(claims).where(eq(claims.claimId, id));
      return true;
    },

    // Voting
    castVote: async (
      _parent: unknown,
      { voteId: _voteId, optionId: _optionId }: { voteId: string; optionId: string },
      _context: YogaInitialContext
    ) => {
      // Implementation would record the vote
      return true;
    },

    // Pension Contributions
    calculatePensionContribution: async (
      _parent: unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { input }: { input: Record<string, any> }
    ) => {
      const factory = PensionProcessorFactory.getInstance();
      const processor = factory.getProcessor(input.planType as PensionPlanType);

      const member: PensionMember = {
        id: input.memberId,
        employeeNumber: input.memberId,
        firstName: 'Unknown',
        lastName: 'Unknown',
        dateOfBirth: new Date(input.dateOfBirth),
        hireDate: new Date(),
        employmentStatus: EmploymentStatus.FULL_TIME,
        province: input.province,
        annualSalary: input.yearToDateEarnings || 0,
      };

      const earnings = {
        grossEarnings: input.grossEarnings,
        pensionableEarnings: input.grossEarnings,
        periodStartDate: new Date(),
        periodEndDate: new Date(),
      };

      const contribution = await processor.calculateContribution(
        member,
        earnings
      );

      return {
        employeeContribution: contribution.employeeContribution.toNumber(),
        employerContribution: contribution.employerContribution.toNumber(),
        totalContribution: contribution.totalContribution.toNumber(),
        pensionableEarnings: contribution.pensionableEarnings.toNumber(),
        grossEarnings: contribution.grossEarnings.toNumber(),
        basicExemption: contribution.basicExemptAmount?.toNumber() || 0,
        planType: contribution.planType,
        contributionPeriod: contribution.contributionPeriod,
      };
    },

    createRemittance: async (
      _parent: unknown,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { input }: { input: Record<string, any> }
    ) => {
      const factory = PensionProcessorFactory.getInstance();
      const processor = factory.getProcessor(input.planType as PensionPlanType);

      // Mock contributions data
      const contributions = input.contributions.map((id: string) => ({
        memberId: id,
        planType: input.planType,
        contributionPeriod: 'MONTHLY' as ContributionPeriod,
        periodStartDate: new Date(input.periodStart),
        periodEndDate: new Date(input.periodEnd),
        grossEarnings: 100,
        pensionableEarnings: 100,
        employeeContribution: 100,
        employerContribution: 100,
        totalContribution: 200,
        employeeRate: 0.05,
        employerRate: 0.05,
        ytdPensionableEarnings: 1000,
        ytdEmployeeContribution: 50,
        ytdEmployerContribution: 50,
        calculatedAt: new Date(),
        taxYear: new Date().getFullYear(),
      }));

      const periodStart = new Date(input.periodStart);
      const remittance = await processor.createRemittance(
        contributions,
        periodStart.getMonth() + 1,
        periodStart.getFullYear()
      );

      return {
        id: remittance.id,
        planType: remittance.planType,
        periodStart: new Date(remittance.remittanceYear, remittance.remittanceMonth - 1, 1),
        periodEnd: new Date(remittance.remittanceYear, remittance.remittanceMonth, 0),
        totalEmployeeContributions: remittance.totalEmployeeContributions.toNumber(),
        totalEmployerContributions: remittance.totalEmployerContributions.toNumber(),
        totalContributions: remittance.totalContributions.toNumber(),
        employeeCount: remittance.numberOfMembers,
        status: 'PENDING',
        confirmationNumber: null,
        submittedAt: null,
        createdAt: new Date(),
      };
    },

    submitRemittance: async (
      _parent: unknown,
      { id }: { id: string }
    ) => {
      // Mock implementation - would fetch remittance and submit
      const factory = PensionProcessorFactory.getInstance();
      const processor = factory.getDefaultProcessor();

      const result = await processor.submitRemittance(id);

      return {
        id,
        planType: result.planType,
        periodStart: new Date(result.remittanceYear, result.remittanceMonth - 1, 1),
        periodEnd: new Date(result.remittanceYear, result.remittanceMonth, 0),
        totalEmployeeContributions: result.totalEmployeeContributions.toNumber(),
        totalEmployerContributions: result.totalEmployerContributions.toNumber(),
        totalContributions: result.totalContributions.toNumber(),
        employeeCount: result.numberOfMembers,
        status: 'SUBMITTED',
        confirmationNumber: result.confirmationNumber,
        submittedAt: result.remittanceDate,
        createdAt: new Date(),
      };
    },

    // Insurance Sync
    syncInsuranceProvider: async (
      _parent: unknown,
      { provider }: { provider: string }
    ) => {
      try {
        // Map GraphQL provider enum to integration provider
        const providerMap: Record<string, IntegrationProvider> = {
          'SUN_LIFE': IntegrationProvider.SUN_LIFE,
          'MANULIFE': IntegrationProvider.MANULIFE,
          'GREEN_SHIELD_CANADA': IntegrationProvider.GREEN_SHIELD_CANADA,
          'CANADA_LIFE': IntegrationProvider.CANADA_LIFE,
          'INDUSTRIAL_ALLIANCE': IntegrationProvider.INDUSTRIAL_ALLIANCE,
        };

        const integrationProvider = providerMap[provider];
        if (!integrationProvider) {
          throw new Error(`Unknown insurance provider: ${provider}`);
        }

        const factory = IntegrationFactory.getInstance();
        const adapter = await factory.getIntegration('org_123', integrationProvider);

        // Perform sync
        const syncResult = await adapter.sync({
          type: SyncType.FULL,
          entities: ['claims', 'policies'],
        });

        return {
          provider,
          connected: true,
          lastSyncAt: new Date(),
          claimsCount: syncResult.recordsCreated + syncResult.recordsUpdated,
          policiesCount: syncResult.recordsCreated + syncResult.recordsUpdated,
        };
      } catch (_error) {
        return {
          provider,
          connected: false,
          lastSyncAt: null,
          claimsCount: 0,
          policiesCount: 0,
        };
      }
    },
  },

  // Field Resolvers
  Claim: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    claimant: async (parent: Record<string, any>, _args: unknown, _context: YogaInitialContext) => {
      if (!parent.memberId) return null;
      const result = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, parent.memberId))
        .limit(1);
      return result[0] || null;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignee: async (parent: Record<string, any>, _args: unknown, _context: YogaInitialContext) => {
      if (!parent.assignedTo) return null;
      const result = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, parent.assignedTo))
        .limit(1);
      return result[0] || null;
    },
  },

  Member: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    claims: async (parent: Record<string, any>, _args: unknown, _context: YogaInitialContext) => {
      const results = await db
        .select()
        .from(claims)
        .where(eq(claims.memberId, parent.userId));
      return results;
    },
  },
};

