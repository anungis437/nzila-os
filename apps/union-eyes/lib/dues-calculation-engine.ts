import { db } from '@/db';
import {
  duesRules,
  memberDuesAssignments,
  duesTransactions,
  members,
} from '@/services/financial-service/src/db/schema';
import { eq, and, sql, lte, gte, or, isNull, desc } from 'drizzle-orm';

interface DuesCalculationParams {
  organizationId: string;
  memberId: string;
  periodStart: Date;
  periodEnd: Date;
  memberData?: {
    grossWages?: number;
    baseSalary?: number;
    hourlyRate?: number;
    hoursWorked?: number;
  };
}

interface DuesCalculationResult {
  amount: number;
  calculationType: string;
  ruleId: string;
  ruleName: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  breakdown: {
    baseAmount: number;
    rate?: number;
    hours?: number;
    tier?: string;
    flatAmount?: number;
    formula?: string;
  };
}

export class DuesCalculationEngine {
  private static readonly MAX_FORMULA_LENGTH = 200;
  private static readonly SAFE_FORMULA_REGEX = /^[0-9+\-*/(). _a-zA-Z]+$/;

  /**
   * Calculate dues for a member for a given period
   */
  static async calculateMemberDues(
    params: DuesCalculationParams
  ): Promise<DuesCalculationResult | null> {
    const { organizationId, memberId, periodStart, periodEnd, memberData } = params;

    // Get active dues assignment for member
    const [assignment] = await db
      .select({
        assignment: memberDuesAssignments,
        rule: duesRules,
      })
      .from(memberDuesAssignments)
      .leftJoin(duesRules, eq(memberDuesAssignments.ruleId, duesRules.id))
      .where(
        and(
          eq(memberDuesAssignments.memberId, memberId),
          eq(memberDuesAssignments.organizationId, organizationId),
          eq(memberDuesAssignments.isActive, true),
          lte(memberDuesAssignments.effectiveDate, periodStart.toISOString().split('T')[0]),
          or(
            isNull(memberDuesAssignments.endDate),
            gte(memberDuesAssignments.endDate, periodStart.toISOString().split('T')[0])
          )
        )
      )
      .limit(1);

    if (!assignment || !assignment.rule) {
return null;
    }

    const { assignment: assignmentData, rule } = assignment;

    // Check for override amount
    if (assignmentData.overrideAmount) {
      return {
        amount: parseFloat(assignmentData.overrideAmount.toString()),
        calculationType: 'override',
        ruleId: rule.id,
        ruleName: rule.ruleName,
        periodStart,
        periodEnd,
        dueDate: this.calculateDueDate(periodEnd, rule.billingFrequency),
        breakdown: {
          baseAmount: parseFloat(assignmentData.overrideAmount.toString()),
        },
      };
    }

    // Calculate based on rule type
    let amount: number;
    let breakdown: DuesCalculationResult['breakdown'] = { baseAmount: 0 };

    switch (rule.calculationType) {
      case 'flat_rate':
        amount = parseFloat(rule.flatAmount?.toString() || '0');
        breakdown = { baseAmount: amount };
        break;

      case 'percentage':
        amount = this.calculatePercentageDues(rule, memberData);
        breakdown = {
          baseAmount: memberData?.[rule.baseField as keyof typeof memberData] || 0,
          rate: parseFloat(rule.percentageRate?.toString() || '0'),
        };
        break;

      case 'hourly':
        amount = this.calculateHourlyDues(rule, memberData);
        breakdown = {
          hours: memberData?.hoursWorked || parseFloat(rule.hoursPerPeriod?.toString() || '0'),
          rate: parseFloat(rule.hourlyRate?.toString() || '0'),
          baseAmount: amount,
        };
        break;

      case 'tiered':
        const tierResult = this.calculateTieredDues(rule, memberData);
        amount = tierResult.amount;
        breakdown = tierResult.breakdown as DuesCalculationResult['breakdown'];
        break;

      case 'formula':
        amount = this.calculateFormulaDues(rule, memberData);
        breakdown = { baseAmount: amount, formula: rule.customFormula ?? undefined };
        break;

      default:
return null;
    }

    return {
      amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      calculationType: rule.calculationType,
      ruleId: rule.id,
      ruleName: rule.ruleName,
      periodStart,
      periodEnd,
      dueDate: this.calculateDueDate(periodEnd, rule.billingFrequency),
      breakdown,
    };
  }

  /**
   * Calculate percentage-based dues
   */
  private static calculatePercentageDues(
    rule: typeof duesRules.$inferSelect,
    memberData?: DuesCalculationParams['memberData']
  ): number {
    if (!rule.percentageRate || !rule.baseField) {
      return 0;
    }

    const baseAmount = memberData?.[rule.baseField as keyof typeof memberData] || 0;
    const rate = parseFloat(rule.percentageRate.toString()) / 100;
    
    return baseAmount * rate;
  }

  /**
   * Calculate hourly-based dues
   */
  private static calculateHourlyDues(
    rule: typeof duesRules.$inferSelect,
    memberData?: DuesCalculationParams['memberData']
  ): number {
    if (!rule.hourlyRate) {
      return 0;
    }

    const hours = memberData?.hoursWorked || parseFloat(rule.hoursPerPeriod?.toString() || '0');
    const rate = parseFloat(rule.hourlyRate.toString());
    
    return hours * rate;
  }

  /**
   * Calculate tiered dues
   */
  private static calculateTieredDues(
    rule: typeof duesRules.$inferSelect,
    memberData?: DuesCalculationParams['memberData']
  ): { amount: number; breakdown: unknown } {
    if (!rule.tierStructure || !Array.isArray(rule.tierStructure)) {
      return { amount: 0, breakdown: {} };
    }

    const baseAmount = memberData?.grossWages || memberData?.baseSalary || 0;
    
    // Find applicable tier
    for (const tier of rule.tierStructure) {
      const minAmount = tier.minAmount || 0;
      const maxAmount = tier.maxAmount || Infinity;
      
      if (baseAmount >= minAmount && baseAmount <= maxAmount) {
        let tierAmount = 0;
        
        if (tier.flatAmount) {
          tierAmount = tier.flatAmount;
        } else if (tier.rate) {
          tierAmount = baseAmount * (tier.rate / 100);
        }
        
        return {
          amount: tierAmount,
          breakdown: {
            baseAmount,
            tier: `$${minAmount}-$${maxAmount === Infinity ? 'âˆž' : maxAmount}`,
            rate: tier.rate,
            flatAmount: tier.flatAmount,
          },
        };
      }
    }

    return { amount: 0, breakdown: { baseAmount, tier: 'none' } };
  }

  /**
   * Calculate formula-based dues
   */
  private static calculateFormulaDues(
    rule: typeof duesRules.$inferSelect,
    memberData?: DuesCalculationParams['memberData']
  ): number {
    if (!rule.customFormula) {
      return 0;
    }

    try {
      this.validateFormula(rule.customFormula);
      const context = this.buildFormulaContext(memberData);
      const substituted = this.replaceFormulaVariables(rule.customFormula, context);
      const result = this.evaluateSafeFormula(substituted);
      return Number.isFinite(result) ? result : 0;
    } catch (_error) {
return 0;
    }
  }

  private static buildFormulaContext(memberData?: DuesCalculationParams['memberData']): Record<string, number> {
    return {
      grossWages: memberData?.grossWages ?? 0,
      baseSalary: memberData?.baseSalary ?? 0,
      hourlyRate: memberData?.hourlyRate ?? 0,
      hoursWorked: memberData?.hoursWorked ?? 0,
    };
  }

  private static validateFormula(formula: string): void {
    if (formula.length > this.MAX_FORMULA_LENGTH) {
      throw new Error('Formula exceeds maximum length');
    }
    if (!this.SAFE_FORMULA_REGEX.test(formula)) {
      throw new Error('Formula contains unsafe characters');
    }
    const dangerousPatterns = [/eval/i, /function/i, /import/i, /require/i, /process/i, /exec/i];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(formula)) {
        throw new Error('Formula contains forbidden pattern');
      }
    }
  }

  private static replaceFormulaVariables(formula: string, context: Record<string, number>): string {
    let substituted = formula;
    Object.entries(context).forEach(([key, value]) => {
      substituted = substituted.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
    });
    return substituted;
  }

  private static evaluateSafeFormula(formula: string): number {
    let pos = 0;

    const peek = (): string => formula[pos] || '';
    const consume = (): string => formula[pos++] || '';
    const skipWhitespace = () => {
      while (peek() === ' ') consume();
    };

    const parseNumber = (): number => {
      skipWhitespace();
      let numStr = '';
      while (/[0-9.]/.test(peek())) {
        numStr += consume();
      }
      if (!numStr) throw new Error('Expected number');
      return Number(numStr);
    };

    const parseFactor = (): number => {
      skipWhitespace();
      if (peek() === '-') {
        consume();
        return -parseFactor();
      }
      if (peek() === '(') {
        consume();
        const result = parseExpression();
        skipWhitespace();
        if (consume() !== ')') throw new Error('Expected )');
        return result;
      }
      return parseNumber();
    };

    const parseTerm = (): number => {
      let result = parseFactor();
      skipWhitespace();

      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const right = parseFactor();
        result = op === '*' ? result * right : result / right;
        skipWhitespace();
      }

      return result;
    };

    const parseExpression = (): number => {
      let result = parseTerm();
      skipWhitespace();

      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const right = parseTerm();
        result = op === '+' ? result + right : result - right;
        skipWhitespace();
      }

      return result;
    };

    return parseExpression();
  }

  private static async resolveMemberData(
    organizationId: string,
    memberId: string
  ): Promise<DuesCalculationParams['memberData'] | undefined> {
    try {
      const [lastTransaction] = await db
        .select({ metadata: duesTransactions.metadata })
        .from(duesTransactions)
        .where(
          and(
            eq(duesTransactions.organizationId, organizationId),
            eq(duesTransactions.memberId, memberId)
          )
        )
        .orderBy(desc(duesTransactions.createdAt))
        .limit(1);

      if (!lastTransaction?.metadata) {
        return undefined;
      }

      const metadata = typeof lastTransaction.metadata === 'string'
        ? JSON.parse(lastTransaction.metadata)
        : lastTransaction.metadata;

      const breakdown = metadata?.breakdown ?? metadata;
      const baseAmount = Number(breakdown?.baseAmount ?? 0);
      const hoursWorked = Number(breakdown?.hours ?? 0);
      const hourlyRate = Number(breakdown?.rate ?? 0);

      return {
        grossWages: baseAmount || undefined,
        baseSalary: baseAmount || undefined,
        hourlyRate: hourlyRate || undefined,
        hoursWorked: hoursWorked || undefined,
      };
    } catch (_error) {
return undefined;
    }
  }

  /**
   * Calculate due date based on billing frequency
   */
  private static calculateDueDate(periodEnd: Date, _frequency: string): Date {
    const dueDate = new Date(periodEnd);
    
    // Due date is typically 15 days after period end
    dueDate.setDate(dueDate.getDate() + 15);
    
    return dueDate;
  }

  /**
   * Generate dues transactions for all members for a billing period
   */
  static async generateBillingCycle(organizationId: string, periodStart: Date, periodEnd: Date) {
    try {
      // Get all active members with dues assignments
      const activeMembers = await db
        .select({
          member: members,
          assignment: memberDuesAssignments,
        })
        .from(members)
        .leftJoin(
          memberDuesAssignments,
          and(
            eq(members.id, memberDuesAssignments.memberId),
            eq(memberDuesAssignments.isActive, true)
          )
        )
        .where(
          and(
            eq(members.organizationId, organizationId),
            eq(members.status, 'active')
          )
        );

      const transactionsToCreate: (typeof duesTransactions.$inferInsert)[] = [];

      for (const { member, assignment } of activeMembers) {
        if (!assignment) continue;

        // Check if transaction already exists for this period
        const [existing] = await db
          .select()
          .from(duesTransactions)
          .where(
            and(
              eq(duesTransactions.memberId, member.id),
              eq(duesTransactions.periodStart, periodStart.toISOString().split('T')[0]),
              eq(duesTransactions.periodEnd, periodEnd.toISOString().split('T')[0])
            )
          )
          .limit(1);

        if (existing) {
continue;
        }

        // Calculate dues
        const calculation = await this.calculateMemberDues({
          organizationId,
          memberId: member.id,
          periodStart,
          periodEnd,
          memberData: await this.resolveMemberData(organizationId, member.id),
        });

        if (!calculation) {
continue;
        }

        transactionsToCreate.push({
          organizationId,
          memberId: member.id,
          assignmentId: assignment.id,
          ruleId: calculation.ruleId,
          transactionType: 'payment',
          amount: calculation.amount.toString(),
          duesAmount: calculation.amount.toString(), // Base dues amount
          lateFeeAmount: '0.00',
          totalAmount: calculation.amount.toString(),
          periodStart: periodStart.toISOString().split('T')[0],
          periodEnd: periodEnd.toISOString().split('T')[0],
          dueDate: calculation.dueDate.toISOString().split('T')[0],
          status: 'pending',
          metadata: JSON.stringify({
            calculationType: calculation.calculationType,
            breakdown: calculation.breakdown,
          }),
        });
      }

      // Bulk insert transactions
      if (transactionsToCreate.length > 0) {
        await db.insert(duesTransactions).values(transactionsToCreate);
}

      return {
        success: true,
        transactionsCreated: transactionsToCreate.length,
      };
    } catch (error) {
throw error;
    }
  }

  /**
   * Calculate late fees for overdue transactions
   */
  static async calculateLateFees(organizationId: string, lateFeeRate: number = 0.02) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all overdue transactions without late fees
      const overdueTransactions = await db
        .select()
        .from(duesTransactions)
        .where(
          and(
            eq(duesTransactions.organizationId, organizationId),
            eq(duesTransactions.status, 'pending'),
            sql`${duesTransactions.dueDate} < ${today}`,
            sql`CAST(${duesTransactions.lateFeeAmount} AS DECIMAL) = 0`
          )
        );

      for (const transaction of overdueTransactions) {
        const amount = parseFloat(transaction.amount.toString());
        const lateFee = Math.round(amount * lateFeeRate * 100) / 100;
        const newTotal = amount + lateFee;

        await db
          .update(duesTransactions)
          .set({
            lateFeeAmount: lateFee.toString(),
            totalAmount: newTotal.toString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(duesTransactions.id, transaction.id));
      }
return {
        success: true,
        transactionsUpdated: overdueTransactions.length,
      };
    } catch (error) {
throw error;
    }
  }
}

