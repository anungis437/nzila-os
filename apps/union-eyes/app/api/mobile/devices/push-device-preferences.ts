/** Shared input boundary for push-device create and preference PATCH.
 * Only the allowlisted fields supplied by the caller are validated here.
 * CRUD enforces ownership, tenancy, allowed fields, and atomic audit.
 */
import { ApiError } from '@/lib/api/errors';

export function validatePushDevicePreferences(values: Record<string, unknown>): void {
  for (const key of ['quietHoursStart', 'quietHoursEnd'] as const) {
    const value = values[key];
    if (value !== undefined && value !== null &&
      (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))) {
      throw ApiError.badRequest(`${key} must be HH:mm in 24-hour time`);
    }
  }
  if (values.enabled !== undefined && typeof values.enabled !== 'boolean') {
    throw ApiError.badRequest('enabled must be a boolean');
  }
  for (const key of ['deviceName', 'deviceModel', 'osVersion', 'appVersion'] as const) {
    const value = values[key];
    if (value !== undefined && value !== null &&
      (typeof value !== 'string' || value.length > 255)) {
      throw ApiError.badRequest(`${key} must be a string of at most 255 characters`);
    }
  }
  if (values.timezone !== undefined && values.timezone !== null) {
    if (typeof values.timezone !== 'string' || values.timezone.length > 64) {
      throw ApiError.badRequest('timezone must be a valid IANA time zone');
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: values.timezone });
    } catch {
      throw ApiError.badRequest('timezone must be a valid IANA time zone');
    }
  }
}
