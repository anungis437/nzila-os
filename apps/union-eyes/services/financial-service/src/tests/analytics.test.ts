/**
 * Analytics Endpoints Test Suite
 * 
 * Tests all analytics endpoints:
 * - Fund health metrics
 * - Burn rate predictions
 * - Top donors
 * - Fund activity
 * - Automated alerts
 * - Weekly forecasts
 * - Fund performance
 * - Trend analysis
 * - Summary statistics
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../index';
import { db } from '../db';
import { 
  strikeFunds, 
  donations,
  stipendDisbursements,
  members
} from '../db/schema';
import { eq } from 'drizzle-orm';

// Generate valid UUIDs for test identifiers
const TEST_TENANT_ID = randomUUID();
const TEST_USER_ID = randomUUID();

let testFundId1: string;
let _testFundId2: string;
let testMemberId: string;

describe('Analytics Endpoints - Comprehensive Tests', () => {
  
  beforeAll(async () => {
// Create test member
    const memberResult = await db.insert(members).values({
      organizationId: TEST_TENANT_ID,
      userId: TEST_USER_ID,
      firstName: 'Test',
      lastName: 'Donor',
      email: 'donor@test.com',
      status: 'active',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).returning();
    testMemberId = memberResult[0].id;
    
    // Create test strike funds
    testFundId1 = `fund_analytics_1_${Date.now()}`;
    testFundId2 = `fund_analytics_2_${Date.now()}`;
    
    const funds = await db.insert(strikeFunds).values([
      {
        tenantId: TEST_TENANT_ID,
        fundName: 'Test Strike Fund 1',
        fundCode: 'TEST_FUND_1',
        fundType: 'strike',
        targetAmount: '100000.00',
        isActive: true,
        createdBy: TEST_USER_ID,
      },
      {
        tenantId: TEST_TENANT_ID,
        fundName: 'Test Strike Fund 2',
        fundCode: 'TEST_FUND_2',
        fundType: 'strike',
        targetAmount: '50000.00',
        isActive: true,
        createdBy: TEST_USER_ID,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any).returning();
    testFundId1 = funds[0].id;
    testFundId2 = funds[1].id;
    
    // Create test donations
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const donationData = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i * 3);
      
      donationData.push({
        id: `donation_${Date.now()}_${i}`,
        tenantId: TEST_TENANT_ID,
        strikeFundId: testFundId1,
        donorName: `Donor ${i}`,
        amount: (100 + i * 50).toString(),
        donationDate: date,
        donationType: 'one_time' as const,
        status: 'completed' as const,
      });
    }
    
    await db.insert(donations).values(donationData);
    
    // Create test expenses - SKIPPED: strikeExpenses table not yet in schema
    
    // Create test stipends
    const stipendData = [];
    for (let i = 0; i < 3; i++) {
      const weekStart = new Date(thirtyDaysAgo);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      stipendData.push({
        id: `stipend_${Date.now()}_${i}`,
        tenantId: TEST_TENANT_ID,
        memberId: testMemberId,
        fundId: testFundId1,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        daysWorked: 5,
        hoursWorked: '40.0',
        dailyRate: '100.00',
        calculatedAmount: '500.00',
        approvedAmount: '500.00',
        status: 'disbursed' as const,
        disbursedAt: new Date(weekEnd.getTime() + 2 * 24 * 60 * 60 * 1000),
      });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(stipendDisbursements).values(stipendData as any);
});
  
  afterAll(async () => {
await db.delete(stipendDisbursements).where(eq(stipendDisbursements.tenantId, TEST_TENANT_ID));
    await db.delete(donations).where(eq(donations.tenantId, TEST_TENANT_ID));
    await db.delete(strikeFunds).where(eq(strikeFunds.tenantId, TEST_TENANT_ID));
    await db.delete(members).where(eq(members.organizationId, TEST_TENANT_ID));
});
  
  describe('GET /api/analytics/summary', () => {
    it('should return summary statistics for tenant', async () => {
      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ tenantId: TEST_TENANT_ID });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalFunds');
      expect(response.body).toHaveProperty('activeFunds');
      expect(response.body).toHaveProperty('totalBalance');
      expect(response.body).toHaveProperty('totalDonations');
      expect(response.body).toHaveProperty('totalExpenses');
      expect(response.body.activeFunds).toBeGreaterThanOrEqual(2);
    });
    
    it('should require tenantId parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/summary');
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('GET /api/analytics/fund-health/:fundId', () => {
    it('should return health metrics for specific fund', async () => {
      const response = await request(app)
        .get(`/api/analytics/fund-health/${testFundId1}`)
        .query({ tenantId: TEST_TENANT_ID });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fundId', testFundId1);
      expect(response.body).toHaveProperty('currentBalance');
      expect(response.body).toHaveProperty('targetBalance');
      expect(response.body).toHaveProperty('percentOfTarget');
      expect(response.body).toHaveProperty('healthStatus');
      expect(response.body).toHaveProperty('daysOfRunway');
    });
    
    it('should return 404 for non-existent fund', async () => {
      const response = await request(app)
        .get('/api/analytics/fund-health/nonexistent-fund')
        .query({ tenantId: TEST_TENANT_ID });
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('GET /api/analytics/burn-rate/:fundId', () => {
    it('should calculate burn rate predictions', async () => {
      const response = await request(app)
        .get(`/api/analytics/burn-rate/${testFundId1}`)
        .query({ tenantId: TEST_TENANT_ID });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fundId', testFundId1);
      expect(response.body).toHaveProperty('currentBurnRate');
      expect(response.body).toHaveProperty('predictedBurnRate');
      expect(response.body).toHaveProperty('daysUntilDepletion');
      expect(response.body).toHaveProperty('severity');
      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });
    
    it('should accept optional daysToAnalyze parameter', async () => {
      const response = await request(app)
        .get(`/api/analytics/burn-rate/${testFundId1}`)
        .query({ 
          tenantId: TEST_TENANT_ID,
          daysToAnalyze: 60 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('analysisWindow');
    });
  });
  
  describe('GET /api/analytics/top-donors', () => {
    it('should return list of top donors with amounts', async () => {
      const response = await request(app)
        .get('/api/analytics/top-donors')
        .query({ 
          tenantId: TEST_TENANT_ID,
          limit: 5 
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('donorName');
      expect(response.body[0]).toHaveProperty('totalAmount');
      expect(response.body[0]).toHaveProperty('donationCount');
    });
    
    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/top-donors')
        .query({ 
          tenantId: TEST_TENANT_ID,
          limit: 3 
        });
      
      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(3);
    });
    
    it('should filter by fundId if provided', async () => {
      const response = await request(app)
        .get('/api/analytics/top-donors')
        .query({ 
          tenantId: TEST_TENANT_ID,
          fundId: testFundId1,
          limit: 10 
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
  
  describe('GET /api/analytics/fund-activity/:fundId', () => {
    it('should return activity timeline for fund', async () => {
      const response = await request(app)
        .get(`/api/analytics/fund-activity/${testFundId1}`)
        .query({ 
          tenantId: TEST_TENANT_ID,
          days: 30 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fundId', testFundId1);
      expect(response.body).toHaveProperty('activities');
      expect(Array.isArray(response.body.activities)).toBe(true);
      
      if (response.body.activities.length > 0) {
        expect(response.body.activities[0]).toHaveProperty('date');
        expect(response.body.activities[0]).toHaveProperty('type');
        expect(response.body.activities[0]).toHaveProperty('amount');
      }
    });
    
    it('should accept days parameter', async () => {
      const response = await request(app)
        .get(`/api/analytics/fund-activity/${testFundId1}`)
        .query({ 
          tenantId: TEST_TENANT_ID,
          days: 7 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('periodDays', 7);
    });
  });
  
  describe('GET /api/analytics/automated-alerts', () => {
    it('should return list of active alerts', async () => {
      const response = await request(app)
        .get('/api/analytics/automated-alerts')
        .query({ tenantId: TEST_TENANT_ID });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Each alert should have required fields
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('fundId');
        expect(response.body[0]).toHaveProperty('severity');
        expect(response.body[0]).toHaveProperty('message');
        expect(['critical', 'warning', 'info']).toContain(response.body[0].severity);
      }
    });
    
    it('should filter by severity if provided', async () => {
      const response = await request(app)
        .get('/api/analytics/automated-alerts')
        .query({ 
          tenantId: TEST_TENANT_ID,
          severity: 'critical' 
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // All returned alerts should be critical
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.body.forEach((alert: any) => {
        expect(alert.severity).toBe('critical');
      });
    });
  });
  
  describe('GET /api/analytics/weekly-forecast', () => {
    it('should return forecast for all funds', async () => {
      const response = await request(app)
        .get('/api/analytics/weekly-forecast')
        .query({ tenantId: TEST_TENANT_ID });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('funds');
      expect(Array.isArray(response.body.funds)).toBe(true);
      expect(response.body.funds.length).toBeGreaterThan(0);
      
      const fund = response.body.funds[0];
      expect(fund).toHaveProperty('fundId');
      expect(fund).toHaveProperty('fundName');
      expect(fund).toHaveProperty('currentBalance');
      expect(fund).toHaveProperty('predictedBalance');
      expect(fund).toHaveProperty('trend');
    });
    
    it('should filter by fundId if provided', async () => {
      const response = await request(app)
        .get('/api/analytics/weekly-forecast')
        .query({ 
          tenantId: TEST_TENANT_ID,
          fundId: testFundId1 
        });
      
      expect(response.status).toBe(200);
      expect(response.body.funds).toHaveLength(1);
      expect(response.body.funds[0].fundId).toBe(testFundId1);
    });
  });
  
  describe('GET /api/analytics/fund-performance/:fundId', () => {
    it('should return performance metrics', async () => {
      const response = await request(app)
        .get(`/api/analytics/fund-performance/${testFundId1}`)
        .query({ 
          tenantId: TEST_TENANT_ID,
          period: '30d' 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fundId', testFundId1);
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('totalInflow');
      expect(response.body).toHaveProperty('totalOutflow');
      expect(response.body).toHaveProperty('netChange');
      expect(response.body).toHaveProperty('averageDailyBurn');
    });
    
    it('should accept different period values', async () => {
      const periods = ['7d', '30d', '90d'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/analytics/fund-performance/${testFundId1}`)
          .query({ 
            tenantId: TEST_TENANT_ID,
            period 
          });
        
        expect(response.status).toBe(200);
        expect(response.body.period).toBe(period);
      }
    });
  });
  
  describe('GET /api/analytics/trend-analysis/:fundId', () => {
    it('should return trend data points', async () => {
      const response = await request(app)
        .get(`/api/analytics/trend-analysis/${testFundId1}`)
        .query({ 
          tenantId: TEST_TENANT_ID,
          days: 30 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fundId', testFundId1);
      expect(response.body).toHaveProperty('dataPoints');
      expect(Array.isArray(response.body.dataPoints)).toBe(true);
      
      if (response.body.dataPoints.length > 0) {
        const point = response.body.dataPoints[0];
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('balance');
        expect(point).toHaveProperty('inflow');
        expect(point).toHaveProperty('outflow');
      }
    });
    
    it('should support different granularity levels', async () => {
      const response = await request(app)
        .get(`/api/analytics/trend-analysis/${testFundId1}`)
        .query({ 
          tenantId: TEST_TENANT_ID,
          days: 90,
          granularity: 'weekly' 
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('granularity', 'weekly');
    });
  });
  
  describe('Error Handling', () => {
    it('should return 400 for missing tenantId', async () => {
      const endpoints = [
        '/api/analytics/summary',
        '/api/analytics/top-donors',
        '/api/analytics/automated-alerts',
        '/api/analytics/weekly-forecast',
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });
    
    it('should return 404 for non-existent fundId', async () => {
      const endpoints = [
        '/api/analytics/fund-health/fake-fund',
        '/api/analytics/burn-rate/fake-fund',
        '/api/analytics/fund-activity/fake-fund',
        '/api/analytics/fund-performance/fake-fund',
        '/api/analytics/trend-analysis/fake-fund',
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .query({ tenantId: TEST_TENANT_ID });
        
        expect(response.status).toBe(404);
      }
    });
    
    it('should handle invalid parameter types gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/top-donors')
        .query({ 
          tenantId: TEST_TENANT_ID,
          limit: 'not-a-number' 
        });
      
      // Should either return 400 or use default limit
      expect([200, 400]).toContain(response.status);
    });
  });
  
  describe('Performance Tests', () => {
    it('should respond within acceptable time for summary endpoint', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/analytics/summary')
        .query({ tenantId: TEST_TENANT_ID });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
    
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .get('/api/analytics/summary')
          .query({ tenantId: TEST_TENANT_ID })
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(totalTime).toBeLessThan(5000); // All 5 requests within 5 seconds
    });
  });
});
