/**
 * Cost Attribution Telemetry
 *
 * Attaches cost-relevant metadata to every span so that
 * compute/storage/network/AI costs can be broken down per org.
 */

import { z } from 'zod';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const CostAttributionSchema = z.object({
  orgId: z.string().min(1),
  workflowId: z.string().optional(),
  resourceType: z.enum(['compute', 'storage', 'network', 'ai']),
  usage: z.number().nonnegative(),
  unit: z.string(),
  costUSD: z.number().nonnegative(),
  timestamp: z.date(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  serviceName: z.string(),
  environment: z.string().default('development'),
});

export type CostAttribution = z.infer<typeof CostAttributionSchema>;

export const ResourceMetricsSchema = z.object({
  orgId: z.string().min(1),
  serviceName: z.string(),
  durationMs: z.number().nonnegative(),
  memoryMb: z.number().nonnegative(),
  cpuSeconds: z.number().nonnegative().optional(),
  storageBytes: z.number().nonnegative().optional(),
  networkBytes: z.number().nonnegative().optional(),
  aiTokensInput: z.number().nonnegative().optional(),
  aiTokensOutput: z.number().nonnegative().optional(),
  aiModelId: z.string().optional(),
});

export type ResourceMetrics = z.infer<typeof ResourceMetricsSchema>;

// ── Pricing Rates (configurable via env) ─────────────────────────────────────

interface PricingRates {
  computePerCpuSecond: number;
  memoryPerGbHour: number;
  storagePerGbMonth: number;
  networkPerGb: number;
  aiPerInputToken: number;
  aiPerOutputToken: number;
}

const DEFAULT_RATES: PricingRates = {
  computePerCpuSecond: 0.0000166667, // ~$0.06/hr
  memoryPerGbHour: 0.004445,
  storagePerGbMonth: 0.02,
  networkPerGb: 0.087,
  aiPerInputToken: 0.000003, // GPT-4o class
  aiPerOutputToken: 0.000015,
};

// ── Cost Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate cost attribution from resource metrics.
 * Injects trace context from the active span if available.
 */
export async function attributeCost(
  metrics: ResourceMetrics,
  rates: Partial<PricingRates> = {},
): Promise<CostAttribution> {
  const r = { ...DEFAULT_RATES, ...rates };
  const validated = ResourceMetricsSchema.parse(metrics);

  let totalCost = 0;
  let resourceType: CostAttribution['resourceType'] = 'compute';

  // Compute cost
  const computeDurationHours = validated.durationMs / 3_600_000;
  const memoryCostGb = (validated.memoryMb / 1024) * computeDurationHours;
  totalCost += (validated.cpuSeconds ?? validated.durationMs / 1000) * r.computePerCpuSecond;
  totalCost += memoryCostGb * r.memoryPerGbHour;

  // Storage cost
  if (validated.storageBytes) {
    const storageGb = validated.storageBytes / (1024 * 1024 * 1024);
    totalCost += storageGb * r.storagePerGbMonth / 720; // per hour
    resourceType = 'storage';
  }

  // Network cost
  if (validated.networkBytes) {
    const networkGb = validated.networkBytes / (1024 * 1024 * 1024);
    totalCost += networkGb * r.networkPerGb;
    resourceType = 'network';
  }

  // AI cost
  if (validated.aiTokensInput || validated.aiTokensOutput) {
    totalCost += (validated.aiTokensInput ?? 0) * r.aiPerInputToken;
    totalCost += (validated.aiTokensOutput ?? 0) * r.aiPerOutputToken;
    resourceType = 'ai';
  }

  // Extract trace context
  let traceId: string | undefined;
  let spanId: string | undefined;
  try {
    const { trace } = await import('@opentelemetry/api');
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const ctx = activeSpan.spanContext();
      traceId = ctx.traceId;
      spanId = ctx.spanId;

      // Inject cost attributes into the span
      activeSpan.setAttribute('nzila.org.id', validated.orgId);
      activeSpan.setAttribute('nzila.cost.usd', totalCost);
      activeSpan.setAttribute('nzila.cost.resource_type', resourceType);
      activeSpan.setAttribute('compute.duration.ms', validated.durationMs);
      activeSpan.setAttribute('compute.memory.mb', validated.memoryMb);
      if (validated.aiModelId) {
        activeSpan.setAttribute('nzila.ai.model_id', validated.aiModelId);
      }
    }
  } catch {
    // OTel not available
  }

  return CostAttributionSchema.parse({
    orgId: validated.orgId,
    workflowId: undefined,
    resourceType,
    usage: validated.durationMs,
    unit: 'ms',
    costUSD: Math.round(totalCost * 1_000_000) / 1_000_000, // 6 decimal precision
    timestamp: new Date(),
    traceId,
    spanId,
    serviceName: validated.serviceName,
    environment: process.env.NODE_ENV ?? 'development',
  });
}
