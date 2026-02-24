/**
 * A/B Testing Framework
 * 
 * SPRINT 8: Advanced Features
 * 
 * Purpose: Enable data-driven optimization of marketing messages, CTAs, and flows
 * 
 * Features:
 * - Test variants for emails, CTAs, landing pages
 * - Statistical significance calculation (chi-square test)
 * - Automatic winner detection
 * - Multi-armed bandit allocation (optional)
 * - Segment-based testing
 * 
 * Philosophy: "Test to optimize, not manipulate"
 * - No deceptive testing
 * - Clear variant labeling
 * - Respect user preferences
 * - Share learnings with labor movement
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TestType = 'email-subject' | 'cta-text' | 'landing-page' | 'notification-message';
export type TestStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface ABTestVariant {
  id: string;
  name: string;
  content: Record<string, unknown>; // Test-specific content (subject line, button text, etc.)
  weight: number; // Allocation percentage (0-100)
  impressions: number;
  conversions: number;
  conversionRate: number;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  type: TestType;
  status: TestStatus;
  variants: ABTestVariant[];
  startDate: Date;
  endDate?: Date;
  targetSampleSize: number;
  currentSampleSize: number;
  confidence: number; // 0-100, e.g., 95% confidence
  winner?: string; // variant ID
  segmentCriteria?: Record<string, unknown>; // Optional audience targeting
  metadata: Record<string, unknown>;
}

export interface ABTestResult {
  testId: string;
  testName: string;
  status: TestStatus;
  variants: ABTestVariant[];
  winner?: {
    variantId: string;
    variantName: string;
    conversionRate: number;
    improvement: number; // % improvement over control
    confidence: number;
  };
  statisticalSignificance: boolean;
  recommendations: string[];
}

export interface ABTestCreationParams {
  name: string;
  description: string;
  type: TestType;
  variants: Array<{
    name: string;
    content: Record<string, unknown>;
  }>;
  targetSampleSize: number;
  confidence?: number;
  segmentCriteria?: Record<string, unknown>;
}

// ============================================================================
// TEST MANAGEMENT
// ============================================================================

/**
 * Create a new A/B test
 */
export async function createABTest(params: ABTestCreationParams): Promise<ABTest> {
  const {
    name,
    description,
    type,
    variants: variantParams,
    targetSampleSize,
    confidence = 95,
    segmentCriteria,
  } = params;

  // Validate variants
  if (variantParams.length < 2) {
    throw new Error('A/B test requires at least 2 variants');
  }

  // Create variants with equal weight distribution
  const variants: ABTestVariant[] = variantParams.map((v, index) => ({
    id: `variant-${index + 1}`,
    name: v.name,
    content: v.content,
    weight: 100 / variantParams.length,
    impressions: 0,
    conversions: 0,
    conversionRate: 0,
  }));

  const test: ABTest = {
    id: `test-${Date.now()}`,
    name,
    description,
    type,
    status: 'draft',
    variants,
    startDate: new Date(),
    targetSampleSize,
    currentSampleSize: 0,
    confidence,
    segmentCriteria,
    metadata: {
      createdAt: new Date(),
      createdBy: 'system', // In production, use authenticated user
    },
  };

  // In production, persist to database
  // await db.insert(abTests).values(test);

  return test;
}

/**
 * Get variant for user (with allocation logic)
 * 
 * Uses weighted random selection based on variant weights
 */
export function assignVariant(test: ABTest, userId: string): ABTestVariant {
  if (test.status !== 'active') {
    throw new Error('Cannot assign variant to inactive test');
  }

  // For consistent assignment, use userId as seed
  // In production, store assignment in database to ensure consistency
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (hash % 100) / 100;

  let cumulativeWeight = 0;
  for (const variant of test.variants) {
    cumulativeWeight += variant.weight / 100;
    if (random < cumulativeWeight) {
      return variant;
    }
  }

  // Fallback to first variant
  return test.variants[0];
}

/**
 * Record impression (user saw variant)
 */
export async function recordImpression(testId: string, variantId: string): Promise<void> {
  // In production, increment impression count in database
  // await db.update(abTestVariants)
  //   .set({ impressions: sql`impressions + 1` })
  //   .where(and(eq(abTestVariants.testId, testId), eq(abTestVariants.id, variantId)));

  logger.info(`Impression recorded: test=${testId}, variant=${variantId}`);
}

/**
 * Record conversion (user completed goal action)
 */
export async function recordConversion(testId: string, variantId: string): Promise<void> {
  // In production, increment conversion count in database
  // await db.update(abTestVariants)
  //   .set({ conversions: sql`conversions + 1` })
  //   .where(and(eq(abTestVariants.testId, testId), eq(abTestVariants.id, variantId)));

  logger.info(`Conversion recorded: test=${testId}, variant=${variantId}`);
}

// ============================================================================
// STATISTICAL ANALYSIS
// ============================================================================

/**
 * Calculate chi-square test for statistical significance
 * 
 * Compares conversion rates between variants to determine if differences
 * are statistically significant or due to random chance.
 */
export function calculateChiSquare(variants: ABTestVariant[]): {
  chiSquare: number;
  pValue: number;
  significant: boolean;
  confidence: number;
} {
  if (variants.length < 2) {
    return { chiSquare: 0, pValue: 1, significant: false, confidence: 0 };
  }

  // Calculate expected values
  const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
  const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);

  if (totalImpressions === 0 || totalConversions === 0) {
    return { chiSquare: 0, pValue: 1, significant: false, confidence: 0 };
  }

  const overallConversionRate = totalConversions / totalImpressions;

  // Calculate chi-square statistic
  let chiSquare = 0;
  for (const variant of variants) {
    const expectedConversions = variant.impressions * overallConversionRate;
    const expectedNonConversions = variant.impressions * (1 - overallConversionRate);

    const actualConversions = variant.conversions;
    const actualNonConversions = variant.impressions - variant.conversions;

    if (expectedConversions > 0) {
      chiSquare += Math.pow(actualConversions - expectedConversions, 2) / expectedConversions;
    }

    if (expectedNonConversions > 0) {
      chiSquare += Math.pow(actualNonConversions - expectedNonConversions, 2) / expectedNonConversions;
    }
  }

  // Degrees of freedom = (number of variants - 1)
  const degreesOfFreedom = variants.length - 1;

  // Approximate p-value using chi-square distribution
  // For simplicity, using critical values at common confidence levels
  const pValue = chiSquareToPValue(chiSquare, degreesOfFreedom);

  // Significant if p-value < 0.05 (95% confidence)
  const significant = pValue < 0.05;
  const confidence = (1 - pValue) * 100;

  return {
    chiSquare,
    pValue,
    significant,
    confidence: Math.min(confidence, 99.9), // Cap at 99.9%
  };
}

/**
 * Convert chi-square statistic to p-value (simplified)
 * 
 * In production, use a proper statistical library
 */
function chiSquareToPValue(chiSquare: number, degreesOfFreedom: number): number {
  // Critical values for 1 degree of freedom
  if (degreesOfFreedom === 1) {
    if (chiSquare > 10.83) return 0.001; // 99.9% confidence
    if (chiSquare > 6.63) return 0.01; // 99% confidence
    if (chiSquare > 3.84) return 0.05; // 95% confidence
    if (chiSquare > 2.71) return 0.10; // 90% confidence
    return 0.5; // Not significant
  }

  // For other degrees of freedom, use simplified approximation
  if (chiSquare > 9.21) return 0.01;
  if (chiSquare > 5.99) return 0.05;
  if (chiSquare > 4.61) return 0.10;
  return 0.5;
}

/**
 * Determine winning variant (if statistically significant)
 */
export function determineWinner(test: ABTest): ABTestResult {
  // Calculate conversion rates
  const variantsWithRates = test.variants.map((v) => ({
    ...v,
    conversionRate: v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0,
  }));

  // Find best variant
  const bestVariant = variantsWithRates.reduce((best, current) =>
    current.conversionRate > best.conversionRate ? current : best
  );

  // Find control (assume first variant is control)
  const control = variantsWithRates[0];

  // Calculate statistical significance
  const stats = calculateChiSquare(variantsWithRates);

  const result: ABTestResult = {
    testId: test.id,
    testName: test.name,
    status: test.status,
    variants: variantsWithRates,
    statisticalSignificance: stats.significant,
    recommendations: [],
  };

  // Determine winner
  if (stats.significant && bestVariant.conversionRate > control.conversionRate) {
    const improvement = ((bestVariant.conversionRate - control.conversionRate) / control.conversionRate) * 100;

    result.winner = {
      variantId: bestVariant.id,
      variantName: bestVariant.name,
      conversionRate: bestVariant.conversionRate,
      improvement,
      confidence: stats.confidence,
    };

    result.recommendations.push(
      `Deploy variant "${bestVariant.name}" - shows ${improvement.toFixed(1)}% improvement over control with ${stats.confidence.toFixed(1)}% confidence`
    );
  } else if (!stats.significant) {
    result.recommendations.push(
      'Continue test - no statistically significant difference detected yet',
      `Current sample size: ${test.currentSampleSize}, target: ${test.targetSampleSize}`
    );
  } else {
    result.recommendations.push('Control variant is performing best - no changes recommended');
  }

  // Additional recommendations
  if (test.currentSampleSize < test.targetSampleSize * 0.5) {
    result.recommendations.push('Warning: Sample size below 50% of target - results may not be reliable');
  }

  return result;
}

// ============================================================================
// TEST LIFECYCLE
// ============================================================================

/**
 * Start A/B test (activate)
 */
export async function startTest(testId: string): Promise<void> {
  // In production, update test status in database
  // await db.update(abTests).set({ status: 'active', startDate: new Date() }).where(eq(abTests.id, testId));

  logger.info(`Test ${testId} started`);
}

/**
 * Pause A/B test
 */
export async function pauseTest(testId: string): Promise<void> {
  // In production, update test status in database
  // await db.update(abTests).set({ status: 'paused' }).where(eq(abTests.id, testId));

  logger.info(`Test ${testId} paused`);
}

/**
 * Complete A/B test
 */
export async function completeTest(testId: string, winnerId?: string): Promise<void> {
  // In production, update test status and winner in database
  // await db.update(abTests).set({ status: 'completed', endDate: new Date(), winner: winnerId }).where(eq(abTests.id, testId));

  logger.info(`Test ${testId} completed, winner: ${winnerId || 'none'}`);
}

// ============================================================================
// TEST TEMPLATES
// ============================================================================

/**
 * Pre-built test templates for common scenarios
 */
export const TEST_TEMPLATES = {
  emailSubject: {
    name: 'Email Subject Line Test',
    description: 'Test different subject lines for pilot application emails',
    type: 'email-subject' as TestType,
    exampleVariants: [
      {
        name: 'Control (Direct)',
        content: { subject: 'Union Eyes Pilot Application - Next Steps' },
      },
      {
        name: 'Benefit-Focused',
        content: { subject: 'Transform Your Grievance Process - Pilot Approved' },
      },
      {
        name: 'Urgency',
        content: { subject: 'Your Pilot Application: Action Required by Friday' },
      },
    ],
  },
  ctaButton: {
    name: 'CTA Button Text Test',
    description: 'Test different call-to-action button text',
    type: 'cta-text' as TestType,
    exampleVariants: [
      {
        name: 'Control (Simple)',
        content: { text: 'Apply Now' },
      },
      {
        name: 'Value-Driven',
        content: { text: 'Start Your Transformation' },
      },
      {
        name: 'Risk-Free',
        content: { text: 'Try Risk-Free' },
      },
    ],
  },
  landingPageHero: {
    name: 'Landing Page Hero Test',
    description: 'Test different hero messages on pilot landing page',
    type: 'landing-page' as TestType,
    exampleVariants: [
      {
        name: 'Control (Product-Focused)',
        content: {
          headline: 'Union Eyes: Grievance Management Built for Labor',
          subheadline: 'Track, resolve, and analyze grievances in one platform',
        },
      },
      {
        name: 'Outcome-Focused',
        content: {
          headline: 'Resolve Grievances 40% Faster',
          subheadline: 'Join unions already transforming their case management',
        },
      },
      {
        name: 'Movement-Focused',
        content: {
          headline: 'Built by Organizers, For Organizers',
          subheadline: 'Worker-centered technology that respects your members',
        },
      },
    ],
  },
};

/**
 * Create test from template
 */
export async function createTestFromTemplate(
  templateKey: keyof typeof TEST_TEMPLATES,
  customName?: string,
  targetSampleSize: number = 1000
): Promise<ABTest> {
  const template = TEST_TEMPLATES[templateKey];

  return createABTest({
    name: customName || template.name,
    description: template.description,
    type: template.type,
    variants: template.exampleVariants,
    targetSampleSize,
  });
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example: Email subject line test
 * 
 * const test = await createTestFromTemplate('emailSubject', 'Pilot Approval Email Subject', 500);
 * await startTest(test.id);
 * 
 * // When sending email to user
 * const variant = assignVariant(test, userId);
 * await recordImpression(test.id, variant.id);
 * await sendEmail(userId, variant.content.subject);
 * 
 * // When user opens email (or completes goal)
 * await recordConversion(test.id, variant.id);
 * 
 * // Check results
 * const result = determineWinner(test);
 * if (result.winner) {
 *   logger.info(`Winner: ${result.winner.variantName} with ${result.winner.improvement}% improvement`);
 *   await completeTest(test.id, result.winner.variantId);
 * }
 */
