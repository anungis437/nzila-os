/**
 * POST /api/location/track
 * Migrated to withApi() framework
 */
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const locationTrackSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
  latitude: z.number().min(-90, "Latitude must be -90 to 90").max(90, "Latitude must be -90 to 90"),
  longitude: z.number().min(-180, "Longitude must be -180 to 180").max(180, "Longitude must be -180 to 180"),
  accuracy: z.number().positive().optional(),
  altitude: z.number().optional(),
  purpose: z.enum(["strike", "picket", "meeting", "event", "organizing"]),
  activityType: z.string().max(100).optional(),
  strikeId: z.string().uuid("Invalid strikeId").optional(),
  eventId: z.string().uuid("Invalid eventId").optional(),
});

export const POST = withApi(
  {
    auth: { required: true },
    body: locationTrackSchema,
    openapi: {
      tags: ['Location'],
      summary: 'POST track',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

        // Track location (service will verify consent)
        const location = await GeofencePrivacyService.trackLocation({
          userId: body.userId,
          latitude: body.latitude,
          longitude: body.longitude,
          accuracy: body.accuracy,
          altitude: body.altitude,
          purpose: body.purpose,
          activityType: body.activityType,
          strikeId: body.strikeId,
          eventId: body.eventId,
        });
        return { location,
            message: "Location recorded. Data will be automatically deleted after 24 hours.", };
  },
);
