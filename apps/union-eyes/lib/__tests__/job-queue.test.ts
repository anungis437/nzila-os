import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('@nzila/os-core', () => ({ createLogger: mocks.createLogger }));

// Mock global fetch
const mockFetch = vi.fn();

import {
  addEmailJob,
  addSmsJob,
  addNotificationJob,
  addReportJob,
  addCleanupJob,
  getAllQueueStats,
  getFailedJobs,
  retryJob,
  pauseQueue,
  resumeQueue,
  cleanCompletedJobs,
  scheduleEmailDigest,
  scheduleCleanupJobs,
  closeQueues,
  getEmailQueue,
  getSmsQueue,
  getNotificationQueue,
  getReportQueue,
  getCleanupQueue,
  getEmailQueueEvents,
  getSmsQueueEvents,
  getNotificationQueueEvents,
  getReportQueueEvents,
  getCleanupQueueEvents,
} from '../job-queue';

function mockOkResponse(data: any) {
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
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DJANGO_API_URL;
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

    it('falls back to statusText when POST error text() rejects', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: vi.fn().mockRejectedValue(new Error('no body')),
      });

      await expect(addEmailJob({
        to: 'x@y.com', subject: 's', template: 't', data: {},
      })).rejects.toThrow('Task API error 503: Service Unavailable');
    });

    it('falls back to statusText when GET error text() rejects', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: vi.fn().mockRejectedValue(new Error('no body')),
      });

      await expect(getAllQueueStats()).rejects.toThrow('Task API error 502: Bad Gateway');
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

  describe('getFailedJobs', () => {
    it('fetches failed jobs with limit param', async () => {
      const failed = [{ task_id: 't', task_name: 'send-email', status: 'FAILURE', result: '', date_done: null, traceback: '' }];
      mockFetch.mockResolvedValue(mockOkResponse({ failed }));

      const result = await getFailedJobs('email', 5, { authToken: 'tok' });
      expect(result).toEqual(failed);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/tasks/queues/email/failed/');
      expect(calledUrl).toContain('limit=5');
    });
  });

  describe('pauseQueue / resumeQueue', () => {
    it('pauses a queue', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({}));
      await expect(pauseQueue('email')).resolves.toBeUndefined();
      expect(mockFetch.mock.calls[0][0]).toContain('/api/tasks/queues/email/pause/');
    });

    it('resumes a queue', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({}));
      await expect(resumeQueue('email')).resolves.toBeUndefined();
      expect(mockFetch.mock.calls[0][0]).toContain('/api/tasks/queues/email/resume/');
    });
  });

  describe('no-op functions', () => {
    it('scheduleEmailDigest is a no-op', async () => {
      await expect(scheduleEmailDigest('daily')).resolves.toBeUndefined();
    });

    it('scheduleCleanupJobs is a no-op', async () => {
      await expect(scheduleCleanupJobs()).resolves.toBeUndefined();
    });

    it('cleanCompletedJobs is a no-op', async () => {
      await expect(cleanCompletedJobs('email')).resolves.toBeUndefined();
    });

    it('closeQueues is a no-op', async () => {
      await expect(closeQueues()).resolves.toBeUndefined();
    });

    it('legacy queue accessors return null', () => {
      expect(getEmailQueue()).toBeNull();
      expect(getSmsQueue()).toBeNull();
      expect(getNotificationQueue()).toBeNull();
      expect(getReportQueue()).toBeNull();
      expect(getCleanupQueue()).toBeNull();
      expect(getEmailQueueEvents()).toBeNull();
      expect(getSmsQueueEvents()).toBeNull();
      expect(getNotificationQueueEvents()).toBeNull();
      expect(getReportQueueEvents()).toBeNull();
      expect(getCleanupQueueEvents()).toBeNull();
    });
  });
});
