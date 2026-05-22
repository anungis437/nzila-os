/**
 * Notification Routes
 * Week 9-10: API endpoints for notification management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  queueNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getNotificationHistory,
  processPendingNotifications,
  retryFailedNotifications,
} from '../services/notification-service';
import { logger } from '@/lib/logger';

const router = Router();

const getOrganizationIdFromHeaders = (req: Request): string | undefined =>
  (req.headers['x-organization-id'] as string) || (req.headers['x-tenant-id'] as string);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const QueueNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum([
    'payment_confirmation',
    'payment_failed',
    'payment_reminder',
    'donation_received',
    'stipend_approved',
    'stipend_disbursed',
    'low_balance_alert',
    'arrears_warning',
    'strike_announcement',
    'picket_reminder',
  ]),
  channels: z.array(z.enum(['email', 'sms', 'push', 'in_app'])).min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  data: z.record(z.any()),
  scheduledFor: z.string().datetime().optional(),
});

const UpdatePreferencesSchema = z.object({
  preferences: z.record(z.boolean()),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/notifications/queue
 * Queue a notification for delivery
 */
router.post('/queue', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing x-organization-id header',
      });
    }

    const body = QueueNotificationSchema.parse(req.body);

    const notificationId = await queueNotification({
      organizationId,
      userId: body.userId,
      type: body.type,
      channels: body.channels,
      priority: body.priority,
      data: body.data,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    });

    res.json({
      success: true,
      notificationId,
      message: 'Notification queued successfully',
    });
  } catch (error) {
    logger.error('Queue notification error', { error });
    res.status(400).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const userId = req.query.userId as string;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing organizationId or userId',
      });
    }

    const preferences = await getUserNotificationPreferences(organizationId, userId);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    logger.error('Get preferences error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const userId = req.body.userId as string;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing organizationId or userId',
      });
    }

    const { preferences } = UpdatePreferencesSchema.parse(req.body);

    await updateUserNotificationPreferences(organizationId, userId, preferences);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    logger.error('Update preferences error', { error });
    res.status(400).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/notifications/history
 * Get notification history for a user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing organizationId or userId',
      });
    }

    const history = await getNotificationHistory(organizationId, userId, limit);

    res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error('Get history error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/notifications/process
 * Process pending notifications (admin/cron endpoint)
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const batchSize = parseInt(req.body.batchSize as string) || 50;

    const processed = await processPendingNotifications(batchSize);

    res.json({
      success: true,
      processed,
      message: `Processed ${processed} notifications`,
    });
  } catch (error) {
    logger.error('Process notifications error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/notifications/retry-failed
 * Retry failed notifications (admin endpoint)
 */
router.post('/retry-failed', async (req: Request, res: Response) => {
  try {
    const maxAttempts = parseInt(req.body.maxAttempts as string) || 3;

    const retried = await retryFailedNotifications(maxAttempts);

    res.json({
      success: true,
      retried,
      message: `Retried ${retried} failed notifications`,
    });
  } catch (error) {
    logger.error('Retry failed notifications error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================================================
// HELPER ENDPOINT: Send Test Notification
// ============================================================================

/**
 * POST /api/notifications/test
 * Send a test notification (development only)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const organizationId = getOrganizationIdFromHeaders(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing x-organization-id header',
      });
    }

    const notificationId = await queueNotification({
      organizationId,
      userId: req.body.userId || '00000000-0000-0000-0000-000000000000',
      type: 'payment_confirmation',
      channels: ['email'],
      priority: 'normal',
      data: {
        amount: '$50.00',
        transactionId: 'test-123',
      },
    });

    // Process immediately
    await processPendingNotifications(1);

    res.json({
      success: true,
      notificationId,
      message: 'Test notification sent',
    });
  } catch (error) {
    logger.error('Test notification error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
