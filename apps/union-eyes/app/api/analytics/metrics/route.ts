/**
 * Metrics API
 * Q1 2025 - Advanced Analytics
 * 
 * Endpoint for calculating and retrieving analytics metrics
 */

import { NextResponse } from 'next/server';
import { calculateMetrics, getAnalyticsMetrics } from '@/actions/analytics-actions';
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const analyticsMetricsSchema = z.object({
  metricType: z.string().optional(),
  metricName: z.string().min(1, 'metricName is required'),
  periodType: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export const POST = withRoleAuth('steward', async (request, _context) => {
    try {
      const body = await request.json();
    // Validate request body
    const validation = analyticsMetricsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { metricType, metricName, periodType, periodStart, periodEnd } = validation.data;
      
      // Validate input
      if (!metricType || !metricName || !periodType || !periodStart || !periodEnd) {
        return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields: metricType, metricName, periodType, periodStart, periodEnd'
    );
      }
      
      if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(periodType)) {
        return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid periodType. Must be one of: daily, weekly, monthly, quarterly, yearly'
    );
      }
      
      // Calculate and store metric
      const result = await calculateMetrics({
        metricType,
        metricName,
        periodType: periodType as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd)
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        metric: result.metric
      });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

export const GET = withRoleAuth('member', async (request, _context) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const metricType = searchParams.get('metricType');
      const periodType = searchParams.get('periodType');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const limit = parseInt(searchParams.get('limit') || '50');
      
      // Get metrics
      const result = await getAnalyticsMetrics({
        metricType: metricType || undefined,
        periodType: periodType || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit
      });
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        metrics: result.metrics
      });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

