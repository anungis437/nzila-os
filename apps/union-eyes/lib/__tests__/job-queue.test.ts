import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('@nzila/os-core', () => ({ createLogger: mocks.createLogger }));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  addEmailJob,
  addSmsJob,
  addNotificationJob,
  addReportJob,
  addCleanupJob,
  getAllQueueStats,
  retryJob,
  scheduleEmailDigest,
  scheduleCleanupJobs,
  closeQueues,
  getEmailQueue,
} from '../job-queue';

function mockOkResponse(data: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(''),
  };
}

function mockErrorResponse(status: number, text: string) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    text: vi.fn().mockResolvedValue(text),
  };
}

describe('job-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DJANGO_API_URL = 'http://django:8000';
  });

  describe('addEmailJob', () => {
    it('enqueues email via POST to Django API', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({
        task_id: 'task-1', job_type: 'send-email', status: 'queued',
      }));

      const result = await addEmailJob({
        to: 'test@example.com',
        subject: 'Hello',
        template: 'welcome',
        data: { name: 'Test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://django:8000/api/tasks/enqueue/',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual({ taskId: 'task-1', jobType: 'send-email', status: 'queued' });
    });
  });

  describe('addSmsJob', () => {
    it('enqueues SMS job', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({
        task_id: 'task-2', job_type: 'send-sms', status: 'queued',
      }));

      const result = await addSmsJob({ to: '+15551234', message: 'Hi' });
      expect(result.taskId).toBe('task-2');
    });
  });

  describe('addNotificationJob', () => {
    it('enqueues notification job', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({
        task_id: 'task-3', job_type: 'send-notification', status: 'queued',
      }));

      const result = await addNotificationJob({
        userId: 'u-1', title: 'Alert', message: 'msg', channels: ['email'],
      });
      expect(result.taskId).toBe('task-3');
    });
  });

  describe('addReportJob', () => {
    it('enqueues report job', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({
        task_id: 'task-4', job_type: 'generate-report', status: 'queued',
      }));

      const result = await addReportJob({
        reportType: 'monthly', organizationId: 'org-1', userId: 'u-1', parameters: {},
      });
      expect(result.taskId).toBe('task-4');
    });
  });

  describe('addCleanupJob', () => {
    it('enqueues cleanup job', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({
        task_id: 'task-5', job_type: 'cleanup', status: 'queued',
      }));

      const result = await addCleanupJob({ target: 'logs', olderThanDays: 30 });
      expect(result.taskId).toBe('task-5');
    });
  });

  describe('error handling', () => {
    it('throws on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(500, 'Internal server error'));

      await expect(addEmailJob({
        to: 'x@y.com', subject: 's', template: 't', data: {},
      })).rejects.toThrow('Task API error 500');
    });
  });

  describe('getAllQueueStats', () => {
    it('fetches queue statistics', async () => {
      const stats = [{ name: 'email', active: 2, reserved: 1, scheduled: 0 }];
      mockFetch.mockResolvedValue(mockOkResponse({ queues: stats }));

      const result = await getAllQueueStats();
      expect(result).toEqual(stats);
    });
  });

  describe('retryJob', () => {
    it('retries a failed job', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({
        new_task_id: 'retry-1', original_task_id: 'task-1', status: 'queued',
      }));

      const result = await retryJob('email', 'task-1');
      expect(result.taskId).toBe('retry-1');
    });
  });

  describe('no-op functions', () => {
    it('scheduleEmailDigest is a no-op', async () => {
      await expect(scheduleEmailDigest('daily')).resolves.toBeUndefined();
    });

    it('scheduleCleanupJobs is a no-op', async () => {
      await expect(scheduleCleanupJobs()).resolves.toBeUndefined();
    });

    it('closeQueues is a no-op', async () => {
      await expect(closeQueues()).resolves.toBeUndefined();
    });

    it('legacy queue accessors return null', () => {
      expect(getEmailQueue()).toBeNull();
    });
  });
});
