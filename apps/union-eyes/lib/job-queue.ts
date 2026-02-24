/**
 * Job Queue � Celery-backed implementation
 *
 * Public API is identical to the previous BullMQ version so every caller
 * (API routes, server actions, lib code) continues to work without change.
 *
 * Background jobs are now executed by Django Celery workers.
 * This module is a *thin HTTP client* that POSTs to:
 *   POST {DJANGO_API_URL}/api/tasks/enqueue/
 *
 * Motivation for removing BullMQ:
 *   - Workers were running inside Next.js � fragile in serverless / edge envs
 *   - Duplicate Redis connections (Next.js + Django both used Redis)
 *   - All business logic now lives in the Python monolith
 *
 * Migration date: 2026-02-19
 */

// ============================================================
// Types  (kept identical to the old BullMQ version)
// ============================================================

import { createLogger } from '@nzila/os-core'
export interface EmailJobData {
  type: 'email';
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
  priority?: number;
}

const logger = createLogger('job-queue')

export interface SmsJobData {
  type: 'sms';
  to: string;
  message: string;
  priority?: number;
}

export interface NotificationJobData {
  type: 'notification';
  userId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: ('email' | 'sms' | 'push' | 'in-app')[];
}

export interface ReportJobData {
  type: 'report';
  reportType: string;
  organizationId: string;
  userId: string;
  parameters: Record<string, unknown>;
}

export interface CleanupJobData {
  type: 'cleanup';
  target: 'logs' | 'sessions' | 'temp-files' | 'exports';
  olderThanDays: number;
}

export type JobData =
  | EmailJobData
  | SmsJobData
  | NotificationJobData
  | ReportJobData
  | CleanupJobData;

export interface EnqueueResult {
  taskId: string;
  jobType: string;
  status: 'queued';
}

export interface QueueStats {
  name: string;
  active: number;
  reserved: number;
  scheduled: number;
}

export interface FailedJob {
  task_id: string;
  task_name: string;
  status: string;
  result: string;
  date_done: string | null;
  traceback: string;
}

// ============================================================
// Internal HTTP helpers
// ============================================================

function getDjangoApiUrl(): string {
  return (
    process.env.DJANGO_API_URL ||
    process.env.NEXT_PUBLIC_DJANGO_API_URL ||
    'http://localhost:8000'
  );
}

async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  options: { authToken?: string } = {}
): Promise<T> {
  const base = getDjangoApiUrl().replace(/\/$/, '');
  const url  = `${base}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.authToken) {
    headers['Authorization'] = `Bearer ${options.authToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Task API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function apiGet<T = unknown>(
  path: string,
  options: { authToken?: string; params?: Record<string, string> } = {}
): Promise<T> {
  const base = getDjangoApiUrl().replace(/\/$/, '');
  const searchParams = options.params
    ? '?' + new URLSearchParams(options.params).toString()
    : '';
  const url = `${base}${path}${searchParams}`;

  const headers: Record<string, string> = {};
  if (options.authToken) {
    headers['Authorization'] = `Bearer ${options.authToken}`;
  }

  const res = await fetch(url, { headers, cache: 'no-store' });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Task API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function enqueue(
  jobType: string,
  kwargs: Record<string, unknown>,
  options: { countdown?: number; priority?: number; authToken?: string } = {}
): Promise<EnqueueResult> {
  const { authToken, ...applyAsyncOptions } = options;
  const raw = await apiPost<{ task_id: string; job_type: string; status: string }>(
    '/api/tasks/enqueue/',
    { job_type: jobType, kwargs, options: applyAsyncOptions },
    { authToken }
  );
  return { taskId: raw.task_id, jobType: raw.job_type, status: raw.status as 'queued' };
}

// ============================================================
// Public helpers  (identical signatures to the old BullMQ API)
// ============================================================

/**
 * Add an email job to the Celery email queue.
 * Replaces BullMQ: emailQueue.add('send-email', ...)
 */
export async function addEmailJob(
  data: Omit<EmailJobData, 'type'>,
  options?: { delay?: number; priority?: number; attempts?: number; authToken?: string }
): Promise<EnqueueResult> {
  return enqueue(
    'send-email',
    {
      to: data.to, subject: data.subject,
      template: data.template, data: data.data,
      priority: options?.priority ?? data.priority ?? 5,
    },
    {
      countdown: options?.delay ? Math.round(options.delay / 1000) : undefined,
      priority:  options?.priority ?? data.priority ?? 5,
      authToken: options?.authToken,
    }
  );
}

/**
 * Add an SMS job to the Celery sms queue.
 * Replaces BullMQ: smsQueue.add('send-sms', ...)
 */
export async function addSmsJob(
  data: Omit<SmsJobData, 'type'>,
  options?: { delay?: number; priority?: number; attempts?: number; authToken?: string }
): Promise<EnqueueResult> {
  return enqueue(
    'send-sms',
    {
      to: data.to, message: data.message,
      priority: options?.priority ?? data.priority ?? 3,
    },
    {
      countdown: options?.delay ? Math.round(options.delay / 1000) : undefined,
      authToken: options?.authToken,
    }
  );
}

/**
 * Add a multi-channel notification job.
 * Replaces BullMQ: notificationQueue.add('send-notification', ...)
 */
export async function addNotificationJob(
  data: Omit<NotificationJobData, 'type'>,
  options?: { delay?: number; priority?: number; authToken?: string }
): Promise<EnqueueResult> {
  return enqueue(
    'send-notification',
    {
      user_id: data.userId, title: data.title,
      message: data.message, channels: data.channels,
      data: data.data ?? {},
    },
    {
      countdown: options?.delay ? Math.round(options.delay / 1000) : undefined,
      priority:  options?.priority ?? 5,
      authToken: options?.authToken,
    }
  );
}

/**
 * Add a report generation job.
 * Replaces BullMQ: reportQueue.add('generate-report', ...)
 */
export async function addReportJob(
  data: Omit<ReportJobData, 'type'>,
  options?: { priority?: number; authToken?: string }
): Promise<EnqueueResult> {
  return enqueue(
    'generate-report',
    {
      report_type: data.reportType, tenant_id: data.organizationId,
      user_id: data.userId, parameters: data.parameters,
    },
    { priority: options?.priority ?? 5, authToken: options?.authToken }
  );
}

/**
 * Add a cleanup job.
 * Replaces BullMQ: cleanupQueue.add('cleanup', ...)
 */
export async function addCleanupJob(
  data: Omit<CleanupJobData, 'type'>,
  options?: { delay?: number; authToken?: string }
): Promise<EnqueueResult> {
  return enqueue(
    'cleanup',
    { target: data.target, older_than_days: data.olderThanDays },
    {
      countdown: options?.delay ? Math.round(options.delay / 1000) : undefined,
      priority:  10,
      authToken: options?.authToken,
    }
  );
}

/**
 * Schedule recurring email digest.
 * NOTE: Recurring schedules are managed by Celery Beat (config/settings.py).
 * This is a no-op kept for backwards-compat.
 */
export async function scheduleEmailDigest(
  _frequency: 'daily' | 'weekly',
  _hour = 8
): Promise<void> {
  logger.warn(
    '[job-queue] scheduleEmailDigest() is a no-op. ' +
    'Email digest schedule is managed by Celery Beat in backend/config/settings.py.'
  );
}

/**
 * Schedule cleanup jobs.
 * NOTE: Cleanup schedule is managed by Celery Beat � this is a no-op.
 */
export async function scheduleCleanupJobs(): Promise<void> {
  logger.warn(
    '[job-queue] scheduleCleanupJobs() is a no-op. ' +
    'Cleanup schedule is managed by Celery Beat in backend/config/settings.py.'
  );
}

// ============================================================
// Queue monitoring  (admin � mirrors previous BullMQ helpers)
// ============================================================

/** Get statistics for all queues. Replaces BullMQ: getAllQueueStats() */
export async function getAllQueueStats(
  options: { authToken?: string } = {}
): Promise<QueueStats[]> {
  const data = await apiGet<{ queues: QueueStats[] }>('/api/tasks/queues/', options);
  return data.queues;
}

/** Get failed jobs for a queue. Replaces BullMQ: getFailedJobs(queueName, limit) */
export async function getFailedJobs(
  queueName: string,
  limit = 20,
  options: { authToken?: string } = {}
): Promise<FailedJob[]> {
  const data = await apiGet<{ failed: FailedJob[] }>(
    `/api/tasks/queues/${queueName}/failed/`,
    { ...options, params: { limit: String(limit) } }
  );
  return data.failed;
}

/**
 * Retry a failed job. Replaces BullMQ: retryJob(queueName, jobId)
 * Note: queueName is ignored � Celery tracks tasks by ID.
 */
export async function retryJob(
  _queueName: string,
  taskId: string,
  options: { authToken?: string } = {}
): Promise<EnqueueResult> {
  const data = await apiPost<{ new_task_id: string; original_task_id: string; status: string }>(
    `/api/tasks/jobs/${taskId}/retry/`,
    {},
    options
  );
  return { taskId: data.new_task_id, jobType: 'retry', status: 'queued' };
}

/** Pause a queue. Replaces BullMQ: pauseQueue(queueName) */
export async function pauseQueue(
  queueName: string,
  options: { authToken?: string } = {}
): Promise<void> {
  await apiPost(`/api/tasks/queues/${queueName}/pause/`, {}, options);
}

/** Resume a queue. Replaces BullMQ: resumeQueue(queueName) */
export async function resumeQueue(
  queueName: string,
  options: { authToken?: string } = {}
): Promise<void> {
  await apiPost(`/api/tasks/queues/${queueName}/resume/`, {}, options);
}

/**
 * Clean completed jobs � no-op.
 * Use `manage.py celery_deleteresults` on the Django side.
 */
export async function cleanCompletedJobs(
  _queueName: string,
  _olderThanMs = 24 * 60 * 60 * 1000
): Promise<void> {
  logger.warn('[job-queue] cleanCompletedJobs() is a no-op. Run `manage.py celery_deleteresults` instead.');
}

/** Graceful shutdown � no-op (no local connections). */
export async function closeQueues(): Promise<void> {}

// ============================================================
// Legacy queue accessors � stubs to avoid import errors
// ============================================================
export const getEmailQueue              = () => null;
export const getSmsQueue                = () => null;
export const getNotificationQueue       = () => null;
export const getReportQueue             = () => null;
export const getCleanupQueue            = () => null;
export const getEmailQueueEvents        = () => null;
export const getSmsQueueEvents          = () => null;
export const getNotificationQueueEvents = () => null;
export const getReportQueueEvents       = () => null;
export const getCleanupQueueEvents      = () => null;


