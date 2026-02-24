/**
 * AI Cost Tracking Wrapper Service
 * 
 * Wrapper around LLM API calls that provides:
 * - Rate limiting enforcement
 * - Cost tracking and recording
 * - Usage metrics collection
 * - Budget alerts
 * 
 * This service wraps existing AI providers (OpenAI, Anthropic, Google)
 * and adds cost controls without modifying the core AI logic.
 * 
 * Part of Phase 1: LLM Excellence Implementation
 */

import { db } from '@/db';
import { aiUsageMetrics, aiBudgets } from '@/db/schema';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { logger } from '@/lib/logger';
import { aiRateLimiter } from './rate-limiter';
import { tokenCostCalculator } from './token-cost-calculator';
import { eq, and, gte, inArray, or } from 'drizzle-orm';
import { getNotificationService } from '@/lib/services/notification-service';

export interface LLMRequest {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  messages?: Array<{ role: string; content: string }>;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow other provider-specific options
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface LLMResponse<T = any> {
  success: true;
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUSD: number;
  };
  latencyMs: number;
  model: string;
}

export interface LLMError {
  success: false;
  error: string;
  rateLimitInfo?: {
    reason: string;
    retryAfter?: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LLMResult<T = any> = LLMResponse<T> | LLMError;

export interface BudgetAlert {
  organizationId: string;
  currentSpend: number;
  monthlyLimit: number;
  percentUsed: number;
  alertLevel: 'warning' | 'critical';
}

export class CostTrackingWrapper {
  /**
   * Wrap an LLM API call with cost tracking and rate limiting
   */
  async trackLLMCall<T>(
    organizationId: string,
    userId: string,
    request: LLMRequest,
    apiCallFn: () => Promise<T>
  ): Promise<LLMResult<T>> {
    const startTime = Date.now();
    const operation = 'completion'; // Could be parameterized: 'completion' | 'embedding' | 'moderation'
    
    try {
      // Step 1: Estimate costs
      const estimatedTokens = this.estimateInputTokens(request);
      const modelInfo = tokenCostCalculator.getModelPricing(request.model);
      
      if (!modelInfo) {
        logger.warn('Unknown model, using default costs', { model: request.model });
      }
      
      const estimatedCostUSD = modelInfo
        ? tokenCostCalculator.calculateCost(
            request.model,
            estimatedTokens,
            request.maxTokens || 1000
          )
        : 0.01; // Default estimate
      
      // Step 2: Check rate limits
      const rateLimitResult = await aiRateLimiter.checkLimit(
        organizationId,
        estimatedTokens,
        estimatedCostUSD
      );
      
      if (!rateLimitResult.allowed) {
        logger.info('LLM request blocked by rate limiter', {
          organizationId,
          reason: rateLimitResult.reason,
          currentUsage: rateLimitResult.currentUsage,
        });
        
        return {
          success: false,
          error: rateLimitResult.reason || 'Rate limit exceeded',
          rateLimitInfo: {
            reason: rateLimitResult.reason || 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter,
          },
        };
      }
      
      // Step 3: Make actual API call
      const apiResult = await apiCallFn();
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      
      // Step 4: Extract actual token usage from response
      const usage = this.extractTokenUsage(apiResult, request.provider);
      
      // Step 5: Calculate actual cost
      const actualCostUSD = tokenCostCalculator.calculateCost(
        request.model,
        usage.inputTokens,
        usage.outputTokens
      );
      
      // Step 6: Record usage to Redis
      await aiRateLimiter.recordUsage(
        organizationId,
        usage.totalTokens,
        actualCostUSD
      );
      
      // Step 7: Record metrics to PostgreSQL
      await this.recordMetrics({
        organizationId,
        userId,
        provider: request.provider,
        model: request.model,
        operation,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        costUsd: actualCostUSD.toString(),
        latencyMs,
      });
      
      // Step 8: Check budget alerts
      await this.checkBudgetAlerts(organizationId);
      
      logger.info('LLM request completed', {
        organizationId,
        model: request.model,
        tokens: usage.totalTokens,
        costUSD: actualCostUSD,
        latencyMs,
      });
      
      return {
        success: true,
        data: apiResult,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          costUSD: actualCostUSD,
        },
        latencyMs,
        model: request.model,
      };
    } catch (error) {
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      
      logger.error('LLM request failed', {
        error,
        organizationId,
        model: request.model,
        latencyMs,
      });
      
      // Record failed request
      await this.recordMetrics({
        organizationId,
        userId,
        provider: request.provider,
        model: request.model,
        operation,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: '0',
        latencyMs,
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Estimate input tokens from request
   */
  private estimateInputTokens(request: LLMRequest): number {
    let text = '';
    
    if (request.messages) {
      text = request.messages.map(m => m.content).join(' ');
    } else if (request.prompt) {
      text = request.prompt;
    }
    
    return tokenCostCalculator.estimateTokens(text);
  }
  
  /**
   * Extract token usage from provider response
   */
  private extractTokenUsage(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: any,
    provider: 'openai' | 'anthropic' | 'google'
  ): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } {
    // OpenAI format
    if (response?.usage) {
      return {
        inputTokens: response.usage.prompt_tokens || 0,
        outputTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
      };
    }
    
    // Anthropic format (Claude)
    if (response?.usage && provider === 'anthropic') {
      return {
        inputTokens: response.usage.input_tokens || 0,
        outputTokens: response.usage.output_tokens || 0,
        totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
      };
    }
    
    // Google format (Gemini)
    if (response?.usageMetadata && provider === 'google') {
      return {
        inputTokens: response.usageMetadata.promptTokenCount || 0,
        outputTokens: response.usageMetadata.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata.totalTokenCount || 0,
      };
    }
    
    // Fallback: estimate from response text
    logger.warn('Could not extract token usage from response, estimating', { provider });
    const outputText = this.extractResponseText(response);
    const outputTokens = tokenCostCalculator.estimateTokens(outputText);
    
    return {
      inputTokens: 0,
      outputTokens,
      totalTokens: outputTokens,
    };
  }
  
  /**
   * Extract response text for token estimation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractResponseText(response: any): string {
    // OpenAI
    if (response?.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }
    
    // Anthropic
    if (response?.content?.[0]?.text) {
      return response.content[0].text;
    }
    
    // Google
    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
    
    // Fallback
    if (typeof response === 'string') {
      return response;
    }
    
    return JSON.stringify(response);
  }
  
  /**
   * Record metrics to database
   */
  private async recordMetrics(data: {
    organizationId: string;
    userId: string;
    provider: string;
    model: string;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: string;
    latencyMs: number;
  }): Promise<void> {
    try {
      await db.insert(aiUsageMetrics).values({
        organizationId: data.organizationId,
        userId: data.userId,
        provider: data.provider,
        model: data.model,
        operation: data.operation,
        tokensInput: data.inputTokens,
        tokensOutput: data.outputTokens,
        tokensTotal: data.totalTokens,
        estimatedCost: data.costUsd,
        latencyMs: data.latencyMs,
      });
    } catch (error) {
      logger.error('Failed to record AI usage metrics', { error, data });
    }
  }
  
  /**
   * Check if organization has exceeded budget thresholds
   */
  private async checkBudgetAlerts(organizationId: string): Promise<BudgetAlert | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const budget = await db.query.aiBudgets.findFirst({
        where: and(
          eq(aiBudgets.organizationId, organizationId),
          gte(aiBudgets.billingPeriodEnd, today)
        ),
      });
      
      if (!budget) {
        return null;
      }
      
      const currentSpend = parseFloat((budget.currentSpendUsd || '0').toString());
      const monthlyLimit = parseFloat(budget.monthlyLimitUsd.toString());
      const percentUsed = (currentSpend / monthlyLimit) * 100;
      
      // Warning at 80%, critical at 95%
      if (percentUsed >= 80) {
        const alertLevel = percentUsed >= 95 ? 'critical' : 'warning';
        
        logger.warn('Budget alert', {
          organizationId,
          currentSpend,
          monthlyLimit,
          percentUsed: percentUsed.toFixed(2),
          alertLevel,
        });
        
        await this.sendBudgetAlertNotification({
          organizationId,
          currentSpend,
          monthlyLimit,
          percentUsed,
          alertLevel,
        });
        
        return {
          organizationId,
          currentSpend,
          monthlyLimit,
          percentUsed,
          alertLevel,
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to check budget alerts', { error, organizationId });
      return null;
    }
  }

  private async sendBudgetAlertNotification(alert: BudgetAlert): Promise<void> {
    try {
      const [org] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          email: organizations.email,
        })
        .from(organizations)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(or(eq(organizations.id, alert.organizationId as any), eq(organizations.slug, alert.organizationId)))
        .limit(1);

      const orgIdentifiers = new Set<string>();
      orgIdentifiers.add(alert.organizationId);
      if (org?.id) orgIdentifiers.add(String(org.id));
      if (org?.slug) orgIdentifiers.add(org.slug);

      const adminRoles = ['admin', 'super_admin', 'billing_manager', 'billing_specialist', 'platform_lead'];
      const admins = await db
        .select({
          email: organizationMembers.email,
          name: organizationMembers.name,
        })
        .from(organizationMembers)
        .where(
          and(
            inArray(organizationMembers.organizationId, Array.from(orgIdentifiers)),
            inArray(organizationMembers.role, adminRoles)
          )
        );

      const notificationService = getNotificationService();
      const organizationName = org?.name || alert.organizationId;
      const recipients = new Map<string, string>();

      for (const admin of admins) {
        if (admin.email) {
          recipients.set(admin.email, admin.name || admin.email);
        }
      }

      if (org?.email) {
        recipients.set(org.email, organizationName);
      }

      if (recipients.size === 0) {
        logger.warn('No recipients found for AI budget alert', {
          organizationId: alert.organizationId,
        });
        return;
      }

      const subject = `AI budget ${alert.alertLevel === 'critical' ? 'critical alert' : 'warning'} - ${organizationName}`;
      const body = `AI usage for ${organizationName} is at ${alert.percentUsed.toFixed(2)}% of the monthly limit.\n\n` +
        `Current spend: $${alert.currentSpend.toFixed(2)}\n` +
        `Monthly limit: $${alert.monthlyLimit.toFixed(2)}\n` +
        `Alert level: ${alert.alertLevel.toUpperCase()}\n`;

      await Promise.all(
        Array.from(recipients.entries()).map(([email, name]) =>
          notificationService.send({
            organizationId: alert.organizationId,
            recipientEmail: email,
            type: 'email',
            priority: alert.alertLevel === 'critical' ? 'urgent' : 'high',
            subject,
            title: subject,
            body,
            htmlBody: body.replace(/\n/g, '<br />'),
            metadata: {
              alertLevel: alert.alertLevel,
              percentUsed: alert.percentUsed,
              recipientName: name,
            },
          })
        )
      );
    } catch (error) {
      logger.error('Failed to send budget alert notification', {
        error,
        organizationId: alert.organizationId,
      });
    }
  }
  
  /**
   * Get organization usage summary
   */
  async getUsageSummary(organizationId: string): Promise<{
    budget: {
      monthlyLimit: number;
      currentSpend: number;
      percentUsed: number;
      periodEnd: string;
    } | null;
    rateLimits: {
      requestsThisMinute: number;
      tokensThisHour: number;
      costToday: number;
    };
  }> {
    try {
      // Get budget info
      const today = new Date().toISOString().split('T')[0];
      const budget = await db.query.aiBudgets.findFirst({
        where: and(
          eq(aiBudgets.organizationId, organizationId),
          gte(aiBudgets.billingPeriodEnd, today)
        ),
      });
      
      const budgetInfo = budget ? {
        monthlyLimit: parseFloat(budget.monthlyLimitUsd.toString()),
        currentSpend: parseFloat((budget.currentSpendUsd || '0').toString()),
        percentUsed: (parseFloat((budget.currentSpendUsd || '0').toString()) / parseFloat(budget.monthlyLimitUsd.toString())) * 100,
        periodEnd: budget.billingPeriodEnd,
      } : null;
      
      // Get rate limit stats
      const rateLimits = await aiRateLimiter.getUsageStats(organizationId);
      
      return {
        budget: budgetInfo,
        rateLimits,
      };
    } catch (error) {
      logger.error('Failed to get usage summary', { error, organizationId });
      return {
        budget: null,
        rateLimits: { requestsThisMinute: 0, tokensThisHour: 0, costToday: 0 },
      };
    }
  }
}

// Singleton instance
export const costTrackingWrapper = new CostTrackingWrapper();
