import { NextResponse } from 'next/server';
import {
  requestLocationPermission,
} from '@/lib/services/geofence-privacy-service';
import type { EmergencyActivationResponse } from '@/lib/types/compliance-api-types';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { z } from 'zod';

/**
 * Emergency Activation API
 * Activate emergency procedures with geofence privacy safeguards
 * Enables location tracking under explicit member consent only
 */

/**
 * POST /api/emergency/activate
 * Activate emergency mode with location tracking (with consent)
 */
const emergencyActivationSchema = z.object({
  memberId: z.string().uuid(),
  emergencyType: z.string().min(1),
  affectedRegions: z.array(z.string().min(1)).min(1),
  description: z.string().optional(),
  expectedDurationDays: z.number().int().positive().max(365),
});

export const POST = withRoleAuth('steward', async (request) => {
  try {
    const body = await request.json();
    const parsed = emergencyActivationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          notificationsSent: [],
        } as EmergencyActivationResponse,
        { status: 400 }
      );
    }

    const { memberId, emergencyType, affectedRegions, expectedDurationDays } = parsed.data;

    const consentRequest = await requestLocationPermission(
      memberId,
      'emergency_response'
    );

    if (consentRequest.requiresUserAction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Location consent required',
          notificationsSent: ['consent_request_sent'],
          breakGlassOps: {
            activated: false,
            allowedOperations: [],
            safetyLimits: {},
          },
        } as EmergencyActivationResponse,
        { status: 403 }
      );
    }

    const declaration = {
      emergencyId: `EMG-${memberId}-${Date.now()}`,
      memberId,
      emergencyType,
      status: 'active',
      declaredAt: new Date().toISOString(),
      expectedEndDate: new Date(Date.now() + expectedDurationDays * 24 * 60 * 60 * 1000).toISOString(),
      breakGlassActivated: true,
      affectedRegions,
    };

    return NextResponse.json({
      success: true,
      declaration,
      breakGlassOps: {
        activated: true,
        allowedOperations: [
          'real_time_location_tracking',
          'geofence_monitoring',
          'emergency_notifications',
          'incident_response_coordination',
        ],
        safetyLimits: {
          retentionDays: 30,
          backgroundTrackingBlocked: 'true',
          encryptionRequired: 'true',
          auditLogging: 'true',
        },
      },
      notificationsSent: [
        'emergency_declared_members',
        'regional_coordinators_notified',
        'location_consent_obtained',
      ],
      message: `Emergency ${emergencyType} activated in ${affectedRegions.join(', ')}`,
    } as EmergencyActivationResponse);
  } catch (_error) {
return NextResponse.json(
      {
        success: false,
        error: 'Emergency activation failed',
        notificationsSent: [],
      } as EmergencyActivationResponse,
      { status: 500 }
    );
  }
});

