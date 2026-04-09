/**
 * Unified Signal model for the Inbox surface.
 *
 * A Signal is any incoming item that requires user attention:
 * intake submissions, messages, alerts, notifications, or
 * system-generated events.  The Inbox renders these in a
 * single feed with filtering by type and urgency.
 */

export type SignalType = 'intake' | 'message' | 'alert' | 'system';
export type SignalUrgency = 'critical' | 'high' | 'normal' | 'low';
export type SignalStatus = 'unread' | 'read' | 'actioned' | 'dismissed';

export interface Signal {
  id: string;
  type: SignalType;
  title: string;
  preview: string;
  status: SignalStatus;
  urgency: SignalUrgency;
  createdAt: string;
  actor?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'case' | 'grievance' | 'message' | 'member';
}

/** Quick-action identifiers available on inbox items */
export type SignalAction = 'review' | 'request_info' | 'convert_to_case' | 'dismiss';
