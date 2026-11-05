/**
 * A campaign as the CRUD routes answer it (GET /api/communications/campaigns and /campaigns/[id]), read for browser code.
 *
 * A column the table never leaves empty that is missing from the record is an error for the screen to report, not a record to complete. The delivery
 * counters live in a jsonb object that a sender advances; a counter the record does not hold is null (shown as "—"), never 0, and a rate whose base is
 * zero or unknown is null as well, never 0% or NaN%.
 */
import { asRecord, isRecord, optionalString, requiredString } from '@/lib/client/row-fields';

/** A delivery counter of the record's stats; null when the record holds none. */
export type Counter = number | null;

export interface CampaignRecord {
  id: string;
  name: string;
  description: string | null;
  type: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string;
  /** The cached audience size. Nothing computes it in this release, so it holds its default (0), which is not a count of anyone. */
  audienceCount: Counter;
  scheduledAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
  stats: {
    queued: Counter;
    sent: Counter;
    delivered: Counter;
    failed: Counter;
    bounced: Counter;
    opened: Counter;
    clicked: Counter;
    unsubscribed: Counter;
  };
  trackOpens: boolean;
  trackClicks: boolean;
  createdAt: string;
}

export const counter = (value: unknown): Counter => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function campaignFrom(value: unknown): CampaignRecord {
  const row = asRecord(value, 'campaign');
  const stored: Record<string, unknown> = isRecord(row.stats) ? row.stats : {};
  const settings: Record<string, unknown> = isRecord(row.settings) ? row.settings : {};
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    description: optionalString(row, 'description'),
    type: requiredString(row, 'type'),
    channel: requiredString(row, 'channel'),
    status: requiredString(row, 'status'),
    subject: optionalString(row, 'subject'),
    body: optionalString(row, 'body') ?? '',
    audienceCount: counter(row.audienceCount),
    scheduledAt: optionalString(row, 'scheduledAt'),
    sentAt: optionalString(row, 'sentAt'),
    completedAt: optionalString(row, 'completedAt'),
    stats: {
      queued: counter(stored.queued),
      sent: counter(stored.sent),
      delivered: counter(stored.delivered),
      failed: counter(stored.failed),
      bounced: counter(stored.bounced),
      opened: counter(stored.opened),
      clicked: counter(stored.clicked),
      unsubscribed: counter(stored.unsubscribed),
    },
    trackOpens: settings.trackOpens === true,
    trackClicks: settings.trackClicks === true,
    createdAt: requiredString(row, 'createdAt'),
  };
}

/** A percentage to one decimal place, or null when the part or the whole is not recorded or the whole is zero. */
export function rate(part: Counter, whole: Counter): string | null {
  return part !== null && whole !== null && whole > 0 ? ((part / whole) * 100).toFixed(1) : null;
}
