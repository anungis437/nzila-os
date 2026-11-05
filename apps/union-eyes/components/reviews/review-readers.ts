/**
 * Reads GET /api/reviews, which answers a raw body (not the withApi envelope): { success: true, own, oversight, notificationDelivered: false,
 * notificationPolicy: 'not_adopted' } (listMemberReviewIntake). A body that is not that is an error for the screen, never an empty list.
 */
import { ApiShapeError, isRecord } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredDate, requiredString } from '@/lib/client/row-fields';

export type ReviewStatus = 'open' | 'closed';

export interface OwnReview {
  id: string;
  reviewType: string;
  status: ReviewStatus;
  openedAt: Date;
  participation: 'opened' | 'complainant';
}

export interface OversightReview {
  id: string;
  reviewType: string;
  status: ReviewStatus;
  openedAt: Date;
  classification: 'standard' | 'privileged';
  complainantUserId: string | null;
}

export interface IntakeList {
  own: OwnReview[];
  oversight: OversightReview[];
}

function oneOf<T extends string>(row: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const value = row[key];
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new ApiShapeError(`${key} is not recognised`);
  return match;
}

export function readIntakeList(body: unknown): IntakeList {
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.own) || !Array.isArray(body.oversight)) throw new ApiShapeError('no review lists');
  return {
    own: body.own.map((value): OwnReview => {
      const row = asRecord(value, 'review');
      return {
        id: requiredString(row, 'id'),
        reviewType: requiredString(row, 'reviewType'),
        status: oneOf(row, 'status', ['open', 'closed']),
        openedAt: requiredDate(row, 'openedAt'),
        participation: oneOf(row, 'participation', ['opened', 'complainant']),
      };
    }),
    oversight: body.oversight.map((value): OversightReview => {
      const row = asRecord(value, 'review');
      return {
        id: requiredString(row, 'id'),
        reviewType: requiredString(row, 'reviewType'),
        status: oneOf(row, 'status', ['open', 'closed']),
        openedAt: requiredDate(row, 'openedAt'),
        classification: oneOf(row, 'classification', ['standard', 'privileged']),
        complainantUserId: optionalString(row, 'complainantUserId'),
      };
    }),
  };
}
