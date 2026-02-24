/**
 * Policy Engine Service
 * 
 * Evaluates policy rules and enforces organizational policies
 */

import { db } from '@/db';
import {
  policyRules,
  policyEvaluations,
  retentionPolicies,
  legalHolds,
  policyExceptions,
} from '@/db/schema/policy-engine-schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

interface EvaluationContext {
  subjectType: 'member' | 'user' | 'organization' | 'action';
  subjectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: Record<string, any>;
}

interface EvaluationResult {
  passed: boolean;
  failureReason?: string;
  actionTaken: 'allowed' | 'denied' | 'warning' | 'escalated';
  applicableRules: string[];
}

export class PolicyEngine {
  /**
   * Evaluate a subject against applicable policy rules
   */
  async evaluate(
    ruleType: string,
    category: string,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    try {
      // Get active rules for this type and category
      const rules = await db
        .select()
        .from(policyRules)
        .where(
          and(
            eq(policyRules.ruleType, ruleType),
            eq(policyRules.category, category),
            eq(policyRules.status, 'active'),
            eq(policyRules.enforced, true)
          )
        );
      
      if (rules.length === 0) {
        // No rules to evaluate - allow by default
        return {
          passed: true,
          actionTaken: 'allowed',
          applicableRules: [],
        };
      }
      
      // Check for exceptions first
      const hasException = await this.checkException(
        rules.map(r => r.id),
        context.subjectType,
        context.subjectId
      );
      
      if (hasException) {
        return {
          passed: true,
          actionTaken: 'allowed',
          applicableRules: [],
        };
      }
      
      // Evaluate each rule
      const results = await Promise.all(
        rules.map(rule => this.evaluateRule(rule, context))
      );
      
      // All rules must pass
      const allPassed = results.every(r => r.passed);
      const failedRule = results.find(r => !r.passed);
      
      const result: EvaluationResult = {
        passed: allPassed,
        failureReason: failedRule?.failureReason,
        actionTaken: allPassed ? 'allowed' : 'denied',
        applicableRules: rules.map(r => r.id),
      };
      
      // Log evaluation for each rule
      await Promise.all(
        rules.map((rule, index) =>
          db.insert(policyEvaluations).values({
            ruleId: rule.id,
            subjectType: context.subjectType,
            subjectId: context.subjectId,
            inputData: context.inputData,
            passed: results[index].passed,
            failureReason: results[index].failureReason,
            actionTaken: result.actionTaken,
            context: context.context || {},
          })
        )
      );
      
      return result;
    } catch (error) {
      logger.error('Error evaluating policy:', error);
      throw error;
    }
  }
  
  /**
   * Evaluate a single rule against context
   */
  private async evaluateRule(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rule: any,
    context: EvaluationContext
  ): Promise<{ passed: boolean; failureReason?: string }> {
    try {
      const conditions = rule.conditions;
      
      // Simple condition evaluation (can be extended for complex logic)
      if (Array.isArray(conditions)) {
        // Multiple conditions (AND logic)
        for (const condition of conditions) {
          const result = this.evaluateCondition(condition, context.inputData);
          if (!result) {
            return {
              passed: false,
              failureReason: `Failed condition: ${condition.field} ${condition.operator} ${condition.value}`,
            };
          }
        }
        return { passed: true };
      } else {
        // Single condition
        const result = this.evaluateCondition(conditions, context.inputData);
        return {
          passed: result,
          failureReason: result ? undefined : `Failed condition: ${conditions.field} ${conditions.operator} ${conditions.value}`,
        };
      }
    } catch (error) {
      logger.error('Error evaluating rule:', error);
      return {
        passed: false,
        failureReason: 'Rule evaluation error',
      };
    }
  }
  
  /**
   * Evaluate a single condition
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private evaluateCondition(condition: any, data: Record<string, any>): boolean {
    const fieldValue = data[condition.field];
    const expectedValue = condition.value;
    
    switch (condition.operator) {
      case '==':
      case 'equals':
        return fieldValue === expectedValue;
      
      case '!=':
      case 'not_equals':
        return fieldValue !== expectedValue;
      
      case '>':
      case 'greater_than':
        return fieldValue > expectedValue;
      
      case '>=':
      case 'greater_or_equal':
        return fieldValue >= expectedValue;
      
      case '<':
      case 'less_than':
        return fieldValue < expectedValue;
      
      case '<=':
      case 'less_or_equal':
        return fieldValue <= expectedValue;
      
      case 'in':
      case 'contains':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      
      case 'not_in':
      case 'not_contains':
        return !Array.isArray(expectedValue) || !expectedValue.includes(fieldValue);
      
      default:
        logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }
  
  /**
   * Check if subject has an active exception for any of the rules
   */
  private async checkException(
    ruleIds: string[],
    subjectType: string,
    subjectId: string
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    
    const exceptions = await db
      .select()
      .from(policyExceptions)
      .where(
        and(
          sql`${policyExceptions.ruleId} IN (${sql.join(ruleIds.map(id => sql`${id}`), sql`, `)})`,
          eq(policyExceptions.subjectType, subjectType),
          eq(policyExceptions.subjectId, subjectId),
          eq(policyExceptions.status, 'active'),
          lte(policyExceptions.effectiveDate, today),
          sql`(${policyExceptions.expirationDate} IS NULL OR ${policyExceptions.expirationDate} >= ${today})`
        )
      );
    
    return exceptions.length > 0;
  }
  
  /**
   * Get retention policy for data type
   */
  async getRetentionPolicy(
    organizationId: string,
    dataType: string
  ) {
    const [policy] = await db
      .select()
      .from(retentionPolicies)
      .where(
        and(
          eq(retentionPolicies.organizationId, organizationId),
          eq(retentionPolicies.dataType, dataType),
          eq(retentionPolicies.status, 'active')
        )
      )
      .limit(1);
    
    return policy || null;
  }
  
  /**
   * Check if data is under legal hold
   */
  async checkLegalHold(
    organizationId: string,
    dataType: string,
    dataDate?: Date
  ): Promise<boolean> {
    const conditions = [
      eq(legalHolds.organizationId, organizationId),
     eq(legalHolds.status, 'active'),
      sql`${dataType} = ANY(${legalHolds.dataTypes})`,
    ];
    
    if (dataDate) {
      const dateStr = dataDate.toISOString().split('T')[0];
      conditions.push(
        sql`(${legalHolds.dateRangeStart} IS NULL OR ${legalHolds.dateRangeStart} <= ${dateStr})`
      );
      conditions.push(
        sql`(${legalHolds.dateRangeEnd} IS NULL OR ${legalHolds.dateRangeEnd} >= ${dateStr})`
      );
    }
    
    const holds = await db
      .select()
      .from(legalHolds)
      .where(and(...conditions));
    
    return holds.length > 0;
  }
  
  /**
   * Check if data can be deleted based on retention policy and legal holds
   */
  async canDelete(
    organizationId: string,
    dataType: string,
    dataDate: Date
  ): Promise<{ canDelete: boolean; reason?: string }> {
    // Check legal hold first
    const onHold = await this.checkLegalHold(organizationId, dataType, dataDate);
    if (onHold) {
      return {
        canDelete: false,
        reason: 'Data is under legal hold',
      };
    }
    
    // Check retention policy
    const policy = await this.getRetentionPolicy(organizationId, dataType);
    if (!policy) {
      return {
        canDelete: false,
        reason: 'No retention policy defined',
      };
    }
    
    // Calculate retention expiry date based on trigger
    const now = new Date();
    const retentionEndDate = new Date(dataDate);
    retentionEndDate.setFullYear(retentionEndDate.getFullYear() + policy.retentionPeriodYears);
    
    if (now < retentionEndDate) {
      return {
        canDelete: false,
        reason: `Retention period not expired (expires ${retentionEndDate.toISOString().split('T')[0]})`,
      };
    }
    
    return {
      canDelete: true,
    };
  }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
