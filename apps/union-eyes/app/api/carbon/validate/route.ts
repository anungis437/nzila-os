import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import type { CarbonValidationResponse } from '@/lib/types/compliance-api-types';
import { withApiAuth } from '@/lib/api-auth-guard';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

/**
 * Carbon Neutral Validation API
 * Verify claims of carbon neutrality, renewable power, or net-zero operations
 */

/**
 * POST /api/carbon/validate
 * Validate carbon neutrality or sustainability claims
 */

const carbonDataPointSchema = z.object({
  metric: z.string().optional(),
  value: z.number(),
  unit: z.string().optional(),
});

const carbonValidateSchema = z.object({
  claimType: z.string().optional(),
  dataPoints: z.array(carbonDataPointSchema).optional(),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    // Validate request body
    const validation = carbonValidateSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { claimType, dataPoints } = validation.data;

    // Validate required fields
    if (!claimType || !dataPoints || dataPoints.length === 0) {
      return NextResponse.json(
        {
          valid: false,
          claimType: claimType || 'unknown',
          validationScore: 0,
          issues: ['Missing dataPoints for validation'],
          certificationEligible: false,
        } as CarbonValidationResponse,
        { status: 400 }
      );
    }

    // Validate data points
    const issues: string[] = [];
    let validationScore = 100;

    dataPoints.forEach(dp => {
      if (!dp.metric || dp.value === undefined || !dp.unit) {
        issues.push(`Invalid data point: ${dp.metric}`);
        validationScore -= 20;
      }
      if (dp.value < 0) {
        issues.push(`Negative value for ${dp.metric}: ${dp.value}`);
        validationScore -= 15;
      }
    });

    // Assess claim eligibility
    const carbonEmissions = dataPoints.find(dp => dp.metric === 'total_emissions')?.value || 0;
    const offsetsOrRenewable = dataPoints.find(dp => 
      dp.metric === 'carbon_offsets' || dp.metric === 'renewable_percentage'
    )?.value || 0;

    let certificationEligible = false;
    const recommendations: string[] = [];

    switch (claimType) {
      case 'carbon_neutral':
        // Emissions should be offset or at zero
        if (carbonEmissions <= 0 || offsetsOrRenewable >= 100) {
          certificationEligible = true;
        } else {
          issues.push(`Carbon neutral claim requires 100% offset. Current: ${offsetsOrRenewable}%`);
          validationScore -= 25;
        }
        recommendations.push('Obtain third-party carbon audit');
        recommendations.push('Register with verified carbon offset registry');
        break;

      case 'renewable_powered':
        // Should have renewable energy percentage >= 80%
        if (offsetsOrRenewable >= 80) {
          certificationEligible = true;
        } else {
          issues.push(`Renewable claim requires >= 80% renewable. Current: ${offsetsOrRenewable}%`);
          validationScore -= 25;
          recommendations.push('Increase renewable energy contracts to 80%');
        }
        break;

      case 'net_zero':
        // Most stringent - requires both low emissions AND offsets
        if (carbonEmissions < 100 && offsetsOrRenewable >= 100) {
          certificationEligible = true;
        } else {
          issues.push('Net-zero requires minimal emissions and full offsets');
          validationScore -= 30;
          recommendations.push('Implement aggressive energy efficiency');
          recommendations.push('Increase renewable energy to 100%');
        }
        break;
    }

    return NextResponse.json({
      valid: validationScore >= 70,
      claimType,
      validationScore: Math.max(0, validationScore),
      issues: issues.length > 0 ? issues : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      certificationEligible,
      message: `Carbon validation for ${claimType}: ${certificationEligible ? 'Eligible for certification' : 'Requires improvements'}`,
    } as CarbonValidationResponse);
  } catch (error) {
return NextResponse.json(
      {
        valid: false,
        claimType: 'unknown',
        validationScore: 0,
        issues: [`Validation failed: ${error}`],
        certificationEligible: false,
        error: `Failed to validate carbon claim: ${error}`,
      } as CarbonValidationResponse,
      { status: 500 }
    );
  }
});

/**
 * GET /api/carbon/validate
 * Get carbon validation requirements and standards
 */
export const GET = withApiAuth(async () => {
  try {
    return NextResponse.json({
      valid: true,
      claimType: 'informational',
      validationScore: 100,
      certificationEligible: false,
      message: 'Carbon validation standards',
      standards: {
        carbon_neutral: {
          definition: 'Net emissions of zero CO2e after offsets',
          requirements: [
            'Measure all Scope 1, 2, and 3 emissions',
            'Offset 100% of net emissions',
            'Use verified carbon credits',
            'Annual third-party audit',
          ],
          certifications: ['ISO 14064-2', 'Gold Standard', 'VCS'],
        },
        renewable_powered: {
          definition: 'Operations powered by >= 80% renewable energy',
          requirements: [
            'Renewable energy contracts for 80%+ of electricity',
            'Verify energy sources quarterly',
            'Document all power consumption',
            'Annual renewable energy report',
          ],
          certifications: ['RE100', 'Green Power Partnership', 'ISO 50001'],
        },
        net_zero: {
          definition: 'Minimal emissions + 100% offsets + renewable energy',
          requirements: [
            'Emissions < 100 tCO2e annually',
            'Renewable energy >= 100%',
            'Carbon offsets for all residual emissions',
            'Science-based emissions reduction targets',
          ],
          certifications: ['SBTi Net-Zero', 'Carbon Trust Standard', 'ISO 14064'],
        },
      },
    });
  } catch (error) {
return NextResponse.json(
      {
        valid: false,
        claimType: 'informational',
        validationScore: 0,
        error: `Failed to get carbon standards: ${error}`,
      } as CarbonValidationResponse,
      { status: 500 }
    );
  }
});

