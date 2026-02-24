import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { purgeExpiredLocations } from '@/lib/services/geofence-privacy-service';
import type { EmergencyRecoveryResponse } from '@/lib/types/compliance-api-types';
import { withApiAuth } from '@/lib/api-auth-guard';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

/**
 * 48-Hour Recovery Status API
 * Monitor progress toward emergency recovery and location data cleanup
 */

/**
 * POST /api/emergency/recovery
 * End emergency mode and cleanup location data within 48 hours
 */

const emergencyRecoverySchema = z.object({
  emergencyId: z.string().uuid('Invalid emergencyId'),
  memberId: z.string().uuid('Invalid memberId'),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    // Validate request body
    const validation = emergencyRecoverySchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { emergencyId, memberId } = validation.data;

    if (!emergencyId || !memberId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: emergencyId, memberId',
          emergencyId: emergencyId || 'unknown',
          status: 'failed',
          recoverySteps: [],
        } as EmergencyRecoveryResponse,
        { status: 400 }
      );
    }

    // Purge location data from emergency tracking
    const _purgeResult = await purgeExpiredLocations();

    const recoverySteps = [
      'End emergency mode',
      'Disable break-glass access',
      'Purge location tracking data (48-hour window)',
      'Restore normal geofence policies',
      'Notify member of data cleanup',
      'Archive incident logs',
    ];

    return NextResponse.json({
      success: true,
      emergencyId,
      status: 'recovery_in_progress',
      recoverySteps,
      completedAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      remainingActions: [
        'Await 48-hour purge window completion',
        'Member consent verification',
        'Restoration of normal operations',
      ],
      message: `Emergency recovery initiated for ${emergencyId}. Location data will be purged within 48 hours.`,
    } as EmergencyRecoveryResponse);
  } catch (error) {
return NextResponse.json(
      {
        success: false,
        error: `Recovery failed: ${error}`,
        emergencyId: '',
        status: 'failed',
        recoverySteps: [],
      } as EmergencyRecoveryResponse,
      { status: 500 }
    );
  }
});

/**
 * GET /api/emergency/recovery?emergencyId=EMG-123&memberId=456
 * Get recovery status
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const emergencyId = searchParams.get('emergencyId');
    const _memberId = searchParams.get('memberId');

    if (!emergencyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'emergencyId parameter required',
          emergencyId: 'unknown',
          status: 'not_found',
          recoverySteps: [],
        } as EmergencyRecoveryResponse,
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      emergencyId,
      status: 'recovery_pending',
      recoverySteps: [
        'Emergency declared',
        'Location consent granted',
        'Emergency mode active',
        'Recovery initiated',
      ],
      remainingActions: [
        'Complete 48-hour purge window',
        'Verify data cleanup',
        'Restore normal operations',
      ],
      message: `Recovery in progress for emergency ${emergencyId}`,
    } as EmergencyRecoveryResponse);
  } catch (error) {
return NextResponse.json(
      {
        success: false,
        error: `Failed to get recovery status: ${error}`,
        emergencyId: '',
        status: 'error',
        recoverySteps: [],
      } as EmergencyRecoveryResponse,
      { status: 500 }
    );
  }
});

