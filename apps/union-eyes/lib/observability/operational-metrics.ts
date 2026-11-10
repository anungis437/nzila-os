import { getAllQueueStats } from '@/lib/job-queue';
import { constantTimeEquals } from '@/lib/security/constant-time';

export const OPERATIONAL_METRICS_CAPABILITY = 'metrics:platform_operational:read';

export type MetricsAuthentication = 'allowed' | 'unconfigured' | 'denied';

/** A dedicated service credential; interactive/platform roles and unrelated service keys confer nothing. */
export function authenticateOperationalMetrics(request: Request, env: NodeJS.ProcessEnv = process.env): MetricsAuthentication {
  const expected = env.UE_METRICS_SERVICE_KEY;
  if (!expected || expected.length < 32 || expected === env.AI_SERVICE_KEY || expected === env.QUEUE_STATUS_SERVICE_KEY) {
    return 'unconfigured';
  }
  return constantTimeEquals(request.headers.get('x-service-key'), expected) ? 'allowed' : 'denied';
}

export interface OperationalMetricsSnapshot {
  queueDepth: number;
  queueActive: number;
  queueReserved: number;
  queueScheduled: number;
  queueFailed: number;
}

/** Platform runtime facts only. This function must never query a tenant table or attach tenant/user/resource labels. */
export async function readOperationalMetrics(): Promise<OperationalMetricsSnapshot> {
  const queues = await getAllQueueStats();
  const sum = (field: 'active' | 'reserved' | 'scheduled' | 'failed') =>
    queues.reduce((total, queue) => {
      const measured = queue as typeof queue & { failed?: number };
      return total + Math.max(0, Number(measured[field] ?? 0));
    }, 0);
  const queueActive = sum('active');
  const queueReserved = sum('reserved');
  const queueScheduled = sum('scheduled');
  return {
    queueDepth: queueActive + queueReserved + queueScheduled,
    queueActive,
    queueReserved,
    queueScheduled,
    queueFailed: sum('failed'),
  };
}

const HELP: ReadonlyArray<[keyof OperationalMetricsSnapshot, string, string]> = [
  ['queueDepth', 'union_eyes_queue_depth', 'Total active, reserved and scheduled platform jobs.'],
  ['queueActive', 'union_eyes_queue_active', 'Platform jobs currently executing.'],
  ['queueReserved', 'union_eyes_queue_reserved', 'Platform jobs reserved by a worker.'],
  ['queueScheduled', 'union_eyes_queue_scheduled', 'Platform jobs scheduled for future execution.'],
  ['queueFailed', 'union_eyes_queue_failed', 'Platform jobs currently recorded as failed.'],
];

/** Prometheus 0.0.4 exposition with fixed metric names and no attacker/tenant-controlled labels. */
export function toPrometheus(snapshot: OperationalMetricsSnapshot): string {
  const lines: string[] = [];
  for (const [field, name, help] of HELP) {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${snapshot[field]}`);
  }
  return `${lines.join('\n')}\n`;
}
